import React, { useState, useCallback } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Info, Save, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Employee, Shift, InsertShift } from "@shared/schema";
import { 
  formatDateForAPI, generateTimeSlots, isTimeBetween, calculateHoursBetween, 
  formatHours, isInSameWeek, convertTimeToMinutes 
} from "@/lib/date-helpers";
import { useIsMobile } from "@/hooks/use-mobile";
import ExportsModal from './exports-modal';
import BeautifulDraggableShift from './beautiful-draggable-shift';

interface BeautifulScheduleTableProps {
  employees: Employee[];
  shifts: Shift[];
  date: Date;
  onSaveShifts: (selections: {employee: Employee, startTime: string, endTime: string}[]) => void;
  onDeleteShift?: (shiftId: number) => void;
  onMoveShift?: (shiftId: number, newEmployeeId: number, newStartTime: string, newEndTime: string) => void;
  estimatedDailySales?: number;
  hourlyEmployeeCost?: number;
}

export default function BeautifulScheduleTable({ 
  employees, 
  shifts, 
  date, 
  onSaveShifts,
  onDeleteShift,
  onMoveShift,
  estimatedDailySales = 0,
  hourlyEmployeeCost = 0
}: BeautifulScheduleTableProps) {
  // Estado para el tamaño de las celdas
  const [cellSize, setCellSize] = useState<number>(32);
  
  // Estado para el rango de horas
  const [startHour, setStartHour] = useState<number>(9);
  const [endHour, setEndHour] = useState<number>(23);
  
  // Slots de tiempo basados en el rango de horas
  const timeSlots = generateTimeSlots(startHour, endHour);
  
  // Estado para selecciones de celdas por empleado
  const [selectedCellsByEmployee, setSelectedCellsByEmployee] = useState<Map<number, Set<string>>>(new Map());
  
  // Estado para celdas en las que se está arrastrando sobre
  const [dragOverCells, setDragOverCells] = useState<{employeeId: number, time: string} | null>(null);
  
  // Detector de dispositivo móvil
  const isMobile = useIsMobile();
  
  // Toast para notificaciones
  const { toast } = useToast();
  
  // Funciones para aumentar/disminuir el tamaño de las celdas
  const increaseCellSize = () => setCellSize(prev => Math.min(prev + 5, 50));
  const decreaseCellSize = () => setCellSize(prev => Math.max(prev - 5, 20));
  
  // Verificar si una celda tiene un turno asignado
  const isCellAssigned = useCallback((employeeId: number, time: string): boolean => {
    return shifts.some(shift => 
      shift.employeeId === employeeId && 
      shift.date === formatDateForAPI(date) && 
      isTimeBetween(time, shift.startTime, shift.endTime)
    );
  }, [shifts, date]);
  
  // Obtener un turno para una celda específica
  const getShiftForCell = useCallback((employeeId: number, time: string): Shift | undefined => {
    return shifts.find(shift => 
      shift.employeeId === employeeId && 
      shift.date === formatDateForAPI(date) && 
      isTimeBetween(time, shift.startTime, shift.endTime)
    );
  }, [shifts, date]);
  
  // Calcular ancho de un turno basado en su duración
  const getShiftWidth = useCallback((startTime: string, endTime: string): number => {
    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = timeSlots.indexOf(endTime);
    if (startIndex === -1 || endIndex === -1) return cellSize;
    
    const width = (endIndex - startIndex) * cellSize;
    return width > 0 ? width : cellSize;
  }, [timeSlots, cellSize]);
  
  // Verificar si una celda es la primera de un turno
  const isFirstCellOfShift = useCallback((employeeId: number, time: string): boolean => {
    const shift = getShiftForCell(employeeId, time);
    return shift ? shift.startTime === time : false;
  }, [getShiftForCell]);
  
  // Manejar selección de celda individual
  const toggleCellSelection = (employeeId: number, time: string) => {
    if (isCellAssigned(employeeId, time)) return;
    
    const newSelectedCellsByEmployee = new Map(selectedCellsByEmployee);
    const selectedCells = newSelectedCellsByEmployee.get(employeeId) || new Set<string>();
    
    if (selectedCells.has(time)) {
      selectedCells.delete(time);
      if (selectedCells.size === 0) {
        newSelectedCellsByEmployee.delete(employeeId);
      } else {
        newSelectedCellsByEmployee.set(employeeId, selectedCells);
      }
    } else {
      selectedCells.add(time);
      newSelectedCellsByEmployee.set(employeeId, selectedCells);
    }
    
    setSelectedCellsByEmployee(newSelectedCellsByEmployee);
  };
  
  // Verificar si una celda está seleccionada
  const isCellSelected = (employeeId: number, time: string) => {
    const selectedCells = selectedCellsByEmployee.get(employeeId);
    return selectedCells ? selectedCells.has(time) : false;
  };
  
  // Manejar guardado de selecciones
  const handleSaveSelections = () => {
    const selections: { employee: Employee, startTime: string, endTime: string }[] = [];
    
    selectedCellsByEmployee.forEach((selectedTimes, employeeId) => {
      if (selectedTimes.size === 0) return;
      
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) return;
      
      const sortedTimes = Array.from(selectedTimes).sort((a, b) => {
        return convertTimeToMinutes(a) - convertTimeToMinutes(b);
      });
      
      if (sortedTimes.length === 0) return;
      
      let currentGroup: string[] = [sortedTimes[0]];
      
      for (let i = 1; i < sortedTimes.length; i++) {
        const prevTime = currentGroup[currentGroup.length - 1];
        const currTime = sortedTimes[i];
        
        const prevIndex = timeSlots.indexOf(prevTime);
        const currIndex = timeSlots.indexOf(currTime);
        
        if (currIndex - prevIndex === 1) {
          currentGroup.push(currTime);
        } else {
          const startTime = currentGroup[0];
          const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
          const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                          timeSlots[lastTimeIndex + 1] : 
                          currentGroup[currentGroup.length - 1];
          
          selections.push({
            employee,
            startTime,
            endTime
          });
          
          currentGroup = [currTime];
        }
      }
      
      if (currentGroup.length > 0) {
        const startTime = currentGroup[0];
        const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
        const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                        timeSlots[lastTimeIndex + 1] : 
                        currentGroup[currentGroup.length - 1];
        
        selections.push({
          employee,
          startTime,
          endTime
        });
      }
    });
    
    if (selections.length > 0) {
      onSaveShifts(selections);
      setSelectedCellsByEmployee(new Map());
    }
  };
  
  // Verificar si hay selecciones
  const hasSelections = selectedCellsByEmployee.size > 0;
  
  // Calcular horas semanales para un empleado
  const calculateWeeklyHours = (employee: Employee) => {
    let workedHours = 0;
    
    // Contar horas de turnos ya guardados en la semana actual
    shifts.forEach(shift => {
      if (shift.employeeId === employee.id && isInSameWeek(new Date(shift.date), date)) {
        workedHours += calculateHoursBetween(shift.startTime, shift.endTime);
      }
    });
    
    // Contar horas de selecciones actuales
    const selectedTimes = selectedCellsByEmployee.get(employee.id);
    if (selectedTimes && selectedTimes.size > 0) {
      const sortedTimes = Array.from(selectedTimes).sort((a, b) => {
        return convertTimeToMinutes(a) - convertTimeToMinutes(b);
      });
      
      let currentGroup: string[] = [sortedTimes[0]];
      
      for (let i = 1; i < sortedTimes.length; i++) {
        const prevTime = currentGroup[currentGroup.length - 1];
        const currTime = sortedTimes[i];
        
        const prevIndex = timeSlots.indexOf(prevTime);
        const currIndex = timeSlots.indexOf(currTime);
        
        if (currIndex - prevIndex === 1) {
          currentGroup.push(currTime);
        } else {
          const startTime = currentGroup[0];
          const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
          const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                          timeSlots[lastTimeIndex + 1] : 
                          currentGroup[currentGroup.length - 1];
          
          workedHours += calculateHoursBetween(startTime, endTime);
          
          currentGroup = [currTime];
        }
      }
      
      if (currentGroup.length > 0) {
        const startTime = currentGroup[0];
        const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
        const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                        timeSlots[lastTimeIndex + 1] : 
                        currentGroup[currentGroup.length - 1];
        
        workedHours += calculateHoursBetween(startTime, endTime);
      }
    }
    
    const maxWeeklyHours = employee.maxHoursPerWeek || 40;
    const remainingHours = Math.max(0, maxWeeklyHours - workedHours);
    
    return {
      maxWeeklyHours,
      workedHours: parseFloat(workedHours.toFixed(2)),
      remainingHours: parseFloat(remainingHours.toFixed(2))
    };
  };
  
  // Manejar evento de finalización de arrastre
  const handleDragEnd = (result: DropResult) => {
    setDragOverCells(null);
    
    // Si no hay destino o no hubo cambio, no hacer nada
    if (!result.destination || result.destination.droppableId === result.source.droppableId) {
      return;
    }
    
    const shiftId = parseInt(result.draggableId.replace('shift-', ''));
    const shift = shifts.find(s => s.id === shiftId);
    
    if (!shift) return;
    
    // Obtener información del destino
    const [destEmployeeId, destTime] = result.destination.droppableId.split('-');
    const newEmployeeId = parseInt(destEmployeeId);
    
    // Calcular duración del turno en intervalos de 15 minutos
    const shiftDuration = calculateHoursBetween(shift.startTime, shift.endTime);
    
    // Calcular nueva hora de fin basada en la nueva hora de inicio y la duración original
    let endTimeIndex = timeSlots.indexOf(destTime) + Math.round(shiftDuration * 4);
    if (endTimeIndex >= timeSlots.length) {
      endTimeIndex = timeSlots.length - 1;
    }
    const newEndTime = timeSlots[endTimeIndex];
    
    // Si hay función para mover turno, llamarla
    if (onMoveShift) {
      onMoveShift(shiftId, newEmployeeId, destTime, newEndTime);
      
      // Mostrar notificación
      toast({
        title: "Turno movido",
        description: `Turno movido a ${destTime} - ${newEndTime}.`,
      });
    }
  };
  
  // Manejar evento durante el arrastre
  const handleDragUpdate = (result: any) => {
    if (!result.destination) {
      setDragOverCells(null);
      return;
    }
    
    const [employeeId, time] = result.destination.droppableId.split('-');
    setDragOverCells({
      employeeId: parseInt(employeeId),
      time
    });
  };
  
  // Obtener todas las opciones de destino (cada combinación de empleado-tiempo)
  const getDroppableOptions = () => {
    const options: Array<{ id: string, employeeId: number, time: string }> = [];
    
    employees.forEach(employee => {
      timeSlots.forEach(time => {
        // Verificar si la celda ya tiene un turno asignado
        if (!isCellAssigned(employee.id, time)) {
          options.push({
            id: `${employee.id}-${time}`,
            employeeId: employee.id,
            time
          });
        }
      });
    });
    
    return options;
  };
  
  // Filtrar turnos por fecha actual
  const currentDayShifts = shifts.filter(shift => 
    shift.date === formatDateForAPI(date)
  );
  
  // Organizar los turnos por empleado
  const shiftsByEmployee = employees.reduce((acc, employee) => {
    acc[employee.id] = currentDayShifts.filter(shift => 
      shift.employeeId === employee.id
    );
    return acc;
  }, {} as Record<number, Shift[]>);
  
  return (
    <div className="space-y-4">
      {/* Help message for touch users */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-md mb-3 text-sm">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4" />
          <span className="font-medium">Modo táctil:</span> 
        </div>
        <div className="mt-1 ml-6 text-xs">
          • <strong>Arrastra turnos:</strong> Mueve los turnos (bloques azules) a otra hora o empleado
          • <strong>Toca celdas vacías:</strong> Selecciona celdas para crear nuevos turnos
          • <strong>Mantén presionado un turno:</strong> Menú para eliminar turno
        </div>
      </div>
      
      {/* Control buttons */}
      <div className="flex justify-between flex-wrap gap-3 mb-2">
        <div className="flex items-center space-x-4 flex-wrap gap-y-2">
          {/* Control de tamaño de celdas */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Tamaño de celdas: {cellSize}px</span>
            <Button
              size="sm"
              variant="outline"
              onClick={decreaseCellSize}
              className="h-8 w-8 p-0"
            >
              −
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={increaseCellSize}
              className="h-8 w-8 p-0"
            >
              +
            </Button>
          </div>
          
          {/* Controles para rango horario */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Rango horario:</span>
            
            {/* Selector de hora inicio */}
            <div className="flex items-center space-x-1">
              <Select 
                value={startHour.toString()} 
                onValueChange={(value) => {
                  const hour = parseInt(value, 10);
                  if (hour < endHour || (hour >= 24 && endHour >= 24)) {
                    setStartHour(hour);
                    setSelectedCellsByEmployee(new Map());
                  }
                }}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue placeholder="Inicio" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: 24}, (_, i) => (
                    <SelectItem key={`start-${i}`} value={i.toString()}>
                      {i < 10 ? `0${i}:00` : `${i}:00`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <span className="text-sm">a</span>
              
              {/* Selector de hora fin */}
              <Select 
                value={endHour > 23 ? (endHour - 24).toString() + "-next" : endHour.toString()} 
                onValueChange={(value) => {
                  let hour;
                  if (value.endsWith("-next")) {
                    hour = parseInt(value.split("-")[0], 10) + 24;
                  } else {
                    hour = parseInt(value, 10);
                  }
                  
                  if (hour > startHour || (hour < startHour && hour + 24 > startHour)) {
                    setEndHour(hour);
                    setSelectedCellsByEmployee(new Map());
                  }
                }}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue placeholder="Fin" />
                </SelectTrigger>
                <SelectContent>
                  {/* Opciones del mismo día */}
                  {Array.from({length: 24}, (_, i) => (
                    <SelectItem key={`end-${i}`} value={i.toString()}>
                      {i < 10 ? `0${i}:00` : `${i}:00`}
                    </SelectItem>
                  ))}
                  {/* Opciones del día siguiente (marcadas) */}
                  {Array.from({length: 12}, (_, i) => (
                    <SelectItem key={`end-next-${i}`} value={`${i}-next`}>
                      {i < 10 ? `0${i}:00` : `${i}:00`} +1
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Botón de Exportaciones */}
          <div className="flex items-center">
            <ExportsModal 
              employees={employees} 
              shifts={shifts} 
              currentDate={date} 
            />
          </div>
        </div>
        
        <div className="flex items-center">
          {hasSelections && (
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSaveSelections}
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar Turnos Seleccionados
            </Button>
          )}
        </div>
      </div>
      
      {/* Schedule table with drag and drop */}
      <DragDropContext 
        onDragEnd={handleDragEnd}
        onDragUpdate={handleDragUpdate}
      >
        <div 
          className="overflow-x-auto border border-neutral-200 rounded select-none w-full touch-container"
          style={{ 
            touchAction: "pan-y", 
            WebkitOverflowScrolling: "touch", 
            width: "100%",
            maxWidth: "100vw"
          }}>
          <table className="w-full border-collapse table-fixed" style={{ minWidth: "100%" }}>
            {/* Table Header - Estructura de dos filas */}
            <thead>
              {/* Primera fila: Horas agrupadas */}
              <tr>
                <th className="sticky-corner border-b border-r border-neutral-200 p-1 bg-neutral-100 text-center"
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 30,
                      backgroundColor: 'white',
                      boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                      height: `${cellSize}px`,
                      lineHeight: `${cellSize}px`,
                      minWidth: "150px",
                      width: "150px"
                    }}>
                  <span className="text-xs font-semibold">Empleados</span>
                </th>
                
                {/* Agrupar cada 4 celdas (1 hora) */}
                {timeSlots.filter(time => time.endsWith(':00')).map((hour) => {
                  const hourValue = hour.split(':')[0];
                  return (
                    <th 
                      key={hour}
                      colSpan={4} // Abarca 4 celdas (00, 15, 30, 45)
                      className="border-b border-neutral-200 p-0 text-center bg-neutral-50"
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 20,
                        backgroundColor: 'white',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                        height: `${cellSize}px`,
                        width: `${cellSize * 4}px`, // 4 celdas de ancho
                        lineHeight: `${cellSize}px`,
                        boxSizing: "border-box",
                        borderLeft: '2px solid #AAAAAA'
                      }}
                    >
                      <div className="flex justify-center items-center h-full">
                        <div className="text-[0.6rem] font-bold tracking-tight">{hourValue}h</div>
                      </div>
                    </th>
                  );
                })}
              </tr>
              
              {/* Fila de Totales */}
              <tr>
                <th 
                  className="sticky-corner border-b border-r border-neutral-200 p-0"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 30,
                    backgroundColor: '#F3F4F6',
                    boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                    height: `${cellSize}px`,
                    lineHeight: `${cellSize}px`,
                    minWidth: "150px",
                    width: "150px"
                  }}
                >
                  <div className="flex justify-center items-center h-full">
                    <div className="text-[0.5rem] font-semibold">Personal</div>
                  </div>
                </th>
                
                {timeSlots.map((time) => {
                  // Calcular personal en cada intervalo
                  const assignedCount = shifts.filter(shift => {
                    return (
                      shift.date === formatDateForAPI(date) && 
                      isTimeBetween(time, shift.startTime, shift.endTime)
                    );
                  }).length;
                  
                  // Contar selecciones actuales
                  let selectedCount = 0;
                  for (const employee of employees) {
                    const isCellCurrent = isCellSelected(employee.id, time);
                    if (isCellCurrent && !isCellAssigned(employee.id, time)) {
                      selectedCount++;
                    }
                  }
                  
                  const totalCount = assignedCount + selectedCount;
                  
                  // Estilos para totales
                  const backgroundColor = totalCount > 0 
                    ? 'rgba(229, 231, 235, 0.5)' 
                    : 'white';
                  
                  return (
                    <th 
                      key={`total-${time}`}
                      className={`border-b border-neutral-200 p-0 text-center ${
                        time.endsWith(':00') ? 'hour-marker' : ''
                      }`}
                      style={{
                        position: 'sticky',
                        top: `${cellSize}px`,
                        zIndex: 20,
                        backgroundColor,
                        width: `${cellSize}px`,
                        height: `${cellSize}px`,
                        lineHeight: `${cellSize}px`,
                        boxSizing: "border-box",
                        borderLeft: time.endsWith(':00') ? '2px solid #AAAAAA' : 
                                  time.endsWith(':30') ? '1px solid #DDDDDD' : 
                                  '1px dashed #EEEEEE'
                      }}
                    >
                      {totalCount > 0 && (
                        <div className="flex justify-center items-center h-full">
                          <div className="text-[0.5rem] font-bold text-gray-900">
                            {totalCount}
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
              
              {/* Segunda fila: Intervalos de 15 minutos */}
              <tr>
                <th className="sticky-corner border-b border-r border-neutral-200 p-1 bg-neutral-50"
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 30,
                      backgroundColor: 'white',
                      boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                      height: `${cellSize}px`,
                      lineHeight: `${cellSize}px`,
                      minWidth: "150px",
                      width: "150px"
                    }}>
                </th>
                
                {timeSlots.map((time) => {
                  const minutes = time.split(':')[1];
                  return (
                    <th 
                      key={time}
                      className={`border-b border-neutral-200 p-0 text-center time-cell ${
                        time.endsWith(':00') ? 'hour-marker' : ''
                      }`}
                      style={{
                        position: 'sticky',
                        top: `${cellSize * 2}px`, // Debajo de las dos filas
                        zIndex: 20,
                        backgroundColor: 'white',
                        width: `${cellSize}px`,
                        height: `${cellSize}px`,
                        lineHeight: `${cellSize}px`,
                        boxSizing: "border-box",
                        borderLeft: time.endsWith(':00') ? '2px solid #AAAAAA' : 
                                  time.endsWith(':30') ? '1px solid #DDDDDD' : 
                                  '1px dashed #EEEEEE'
                      }}
                    >
                      <div className="text-[0.45rem] text-gray-500 font-medium">
                        {minutes}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            
            <tbody>
              {/* Filas de empleados */}
              {employees.map((employee) => {
                // Calcular horas semanales
                const weeklyHours = calculateWeeklyHours(employee);
                
                return (
                  <tr key={employee.id}>
                    {/* Celda con información del empleado */}
                    <td 
                      className="sticky-left border-r border-neutral-200 p-1"
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        backgroundColor: 'white',
                        boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                        maxWidth: "150px",
                        width: "150px",
                        height: `${cellSize * 2}px`, // Altura doble para turnos y área de selección
                      }}
                    >
                      <div className="h-full flex flex-col justify-center">
                        <div className="overflow-hidden text-ellipsis">
                          <span className="font-medium text-xs">{employee.name}</span>
                          {employee.maxHoursPerWeek && (
                            <div className="mt-1 flex items-center text-[0.5rem]">
                              <span className={`font-bold ${
                                weeklyHours.remainingHours <= 0 
                                  ? 'text-red-500' 
                                  : weeklyHours.remainingHours < 8 
                                    ? 'text-amber-500' 
                                    : 'text-green-600'
                              }`}>
                                {weeklyHours.workedHours}/{weeklyHours.maxWeeklyHours}h
                              </span>
                              <span className="ml-1 text-gray-500">
                                ({weeklyHours.remainingHours}h restantes)
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Área para mostrar turnos arrastrados */}
                        <div className="mt-2">
                          <Droppable 
                            droppableId={`employee-${employee.id}`} 
                            direction="horizontal"
                            isDropDisabled={true}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="employee-shifts flex gap-1 overflow-hidden"
                              >
                                {shiftsByEmployee[employee.id]?.map((shift, index) => (
                                  <BeautifulDraggableShift
                                    key={shift.id}
                                    shift={shift}
                                    employee={employee}
                                    index={index}
                                    cellSize={cellSize}
                                    timeSlots={timeSlots}
                                    getShiftWidth={getShiftWidth}
                                    onDelete={onDeleteShift}
                                  />
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      </div>
                    </td>
                    
                    {/* Celdas de tiempo para el empleado */}
                    {timeSlots.map((time, timeIndex) => {
                      // Verificar si la celda está asignada a un turno
                      const isAssigned = isCellAssigned(employee.id, time);
                      
                      // Verificar si es la primera celda de un turno
                      const isFirstCell = isFirstCellOfShift(employee.id, time);
                      
                      // Verificar si la celda está seleccionada
                      const isSelected = isCellSelected(employee.id, time);
                      
                      // Verificar si se está arrastrando sobre esta celda
                      const isDragOver = dragOverCells?.employeeId === employee.id && dragOverCells?.time === time;
                      
                      // Estilo para la celda
                      const cellStyle: React.CSSProperties = {
                        width: `${cellSize}px`,
                        height: `${cellSize * 2}px`, // Altura doble para área de turno y celda
                        borderLeft: time.endsWith(':00') ? '2px solid #AAAAAA' : 
                                  time.endsWith(':30') ? '1px solid #DDDDDD' : 
                                  '1px dashed #EEEEEE',
                        padding: 0,
                        position: 'relative',
                        verticalAlign: 'top',
                        backgroundColor: isDragOver 
                          ? 'rgba(76, 175, 80, 0.2)' 
                          : isSelected 
                            ? 'rgba(76, 175, 80, 0.15)' 
                            : 'transparent',
                        cursor: isAssigned ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s'
                      };
                      
                      // Si este es un destino válido para soltar
                      const droppableId = `${employee.id}-${time}`;
                      
                      return (
                        <td 
                          key={`${employee.id}-${time}`}
                          style={cellStyle}
                          onClick={() => !isAssigned && toggleCellSelection(employee.id, time)}
                          className={`time-cell ${isSelected ? 'selected-cell' : ''}`}
                        >
                          <Droppable
                            droppableId={droppableId}
                            isDropDisabled={isAssigned}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`h-full w-full ${
                                  snapshot.isDraggingOver ? 'bg-green-100' : ''
                                }`}
                                style={{
                                  transition: 'background-color 0.2s'
                                }}
                              >
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              
              {/* Fila final con resumen de costos */}
              {hourlyEmployeeCost > 0 && estimatedDailySales > 0 && (
                <tr className="totals-row">
                  <td 
                    className="border-t border-r border-neutral-200 p-1 bg-neutral-50 font-medium text-xs"
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: 'white',
                      boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                      height: `${cellSize}px`,
                      width: "150px",
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span>Costo (% Ventas)</span>
                    </div>
                  </td>
                  
                  {timeSlots.map((time) => {
                    // Calcular costo por 15 minutos
                    const employeeCount = shifts.filter(shift => 
                      shift.date === formatDateForAPI(date) && 
                      isTimeBetween(time, shift.startTime, shift.endTime)
                    ).length;
                    
                    const cost = employeeCount * hourlyEmployeeCost * 0.25;
                    const totalSlots = timeSlots.length;
                    const salesPer15Min = estimatedDailySales / totalSlots;
                    const costPercentage = salesPer15Min > 0 ? (cost / salesPer15Min) * 100 : 0;
                    
                    // Estilo basado en porcentaje
                    let bgColor = 'transparent';
                    let textColor = 'text-gray-500';
                    
                    if (employeeCount > 0) {
                      if (costPercentage <= 20) {
                        bgColor = 'rgba(220, 252, 231, 0.5)';
                        textColor = 'text-green-700';
                      } else if (costPercentage <= 30) {
                        bgColor = 'rgba(254, 249, 195, 0.5)';
                        textColor = 'text-amber-700';
                      } else {
                        bgColor = 'rgba(254, 226, 226, 0.5)';
                        textColor = 'text-red-700';
                      }
                    }
                    
                    return (
                      <td 
                        key={`cost-${time}`}
                        className={`border-t border-neutral-200 p-0 text-center ${
                          time.endsWith(':00') ? 'hour-marker' : ''
                        }`}
                        style={{
                          backgroundColor: bgColor,
                          height: `${cellSize}px`,
                          width: `${cellSize}px`,
                          borderLeft: time.endsWith(':00') ? '2px solid #AAAAAA' : 
                                    time.endsWith(':30') ? '1px solid #DDDDDD' : 
                                    '1px dashed #EEEEEE',
                        }}
                      >
                        {employeeCount > 0 && (
                          <div className={`text-[0.45rem] font-semibold ${textColor}`}>
                            {costPercentage.toFixed(0)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DragDropContext>
      
      {/* Estilos globales para la tabla ya están en index.css */}
    </div>
  );
}