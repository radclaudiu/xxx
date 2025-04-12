import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Info, Save, Edit } from 'lucide-react';
import ExportsModal from './exports-modal';
import DeleteShiftDialog from './delete-shift-dialog';
import { 
  formatDateForAPI, 
  generateTimeSlots, 
  isTimeBetween, 
  convertTimeToMinutes, 
  calculateHoursBetween,
  getStartOfWeek,
  getEndOfWeek,
  isInSameWeek
} from '@/lib/date-helpers';
import { Employee, Shift } from '@shared/schema';
import { useIsMobile } from '@/hooks/use-mobile';

interface ScheduleTableProps {
  employees: Employee[];
  shifts: Shift[];
  date: Date;
  onSaveShifts: (selections: {employee: Employee, startTime: string, endTime: string}[]) => void;
  onDeleteShift?: (shiftId: number) => void;
  estimatedDailySales?: number;
  hourlyEmployeeCost?: number;
}

export default function ScheduleTable({ 
  employees, 
  shifts,
  date,
  onSaveShifts,
  onDeleteShift,
  estimatedDailySales = 0,
  hourlyEmployeeCost = 0
}: ScheduleTableProps) {
  const isMobile = useIsMobile();
  
  // Cell size controls
  const [cellSize, setCellSize] = useState(() => {
    // En móviles, usar células más grandes por defecto para facilitar el toque
    return isMobile ? 30 : 28;
  });
  
  const increaseCellSize = () => {
    setCellSize(prev => Math.min(prev + 2, 40));
  };
  
  const decreaseCellSize = () => {
    setCellSize(prev => Math.max(prev - 2, 20));
  };
  
  // Rango horario configurable
  const [startHour, setStartHour] = useState(8); // Por defecto 8:00
  const [endHour, setEndHour] = useState(22);    // Por defecto 22:00
  
  // Generar intervalos de tiempo basados en el rango horario configurado
  const timeSlots = generateTimeSlots(startHour, endHour);
  
  // Format date for API
  const formattedDate = formatDateForAPI(date);
  
  // Store the selected cells for each employee
  const [selectedCellsByEmployee, setSelectedCellsByEmployee] = useState<
    Map<number, Set<string>>
  >(new Map());
  
  // Clear selections when date changes
  useEffect(() => {
    setSelectedCellsByEmployee(new Map());
  }, [date]);
  
  // State for drag selection
  const [isDragging, setIsDragging] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const mouseDownRef = useRef(false);
  
  // Variables para controlar actualizaciones durante arrastre táctil
  const lastTouchUpdateRef = useRef<number>(0);
  const batchedSelectionsRef = useRef<Map<number, Set<string>> | null>(null);
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to check if a cell should be marked as assigned
  const isCellAssigned = (employeeId: number, time: string) => {
    return shifts.some(shift => 
      shift.employeeId === employeeId && 
      shift.date === formattedDate && 
      isTimeBetween(time, shift.startTime, shift.endTime)
    );
  };
  
  // Function to get shift for a cell
  const getShiftForCell = (employeeId: number, time: string) => {
    return shifts.find(shift => 
      shift.employeeId === employeeId && 
      shift.date === formattedDate && 
      isTimeBetween(time, shift.startTime, shift.endTime)
    );
  };
  
  // Function to determine if a cell is the first cell in a shift
  const isFirstCellInShift = (employeeId: number, time: string) => {
    const shift = getShiftForCell(employeeId, time);
    return shift && shift.startTime === time;
  };
  
  // Calcular la duración del turno en número de celdas (15 min cada una)
  const getShiftCellSpan = (employeeId: number, time: string) => {
    const shift = getShiftForCell(employeeId, time);
    if (!shift) return 1;
    
    // Buscar el índice de tiempo de inicio en timeSlots
    const startIndex = timeSlots.indexOf(shift.startTime);
    if (startIndex === -1) return 1; // Si no se encuentra, devolver 1
    
    // Convertir tiempos a minutos para comparar
    const startMinutes = convertTimeToMinutes(shift.startTime);
    const endMinutes = convertTimeToMinutes(shift.endTime);
    
    // Calcular diferencia en minutos
    let diffMinutes = endMinutes - startMinutes;
    
    // Si el horario de fin es anterior al de inicio, asumimos que es del día siguiente
    if (diffMinutes <= 0) {
      diffMinutes += 24 * 60; // Añadir 24 horas en minutos
    }
    
    // Convertir a número de intervalos de 15 minutos
    const intervalCount = Math.ceil(diffMinutes / 15);
    
    // Asegurar que devolvemos al menos 1 celda
    return Math.max(1, intervalCount);
  };
  
  // Handle document-wide mouse/touch up events
  useEffect(() => {
    // Handler for mouse up and touch end events
    const handleEndInteraction = () => {
      setIsDragging(false);
      mouseDownRef.current = false;
      setStartTime(null);
      setActiveEmployee(null);
      
      // Al terminar el arrastre, aplicamos las selecciones en batch si las hay
      if (batchedSelectionsRef.current) {
        setSelectedCellsByEmployee(batchedSelectionsRef.current);
        batchedSelectionsRef.current = null;
      }
      
      // Limpiar cualquier actualización pendiente
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    };
    
    // Prevent text selection during dragging
    const handleSelectStart = (e: Event) => {
      if (isDragging) {
        e.preventDefault();
      }
    };
    
    // Add event listeners
    document.addEventListener('mouseup', handleEndInteraction);
    document.addEventListener('touchend', handleEndInteraction);
    document.addEventListener('selectstart', handleSelectStart);
    
    return () => {
      // Clean up all event listeners
      document.removeEventListener('mouseup', handleEndInteraction);
      document.removeEventListener('touchend', handleEndInteraction);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [isDragging]);
  
  // Toggle a single cell selection
  const toggleSingleCell = (employee: Employee, time: string) => {
    // Create a new Map from the current state for immutability
    const newSelectedCellsByEmployee = new Map(selectedCellsByEmployee);
    
    // Get or create the set of selected cells for this employee
    const selectedCells = newSelectedCellsByEmployee.get(employee.id) || new Set<string>();
    
    // Toggle the cell selection
    if (selectedCells.has(time)) {
      selectedCells.delete(time);
      console.log('Quitando selección de celda:', time); // Debug
    } else {
      selectedCells.add(time);
      console.log('Añadiendo selección de celda:', time); // Debug
    }
    
    // Update the Map with the modified Set
    if (selectedCells.size > 0) {
      newSelectedCellsByEmployee.set(employee.id, selectedCells);
    } else {
      newSelectedCellsByEmployee.delete(employee.id);
    }
    
    setSelectedCellsByEmployee(newSelectedCellsByEmployee);
  };
  
  // Handler for starting an interaction (mouse or touch)
  const handleInteractionStart = (employee: Employee, time: string) => {
    // If cell is already assigned, don't allow selection
    if (isCellAssigned(employee.id, time)) return;
    
    // Establecer estado de arrastre
    mouseDownRef.current = true;
    setIsDragging(true);
    setStartTime(time);
    setActiveEmployee(employee);
    
    // Select or deselect the time slot immediately
    toggleSingleCell(employee, time);
    
    // Inicializar el batch para arrastre
    batchedSelectionsRef.current = new Map(selectedCellsByEmployee);
  };
  
  // Mouse down handler
  const handleMouseDown = (employee: Employee, time: string) => {
    handleInteractionStart(employee, time);
  };
  
  // Touch start handler: añadir o quitar celdas individuales
  const handleTouchStart = (e: React.TouchEvent, employee: Employee, time: string) => {
    // No permitir selección en celdas ya asignadas
    if (isCellAssigned(employee.id, time)) return;
    
    // Detener eventos de propagación
    const touchEvent = e.nativeEvent;
    touchEvent.stopPropagation();
    touchEvent.preventDefault();
    
    // Iniciar estado de arrastre por si el usuario quiere arrastrar después
    mouseDownRef.current = true;
    setIsDragging(true);
    setActiveEmployee(employee);
    setStartTime(time);
    
    // SIMPLEMENTE USAR TOGGLE - funciona tanto para seleccionar como para deseleccionar
    console.log(`Toggling celda ${time} para empleado ${employee.id}`);
    toggleSingleCell(employee, time);
    
    // Inicializar el batch para arrastre
    batchedSelectionsRef.current = new Map(selectedCellsByEmployee);
    lastTouchUpdateRef.current = Date.now();
  };
  
  // Handler for cell interaction during drag
  const handleCellInteraction = (employee: Employee, time: string) => {
    // Only process if we're dragging and it's the same employee
    if (!mouseDownRef.current || !isDragging || !activeEmployee || activeEmployee.id !== employee.id) return;
    
    // If cell is already assigned, don't allow selection
    if (isCellAssigned(employee.id, time)) return;
    
    if (startTime) {
      // Select all cells between startTime and current time
      const startIndex = timeSlots.indexOf(startTime);
      const currentIndex = timeSlots.indexOf(time);
      
      if (startIndex >= 0 && currentIndex >= 0) {
        // Create a new Map from the current state for immutability
        const newSelectedCellsByEmployee = new Map(selectedCellsByEmployee);
        
        // Handle selection in either direction (forward or backward)
        const minIdx = Math.min(startIndex, currentIndex);
        const maxIdx = Math.max(startIndex, currentIndex);
        
        // Create a new set with only the cells in the selected range
        const newSelectedCells = new Set<string>();
        
        for (let i = minIdx; i <= maxIdx; i++) {
          const timeSlot = timeSlots[i];
          // Only add if the cell is not already assigned
          if (!isCellAssigned(employee.id, timeSlot)) {
            newSelectedCells.add(timeSlot);
          }
        }
        
        // Update with the new selection
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
  
  // Touch move handler para mostrar selecciones en tiempo real y permitir deselección
  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || !activeEmployee || !startTime) return;
    e.preventDefault(); // Prevenir desplazamiento de página durante el arrastre
    
    // Aplicar throttling suave para limitar actualizaciones pero mantener feedback visual
    const now = Date.now();
    if (now - lastTouchUpdateRef.current < 50) { // Reducido a 50ms para mejor feedback visual
      return; // Throttling más ligero para que se vean las actualizaciones en tiempo real
    }
    
    lastTouchUpdateRef.current = now;
    
    // Obtener la posición actual del toque
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    // Usar offsets para detectar elementos incluso si el dedo se desvía ligeramente
    const offsets = [
      [0, 0],     // Centro
      [-5, 0],    // Izquierda
      [5, 0],     // Derecha
      [0, -10],   // Arriba
      [0, 10],    // Abajo
      [-10, -10], // Diagonal superior izquierda
      [10, -10],  // Diagonal superior derecha
      [-10, 10],  // Diagonal inferior izquierda
      [10, 10],   // Diagonal inferior derecha
    ];
    
    let foundCell = false;
    
    // Buscar una celda válida bajo el dedo
    for (const [offsetX, offsetY] of offsets) {
      if (foundCell) break; // Salir si ya encontramos una celda válida
      
      const elementUnderTouch = document.elementFromPoint(x + offsetX, y + offsetY);
      
      if (elementUnderTouch?.tagName === 'TD' && elementUnderTouch.hasAttribute('data-cell-id')) {
        const cellId = elementUnderTouch.getAttribute('data-cell-id');
        if (cellId) {
          const [empId, time] = cellId.split('-');
          const empIdNum = parseInt(empId, 10);
          
          // Sólo procesar si es la misma fila/empleado
          if (empIdNum === activeEmployee.id) {
            foundCell = true;
            
            // Actualizar selecciones
            if (batchedSelectionsRef.current) {
              const batch = batchedSelectionsRef.current;
              
              // Al arrastrar de nuevo sobre una celda ya seleccionada, queremos quitarla
              // Pero solo vamos a quitar celdas individuales, no rangos, para evitar comportamiento inesperado
              // durante el arrastre continuo.
              
              // Verificar si es una celda individual (tocar y soltar, no arrastrar)
              if (time === startTime) {
                const selectedCells = batch.get(activeEmployee.id) || new Set<string>();
                
                // Si está seleccionada, quitarla
                if (selectedCells.has(time) && !isCellAssigned(activeEmployee.id, time)) {
                  selectedCells.delete(time);
                  
                  // Actualizar batch
                  if (selectedCells.size > 0) {
                    batch.set(activeEmployee.id, selectedCells);
                  } else {
                    batch.delete(activeEmployee.id);
                  }
                  
                  // Actualizar inmediatamente para feedback visual en tiempo real
                  setSelectedCellsByEmployee(new Map(batch));
                  return; // Terminar después de quitar celda
                }
              }
              
              // Comportamiento de selección normal para arrastre a nuevas celdas
              const startIndex = timeSlots.indexOf(startTime);
              const currentIndex = timeSlots.indexOf(time);
              
              if (startIndex >= 0 && currentIndex >= 0) {
                const selectedCells = batch.get(activeEmployee.id) || new Set<string>();
                
                // Seleccionar rango
                const minIdx = Math.min(startIndex, currentIndex);
                const maxIdx = Math.max(startIndex, currentIndex);
                
                // Bandera para detectar cambios
                let hasChanges = false;
                const previousSize = selectedCells.size;
                
                for (let i = minIdx; i <= maxIdx; i++) {
                  const timeSlot = timeSlots[i];
                  if (!isCellAssigned(activeEmployee.id, timeSlot) && !selectedCells.has(timeSlot)) {
                    selectedCells.add(timeSlot);
                    hasChanges = true;
                  }
                }
                
                // Si hay cambios o el número de celdas cambió, actualizar
                if (hasChanges || previousSize !== selectedCells.size) {
                  batch.set(activeEmployee.id, selectedCells);
                  
                  // Actualizar inmediatamente para feedback visual en tiempo real
                  setSelectedCellsByEmployee(new Map(batch));
                }
              }
            }
          }
        }
      }
    }
  };
  
  // Añadir manejador global para touchmove cuando se está arrastrando
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Determinar si una celda está seleccionada
  const isCellSelected = (employeeId: number, time: string) => {
    const selectedCells = selectedCellsByEmployee.get(employeeId);
    return !!selectedCells && selectedCells.has(time);
  };
  
  // Guardar selecciones como turnos
  const handleSaveSelections = () => {
    const selections: { employee: Employee, startTime: string, endTime: string }[] = [];
    
    for (const [employeeId, times] of selectedCellsByEmployee.entries()) {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) continue;
      
      // Convertir tiempos seleccionados a array y ordenar
      const sortedTimes = Array.from(times).sort((a, b) => {
        return convertTimeToMinutes(a) - convertTimeToMinutes(b);
      });
      
      // Agrupar tiempos consecutivos
      let currentGroup: string[] = [sortedTimes[0]];
      
      for (let i = 1; i < sortedTimes.length; i++) {
        const prevTime = currentGroup[currentGroup.length - 1];
        const currTime = sortedTimes[i];
        
        // Verificar si los tiempos son consecutivos
        const prevIndex = timeSlots.indexOf(prevTime);
        const currIndex = timeSlots.indexOf(currTime);
        
        if (currIndex - prevIndex === 1) {
          // Tiempos consecutivos, agregar al grupo actual
          currentGroup.push(currTime);
        } else {
          // Tiempos no consecutivos, crear un nuevo turno con el grupo actual
          const startTime = currentGroup[0];
          const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
          const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                          timeSlots[lastTimeIndex + 1] : 
                          currentGroup[currentGroup.length - 1];
          
          // Añadir selección
          selections.push({
            employee,
            startTime,
            endTime
          });
          
          // Iniciar nuevo grupo
          currentGroup = [currTime];
        }
      }
      
      // Procesar el último grupo
      if (currentGroup.length > 0) {
        const startTime = currentGroup[0];
        const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
        const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                        timeSlots[lastTimeIndex + 1] : 
                        currentGroup[currentGroup.length - 1];
        
        // Añadir selección del último grupo
        selections.push({
          employee,
          startTime,
          endTime
        });
      }
    }
    
    // Guardar turnos
    onSaveShifts(selections);
    
    // Limpiar selecciones
    setSelectedCellsByEmployee(new Map());
    
    // Mostrar mensaje de éxito
    toast({
      title: "Turnos guardados",
      description: `Se han guardado ${selections.length} turnos.`,
    });
  };
  
  // Check if there are any selections
  const hasSelections = selectedCellsByEmployee.size > 0;
  
  // Función para manejar la eliminación de un turno
  const handleDeleteShift = (shift: Shift) => {
    if (onDeleteShift) {
      onDeleteShift(shift.id);
      toast({
        title: "Turno eliminado",
        description: `Se ha eliminado el turno de ${shift.startTime} a ${shift.endTime}.`,
      });
    } else {
      toast({
        title: "Error",
        description: "No se pudo eliminar el turno, función no disponible.",
        variant: "destructive"
      });
    }
  };
  
  // Calcular las horas semanales trabajadas y restantes para cada empleado
  const calculateWeeklyHours = (employee: Employee) => {
    const currentWeekStart = getStartOfWeek(date);
    const currentWeekEnd = getEndOfWeek(date);
    
    // Inicializar horas trabajadas
    let workedHours = 0;
    
    // Contar horas de turnos ya guardados en la semana actual
    shifts.forEach(shift => {
      if (
        shift.employeeId === employee.id && 
        isInSameWeek(new Date(shift.date), date)
      ) {
        workedHours += calculateHoursBetween(shift.startTime, shift.endTime);
      }
    });
    
    // Contar horas de selecciones actuales no guardadas para hoy
    const selectedTimes = selectedCellsByEmployee.get(employee.id);
    if (selectedTimes && selectedTimes.size > 0) {
      // Convertir tiempos seleccionados a array y ordenar
      const sortedTimes = Array.from(selectedTimes).sort((a, b) => {
        return convertTimeToMinutes(a) - convertTimeToMinutes(b);
      });
      
      // Agrupar tiempos consecutivos
      let currentGroup: string[] = [sortedTimes[0]];
      
      for (let i = 1; i < sortedTimes.length; i++) {
        const prevTime = currentGroup[currentGroup.length - 1];
        const currTime = sortedTimes[i];
        
        // Verificar si los tiempos son consecutivos
        const prevIndex = timeSlots.indexOf(prevTime);
        const currIndex = timeSlots.indexOf(currTime);
        
        if (currIndex - prevIndex === 1) {
          // Tiempos consecutivos, agregar al grupo actual
          currentGroup.push(currTime);
        } else {
          // Tiempos no consecutivos, calcular horas para el grupo actual
          const startTime = currentGroup[0];
          const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
          const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                          timeSlots[lastTimeIndex + 1] : 
                          currentGroup[currentGroup.length - 1];
          
          // Sumar horas de este grupo
          workedHours += calculateHoursBetween(startTime, endTime);
          
          // Iniciar nuevo grupo
          currentGroup = [currTime];
        }
      }
      
      // Procesar el último grupo
      if (currentGroup.length > 0) {
        const startTime = currentGroup[0];
        const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
        const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                        timeSlots[lastTimeIndex + 1] : 
                        currentGroup[currentGroup.length - 1];
        
        // Sumar horas del último grupo
        workedHours += calculateHoursBetween(startTime, endTime);
      }
    }
    
    // Calcular horas restantes
    const maxWeeklyHours = employee.maxHoursPerWeek || 40; // Default 40 si no está definido
    const remainingHours = Math.max(0, maxWeeklyHours - workedHours);
    
    return {
      maxWeeklyHours,
      workedHours: parseFloat(workedHours.toFixed(2)),
      remainingHours: parseFloat(remainingHours.toFixed(2))
    };
  };

  return (
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
          <br/>• <strong>Tocar celda azul:</strong> Abre el diálogo para eliminar turno
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
                  // Validar que la hora de inicio sea menor que la de fin
                  if (hour < endHour || (hour >= 24 && endHour >= 24)) {
                    setStartHour(hour);
                    // Limpiar selecciones al cambiar el rango
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
                  // Si la hora termina con "-next", es del día siguiente
                  if (value.endsWith("-next")) {
                    hour = parseInt(value.split("-")[0], 10) + 24;
                  } else {
                    hour = parseInt(value, 10);
                  }
                  
                  // Validar que la hora de fin sea mayor que la de inicio
                  if (hour > startHour || (hour < startHour && hour + 24 > startHour)) {
                    setEndHour(hour);
                    // Limpiar selecciones al cambiar el rango
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
        className="overflow-x-auto border border-neutral-200 rounded select-none w-full touch-container"
        style={{ 
          touchAction: "auto", // Permitir todos los gestos táctiles
          WebkitOverflowScrolling: "touch", // Mejorar el desplazamiento suave
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
                      width: `${cellSize * 4}px`, // 4 celdas de ancho (00, 15, 30, 45)
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
            
            {/* Fila de Totales (ahora después de las horas y antes de los minutos) */}
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
                // Calcular total de empleados asignados a este intervalo (turnos ya guardados)
                const assignedCount = shifts.filter(shift => {
                  const shiftStartTime = shift.startTime;
                  const shiftEndTime = shift.endTime;
                  return (
                    shift.date === formattedDate && 
                    isTimeBetween(time, shiftStartTime, shiftEndTime)
                  );
                }).length;
                
                // Contar selecciones actuales que no se han guardado
                let selectedCount = 0;
                for (const employee of employees) {
                  // Verificar si este empleado tiene esta celda seleccionada
                  const isCellCurrent = isCellSelected(employee.id, time);
                  
                  // Si la celda está seleccionada pero no asignada, aumentamos el contador
                  if (isCellCurrent && !isCellAssigned(employee.id, time)) {
                    selectedCount++;
                  }
                }
                
                // Total combinado: asignaciones guardadas + selecciones actuales
                const totalCount = assignedCount + selectedCount;
                
                // Determinar color y fondo según el tipo de conteo
                const backgroundColor = selectedCount > 0 
                  ? 'rgba(229, 231, 235, 0.5)' // Gris claro para selecciones actuales
                  : assignedCount > 0 
                    ? 'rgba(229, 231, 235, 0.5)' // El mismo gris para asignaciones
                    : 'white';
                
                const textColor = selectedCount > 0 
                  ? 'text-gray-900' // Texto oscuro para todos
                  : 'text-gray-900';
                
                return (
                  <th 
                    key={`total-${time}`}
                    className={`border-b border-neutral-200 p-0 text-center ${
                      time.endsWith(':00') ? 'hour-marker' : ''
                    }`}
                    style={{
                      position: 'sticky',
                      top: `${cellSize}px`, // Justo debajo de la primera fila
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
                    {/* Mostrar contador cuando hay algún total */}
                    {totalCount > 0 && (
                      <div className="flex justify-center items-center h-full">
                        <div className={`text-[0.5rem] font-bold ${textColor}`}>
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
                      top: `${cellSize * 2}px`, // Debajo de la fila de horas y la fila de totales
                      zIndex: 20,
                      backgroundColor: 'white',
                      width: `${cellSize}px`, // Ancho dinámico basado en cellSize
                      height: `${cellSize}px`, // Altura dinámica basada en cellSize
                      lineHeight: `${cellSize}px`, // Garantizar altura exacta
                      boxSizing: "border-box", // Incluir bordes en dimensiones
                      borderLeft: time.endsWith(':00') ? '2px solid #AAAAAA' : 
                               time.endsWith(':30') ? '1px solid #DDDDDD' : 
                               '1px dashed #EEEEEE'
                    }}
                  >
                    <div 
                      className="text-[0.5rem] font-medium opacity-50"
                    >
                      {minutes}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const weeklyHours = calculateWeeklyHours(employee);
              
              return (
                <tr key={employee.id}>
                  {/* Primera columna: Nombre y datos del empleado */}
                  <td 
                    className="border-b border-r border-neutral-200 p-1 bg-white"
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                      backgroundColor: 'white'
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{employee.name}</span>
                      <span className="text-xs text-gray-500 truncate">{employee.role || 'Sin rol'}</span>
                      <div className="mt-1 flex flex-col">
                        <span className="text-xs text-blue-600">
                          {weeklyHours.workedHours} / {weeklyHours.maxWeeklyHours}h
                        </span>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ 
                              width: `${Math.min(100, (weeklyHours.workedHours / weeklyHours.maxWeeklyHours) * 100)}%`,
                              transition: 'width 0.3s ease-in-out'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Celdas de tiempo */}
                  {timeSlots.map((time, idx) => {
                    const isSelected = isCellSelected(employee.id, time);
                    const isAssigned = isCellAssigned(employee.id, time);
                    const shift = getShiftForCell(employee.id, time);
                    const isFirstCell = isFirstCellInShift(employee.id, time);
                    
                    // Si ya hay un turno asignado que inicia con esta celda, calcular el colspan
                    const cellSpan = isFirstCell ? getShiftCellSpan(employee.id, time) : 1;
                    
                    // Si no es la primera celda de un turno ya asignado, no renderizar
                    if (isAssigned && !isFirstCell) {
                      return null;
                    }
                    
                    // Clase para celda seleccionada
                    const selectedClass = isSelected ? 'bg-blue-100 hover:bg-blue-200' : 'hover:bg-gray-100';
                    
                    // Clase para celda con turno asignado
                    const assignedClass = isAssigned ? 'bg-blue-500 text-white hover:bg-blue-600' : selectedClass;
                    
                    // Borde izquierdo para marcar horas
                    const borderLeftClass = time.endsWith(':00') 
                      ? 'border-l-2 border-l-gray-400'
                      : time.endsWith(':30')
                        ? 'border-l border-l-gray-300'
                        : 'border-l border-l-gray-200';
                    
                    return (
                      <td 
                        key={`${employee.id}-${time}`}
                        data-cell-id={`${employee.id}-${time}`}
                        colSpan={cellSpan}
                        className={`border-b border-neutral-200 p-0 relative ${assignedClass} ${borderLeftClass} transition-colors`}
                        style={{
                          width: `${cellSize}px`,
                          height: `${cellSize * 1.5}px`, // Hacer celdas más altas para empleados
                          cursor: isAssigned ? 'default' : 'pointer',
                          userSelect: 'none',
                          touchAction: 'none' // Disables browser handling of touch events
                        }}
                        onClick={(e) => {
                          // Comportamiento normal de selección para todas las celdas libres
                          if (!isAssigned) {
                            console.log('Click en celda:', time, 'estado actual:', isSelected ? 'seleccionada' : 'no seleccionada');
                            toggleSingleCell(employee, time);
                          }
                        }}
                        onMouseDown={() => {
                          // Solo iniciar arrastre en celdas libres
                          if (!isAssigned) {
                            handleMouseDown(employee, time);
                          }
                        }}
                        onMouseEnter={() => handleMouseEnter(employee, time)}
                        onTouchStart={(e) => {
                          // Comportamiento normal de selección para todas las celdas libres
                          if (!isAssigned) {
                            handleTouchStart(e, employee, time);
                          }
                        }}
                      >
                        {isFirstCell && shift && (
                          <div 
                            className="flex items-center justify-between h-full w-full px-1 py-0.5"
                          >
                            <span className="text-xs font-medium truncate min-w-0 flex-1">
                              {shift.startTime} - {shift.endTime}
                            </span>
                            <DeleteShiftDialog
                              shift={shift}
                              onConfirm={handleDeleteShift}
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Resumen de costes (basado en ventas estimadas y coste por hora) */}
      {estimatedDailySales > 0 && hourlyEmployeeCost > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold mb-2">Análisis de Costes (Estimado)</h3>
          
          {/* Cálculo de horas totales y coste */}
          {(() => {
            // Total de horas asignadas para este día
            let totalHours = 0;
            
            // Sumar horas de turnos ya guardados
            shifts.forEach(shift => {
              if (shift.date === formattedDate) {
                totalHours += calculateHoursBetween(shift.startTime, shift.endTime);
              }
            });
            
            // Sumar horas de selecciones actuales no guardadas
            for (const [employeeId, times] of selectedCellsByEmployee.entries()) {
              // Convertir tiempos seleccionados a array y ordenar
              const sortedTimes = Array.from(times).sort((a, b) => {
                return convertTimeToMinutes(a) - convertTimeToMinutes(b);
              });
              
              // Agrupar tiempos consecutivos
              let currentGroup: string[] = [sortedTimes[0]];
              
              for (let i = 1; i < sortedTimes.length; i++) {
                const prevTime = currentGroup[currentGroup.length - 1];
                const currTime = sortedTimes[i];
                
                // Verificar si los tiempos son consecutivos
                const prevIndex = timeSlots.indexOf(prevTime);
                const currIndex = timeSlots.indexOf(currTime);
                
                if (currIndex - prevIndex === 1) {
                  // Tiempos consecutivos, agregar al grupo actual
                  currentGroup.push(currTime);
                } else {
                  // Tiempos no consecutivos, calcular horas para el grupo actual
                  const startTime = currentGroup[0];
                  const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
                  const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                                timeSlots[lastTimeIndex + 1] : 
                                currentGroup[currentGroup.length - 1];
                  
                  // Sumar horas de este grupo
                  totalHours += calculateHoursBetween(startTime, endTime);
                  
                  // Iniciar nuevo grupo
                  currentGroup = [currTime];
                }
              }
              
              // Procesar el último grupo
              if (currentGroup.length > 0) {
                const startTime = currentGroup[0];
                const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
                const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                              timeSlots[lastTimeIndex + 1] : 
                              currentGroup[currentGroup.length - 1];
                
                // Sumar horas del último grupo
                totalHours += calculateHoursBetween(startTime, endTime);
              }
            }
            
            // Calcular coste total
            const totalCost = totalHours * hourlyEmployeeCost;
            
            // Calcular porcentaje de ventas que va a personal
            const percentOfSales = estimatedDailySales > 0 
              ? (totalCost / estimatedDailySales) * 100 
              : 0;
            
            // Determinr color basado en el porcentaje
            let costColor = "text-green-600";
            if (percentOfSales > 25) costColor = "text-yellow-600";
            if (percentOfSales > 35) costColor = "text-orange-600";
            if (percentOfSales > 40) costColor = "text-red-600";
            
            return (
              <div className="text-sm grid grid-cols-2 gap-2">
                <div>
                  <p>Horas totales: <span className="font-semibold">{totalHours.toFixed(2)}</span></p>
                  <p>Coste estimado: <span className="font-semibold">${totalCost.toFixed(2)}</span></p>
                </div>
                <div>
                  <p>Ventas estimadas: <span className="font-semibold">${estimatedDailySales.toFixed(2)}</span></p>
                  <p>% de ventas en personal: <span className={`font-semibold ${costColor}`}>{percentOfSales.toFixed(2)}%</span></p>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}