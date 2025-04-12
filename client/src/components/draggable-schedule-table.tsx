import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Info, Save, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Employee, Shift, InsertShift } from "@shared/schema";
import { 
  formatDateForAPI, generateTimeSlots, isTimeBetween, calculateHoursBetween, 
  formatHours, getStartOfWeek, getEndOfWeek, isInSameWeek, convertTimeToMinutes,
  calculateEndTime
} from "@/lib/date-helpers";
import { useIsMobile } from "@/hooks/use-mobile";
import ExportsModal from './exports-modal';
import DraggableShift from './draggable-shift';
import DroppableCell from './droppable-cell';

interface DraggableScheduleTableProps {
  employees: Employee[];
  shifts: Shift[];
  date: Date;
  onSaveShifts: (selections: {employee: Employee, startTime: string, endTime: string}[]) => void;
  onDeleteShift?: (shiftId: number) => void;
  onMoveShift?: (shiftId: number, newEmployeeId: number, newStartTime: string, newEndTime: string) => void;
  estimatedDailySales?: number;
  hourlyEmployeeCost?: number;
}

export default function DraggableScheduleTable({ 
  employees, 
  shifts, 
  date, 
  onSaveShifts,
  onDeleteShift,
  onMoveShift,
  estimatedDailySales = 0,
  hourlyEmployeeCost = 0
}: DraggableScheduleTableProps) {
  // Estado para el tamaño de las celdas
  const [cellSize, setCellSize] = useState<number>(30);
  
  // Estado para el rango de horas
  const [startHour, setStartHour] = useState<number>(9);
  const [endHour, setEndHour] = useState<number>(23);
  
  // Slots de tiempo basados en el rango de horas
  const timeSlots = generateTimeSlots(startHour, endHour);
  
  // Estado para selecciones de celdas por empleado
  const [selectedCellsByEmployee, setSelectedCellsByEmployee] = useState<Map<number, Set<string>>>(new Map());
  
  // Detector de dispositivo móvil
  const isMobile = useIsMobile();
  
  // Toast para notificaciones
  const { toast } = useToast();
  
  // Referencias
  const mouseDownRef = useRef<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const batchedSelectionsRef = useRef<Map<number, Set<string>> | null>(null);
  const lastTouchUpdateRef = useRef<number>(0);
  
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
  
  // Calcular posición de un turno para su representación visual
  const getShiftPosition = useCallback((employeeId: number, startTime: string): { top: number; left: number } => {
    // Posición vertical: índice del empleado + offset para las filas de encabezado
    const employeeIndex = employees.findIndex(emp => emp.id === employeeId);
    const top = (employeeIndex + 3) * cellSize; // +3 por las tres filas de encabezado
    
    // Posición horizontal: índice del tiempo de inicio + offset para la columna de empleados
    const timeIndex = timeSlots.indexOf(startTime);
    const left = (timeIndex + 1) * cellSize; // +1 por la columna de empleados
    
    return { top, left };
  }, [employees, timeSlots, cellSize]);
  
  // Calcular ancho de un turno basado en su duración
  const getShiftWidth = useCallback((startTime: string, endTime: string): number => {
    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = timeSlots.indexOf(endTime);
    if (startIndex === -1 || endIndex === -1) return cellSize;
    
    const width = (endIndex - startIndex) * cellSize;
    return width > 0 ? width : cellSize;
  }, [timeSlots, cellSize]);
  
  // Obtener el ancho en número de celdas para un turno
  const getShiftCellSpan = useCallback((employeeId: number, startTime: string): number => {
    const shift = getShiftForCell(employeeId, startTime);
    if (!shift) return 1;
    
    const startIndex = timeSlots.indexOf(shift.startTime);
    const endIndex = timeSlots.indexOf(shift.endTime);
    if (startIndex === -1 || endIndex === -1) return 1;
    
    return endIndex - startIndex;
  }, [getShiftForCell, timeSlots]);
  
  // Verificar si una celda es la primera de un turno
  const isFirstCellOfShift = useCallback((employeeId: number, time: string): boolean => {
    const shift = getShiftForCell(employeeId, time);
    return shift ? shift.startTime === time : false;
  }, [getShiftForCell]);
  
  // Toggle de una celda individual
  const toggleSingleCell = (employee: Employee, time: string) => {
    if (isCellAssigned(employee.id, time)) return;
    
    const newSelectedCellsByEmployee = new Map(selectedCellsByEmployee);
    const selectedCells = newSelectedCellsByEmployee.get(employee.id) || new Set<string>();
    
    if (selectedCells.has(time)) {
      selectedCells.delete(time);
      if (selectedCells.size === 0) {
        newSelectedCellsByEmployee.delete(employee.id);
      } else {
        newSelectedCellsByEmployee.set(employee.id, selectedCells);
      }
    } else {
      selectedCells.add(time);
      newSelectedCellsByEmployee.set(employee.id, selectedCells);
    }
    
    setSelectedCellsByEmployee(newSelectedCellsByEmployee);
  };
  
  // Handler para iniciar interacción
  const handleInteractionStart = (employee: Employee, time: string) => {
    if (isCellAssigned(employee.id, time)) return;
    
    mouseDownRef.current = true;
    setIsDragging(true);
    setStartTime(time);
    setActiveEmployee(employee);
    
    toggleSingleCell(employee, time);
    
    batchedSelectionsRef.current = new Map(selectedCellsByEmployee);
  };
  
  // Mouse down handler
  const handleMouseDown = (employee: Employee, time: string) => {
    handleInteractionStart(employee, time);
  };
  
  // Touch start handler
  const handleTouchStart = (e: React.TouchEvent, employee: Employee, time: string) => {
    if (isCellAssigned(employee.id, time)) return;
    
    const touchEvent = e.nativeEvent;
    touchEvent.stopPropagation();
    touchEvent.preventDefault();
    
    mouseDownRef.current = true;
    setIsDragging(true);
    setActiveEmployee(employee);
    setStartTime(time);
    
    console.log(`Toggling celda ${time} para empleado ${employee.id}`);
    toggleSingleCell(employee, time);
    
    batchedSelectionsRef.current = new Map(selectedCellsByEmployee);
    lastTouchUpdateRef.current = Date.now();
  };
  
  // Handler para interacción de celdas durante arrastre
  const handleCellInteraction = (employee: Employee, time: string) => {
    if (!mouseDownRef.current || !isDragging || !activeEmployee || activeEmployee.id !== employee.id) return;
    if (isCellAssigned(employee.id, time)) return;
    
    if (startTime) {
      const startIndex = timeSlots.indexOf(startTime);
      const currentIndex = timeSlots.indexOf(time);
      
      if (startIndex >= 0 && currentIndex >= 0) {
        const newSelectedCellsByEmployee = new Map(selectedCellsByEmployee);
        const minIdx = Math.min(startIndex, currentIndex);
        const maxIdx = Math.max(startIndex, currentIndex);
        const newSelectedCells = new Set<string>();
        
        for (let i = minIdx; i <= maxIdx; i++) {
          const timeSlot = timeSlots[i];
          if (!isCellAssigned(employee.id, timeSlot)) {
            newSelectedCells.add(timeSlot);
          }
        }
        
        if (newSelectedCells.size > 0) {
          newSelectedCellsByEmployee.set(employee.id, newSelectedCells);
        } else {
          newSelectedCellsByEmployee.delete(employee.id);
        }
        
        setSelectedCellsByEmployee(newSelectedCellsByEmployee);
      }
    }
  };
  
  // Mouse enter handler
  const handleMouseEnter = (employee: Employee, time: string) => {
    handleCellInteraction(employee, time);
  };
  
  // Touch move handler
  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || !activeEmployee || !startTime) return;
    e.preventDefault();
    
    const now = Date.now();
    if (now - lastTouchUpdateRef.current < 50) return;
    
    lastTouchUpdateRef.current = now;
    
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    const offsets = [
      [0, 0], [-5, 0], [5, 0], [0, -10], [0, 10],
      [-10, -10], [10, -10], [-10, 10], [10, 10],
    ];
    
    let foundCell = false;
    
    for (const [offsetX, offsetY] of offsets) {
      if (foundCell) break;
      
      const elementUnderTouch = document.elementFromPoint(x + offsetX, y + offsetY);
      
      if (elementUnderTouch?.tagName === 'TD' && elementUnderTouch.hasAttribute('data-cell-id')) {
        const cellId = elementUnderTouch.getAttribute('data-cell-id');
        if (cellId) {
          const [empId, time] = cellId.split('-');
          const empIdNum = parseInt(empId, 10);
          
          if (empIdNum === activeEmployee.id) {
            foundCell = true;
            
            if (batchedSelectionsRef.current) {
              const batch = batchedSelectionsRef.current;
              
              if (time === startTime) {
                const selectedCells = batch.get(activeEmployee.id) || new Set<string>();
                
                if (selectedCells.has(time) && !isCellAssigned(activeEmployee.id, time)) {
                  selectedCells.delete(time);
                  
                  if (selectedCells.size > 0) {
                    batch.set(activeEmployee.id, selectedCells);
                  } else {
                    batch.delete(activeEmployee.id);
                  }
                  
                  setSelectedCellsByEmployee(new Map(batch));
                  return;
                }
              }
              
              const startIndex = timeSlots.indexOf(startTime);
              const currentIndex = timeSlots.indexOf(time);
              
              if (startIndex >= 0 && currentIndex >= 0) {
                const selectedCells = batch.get(activeEmployee.id) || new Set<string>();
                const minIdx = Math.min(startIndex, currentIndex);
                const maxIdx = Math.max(startIndex, currentIndex);
                let hasChanges = false;
                const previousSize = selectedCells.size;
                
                for (let i = minIdx; i <= maxIdx; i++) {
                  const timeSlot = timeSlots[i];
                  if (!isCellAssigned(activeEmployee.id, timeSlot) && !selectedCells.has(timeSlot)) {
                    selectedCells.add(timeSlot);
                    hasChanges = true;
                  }
                }
                
                if (hasChanges || previousSize !== selectedCells.size) {
                  batch.set(activeEmployee.id, selectedCells);
                  setSelectedCellsByEmployee(new Map(batch));
                }
              }
            }
          }
        }
      }
    }
  };
  
  // Añadir manejador de touchmove cuando se está arrastrando
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging, activeEmployee, startTime]);
  
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
        const [aHour, aMinute] = a.split(':').map(Number);
        const [bHour, bMinute] = b.split(':').map(Number);
        return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
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
  
  // Manejar eliminación de turno
  const handleDeleteShift = (shiftId: number) => {
    if (!onDeleteShift) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el turno, función no disponible.",
        variant: "destructive"
      });
      return;
    }
    
    onDeleteShift(shiftId);
    toast({
      title: "Turno eliminado",
      description: "Se ha eliminado el turno correctamente.",
    });
  };
  
  // Manejar movimiento de turno
  const handleMoveShift = (data: {
    shiftId: number;
    sourceEmployeeId: number;
    targetEmployeeId: number;
    startTime: string;
    endTime: string;
    date: string;
  }) => {
    if (!onMoveShift) {
      toast({
        title: "Error",
        description: "No se pudo mover el turno, función no disponible.",
        variant: "destructive"
      });
      return;
    }
    
    onMoveShift(
      data.shiftId,
      data.targetEmployeeId,
      data.startTime,
      data.endTime
    );
    
    toast({
      title: "Turno movido",
      description: "Se ha movido el turno correctamente.",
    });
  };
  
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
  
  // DnD backend basado en el dispositivo
  const dndBackend = isMobile ? TouchBackend : HTML5Backend;
  const dndOptions = isMobile ? { 
    enableMouseEvents: true,
    delayTouchStart: 200, // Tiempo para distinguir entre toque y arrastre
  } : {};
  
  return (
    <DndProvider backend={dndBackend} options={dndOptions}>
      <div className="space-y-4">
        {/* Help message for touch users */}
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-md mb-3 text-sm">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span className="font-medium">Modo táctil:</span> 
          </div>
          <div className="mt-1 ml-6 text-xs">
            • <strong>Un dedo:</strong> Selecciona celdas/turnos - arrastre para seleccionar varias
            <br/>• <strong>Dos dedos:</strong> Desplaza la tabla lateralmente
            <br/>• <strong>Arrastra turno:</strong> Mueve el turno a otro empleado o tiempo
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
        
        {/* Schedule table */}
        <div 
          className="overflow-x-auto border border-neutral-200 rounded select-none w-full touch-container relative"
          style={{ 
            touchAction: "auto", 
            WebkitOverflowScrolling: "touch", 
            width: "100%",
            maxWidth: "100vw"
          }}>
          {/* Contenedor para turnos arrastrables */}
          <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
            {shifts.filter(shift => shift.date === formatDateForAPI(date)).map(shift => {
              const employee = employees.find(emp => emp.id === shift.employeeId);
              if (!employee) return null;
              
              return (
                <DraggableShift 
                  key={`shift-${shift.id}`}
                  shift={shift}
                  employee={employee}
                  cellSize={cellSize}
                  timeSlots={timeSlots}
                  getShiftPosition={getShiftPosition}
                  getShiftWidth={getShiftWidth}
                />
              );
            })}
          </div>
          
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
                        height: `${cellSize}px`,
                      }}
                    >
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
                    </td>
                    
                    {/* Celdas de tiempo para el empleado */}
                    {timeSlots.map((time, timeIndex) => {
                      // Verificar si la celda está asignada a un turno
                      const isAssigned = isCellAssigned(employee.id, time);
                      
                      // Verificar si la celda está seleccionada
                      const isSelected = isCellSelected(employee.id, time);
                      
                      // Verificar si es la primera celda de un turno
                      const isFirstCell = isFirstCellOfShift(employee.id, time);
                      
                      // Obtener el turno si existe
                      const shift = getShiftForCell(employee.id, time);
                      
                      // Determinar si hay que saltar esta celda (ya ocupada por un colSpan)
                      if (isAssigned && !isFirstCell) {
                        return null; // No renderizar esta celda
                      }
                      
                      // Calcular colSpan para turnos asignados
                      let colSpan = 1;
                      
                      if (isFirstCell && shift) {
                        colSpan = getShiftCellSpan(employee.id, time);
                      }
                      
                      return (
                        <DroppableCell
                          key={`${employee.id}-${time}`}
                          employee={employee}
                          time={time}
                          timeSlots={timeSlots}
                          date={formatDateForAPI(date)}
                          isAssigned={isAssigned}
                          isSelected={isSelected}
                          cellSize={cellSize}
                          onDropShift={handleMoveShift}
                          colSpan={colSpan}
                          onMouseDown={(e) => {
                            if (!isAssigned) {
                              handleMouseDown(employee, time);
                            }
                          }}
                          onMouseEnter={() => {
                            if (!isAssigned) {
                              handleMouseEnter(employee, time);
                            }
                          }}
                          onTouchStart={(e) => {
                            if (!isAssigned) {
                              handleTouchStart(e, employee, time);
                            }
                          }}
                        />
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
      </div>
    </DndProvider>
  );
}