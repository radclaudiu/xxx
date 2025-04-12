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
  }, [isDragging, activeEmployee, startTime]);
  
  // Check if a cell is selected
  const isCellSelected = (employeeId: number, time: string) => {
    const selectedCells = selectedCellsByEmployee.get(employeeId);
    return selectedCells ? selectedCells.has(time) : false;
  };
  
  // Handle save button click
  const handleSaveSelections = () => {
    const selections: { employee: Employee, startTime: string, endTime: string }[] = [];
    
    // Process each employee's selections
    selectedCellsByEmployee.forEach((selectedTimes, employeeId) => {
      if (selectedTimes.size === 0) return;
      
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) return;
      
      // Convert selected times to array and sort them
      const sortedTimes = Array.from(selectedTimes).sort((a, b) => {
        const [aHour, aMinute] = a.split(':').map(Number);
        const [bHour, bMinute] = b.split(':').map(Number);
        return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
      });
      
      if (sortedTimes.length === 0) return;
      
      // Group consecutive times
      let currentGroup: string[] = [sortedTimes[0]];
      
      for (let i = 1; i < sortedTimes.length; i++) {
        const prevTime = currentGroup[currentGroup.length - 1];
        const currTime = sortedTimes[i];
        
        // Check if times are consecutive
        const prevIndex = timeSlots.indexOf(prevTime);
        const currIndex = timeSlots.indexOf(currTime);
        
        if (currIndex - prevIndex === 1) {
          // Times are consecutive, add to current group
          currentGroup.push(currTime);
        } else {
          // Times are not consecutive, save current group and start a new one
          const startTime = currentGroup[0];
          const lastTimeIndex = timeSlots.indexOf(currentGroup[currentGroup.length - 1]);
          // For end time, we need the next slot after the last one
          const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                          timeSlots[lastTimeIndex + 1] : 
                          currentGroup[currentGroup.length - 1];
          
          selections.push({
            employee,
            startTime,
            endTime
          });
          
          // Start new group
          currentGroup = [currTime];
        }
      }
      
      // Process the last group
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
    
    // Call the provided save function with the processed selections
    if (selections.length > 0) {
      onSaveShifts(selections);
      
      // Clear selections after saving
      setSelectedCellsByEmployee(new Map());
    }
  };
  
  // Check if there are any selections
  const hasSelections = selectedCellsByEmployee.size > 0;
  
  // Manejar la eliminación de un turno
  const handleDeleteShift = (shift: Shift) => {
    if (!onDeleteShift) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el turno, función no disponible.",
        variant: "destructive"
      });
      return;
    }
    
    onDeleteShift(shift.id);
    toast({
      title: "Turno eliminado",
      description: `Se ha eliminado el turno de ${shift.startTime} a ${shift.endTime}.`,
    });
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
                    shift.date === formatDateForAPI(date) && 
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
                    {/* Mostrar minuto para todos los intervalos */}
                    <div className="flex justify-center items-center h-full">
                      <div className="text-[0.45rem] tracking-tighter text-gray-500">{minutes}</div>
                    </div>
                  </th>
                );
              })}
            </tr>
            

          </thead>

          {/* Table Body */}
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="employee-row">
                <td 
                  className="border-b border-r border-neutral-200 p-0 bg-white"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    backgroundColor: 'white',
                    boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                    height: `${cellSize}px`,
                    minWidth: "150px", // Un poco más ancho para acomodar la información adicional
                    width: "150px",
                    padding: 0
                  }}
                >
                  <div className="flex items-center h-full" style={{width: "100%"}}>
                    {/* Celda principal del empleado */}
                    <div className="flex justify-between items-center h-full px-1" 
                      style={{
                        width: "110px",
                        borderRight: "1px dashed #EEEEEE",
                        overflow: "hidden"
                      }}
                    >
                      <span className="truncate text-xs font-medium pr-1" style={{maxWidth: "95px", display: "block"}}>{employee.name}</span>
                      <button className="text-neutral-400 hover:text-neutral-600 flex-shrink-0 p-0">
                        <Edit className="h-3 w-3" />
                      </button>
                    </div>
                    
                    {/* Celda que muestra las horas semanales restantes */}
                    {(() => {
                      const { maxWeeklyHours, workedHours, remainingHours } = calculateWeeklyHours(employee);
                      
                      // Determinar color basado en horas restantes
                      const remainingPercentage = (remainingHours / maxWeeklyHours) * 100;
                      const textColor = 
                        remainingPercentage <= 10 ? "text-red-600" :
                        remainingPercentage <= 25 ? "text-amber-600" :
                        "text-blue-600";
                      
                      return (
                        <div className="flex flex-col justify-center items-center h-full px-1" 
                          style={{
                            width: "30px",
                            boxSizing: "border-box",
                            overflow: "hidden"
                          }}
                        >
                          <span className={`text-[0.45rem] ${textColor} font-semibold`} 
                            title={`${remainingHours}h restantes de ${maxWeeklyHours}h semanales`}>
                            {remainingHours}h
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </td>
                
                {(() => {
                  // Usamos un array temporal para llevar control de las celdas que debemos saltarnos
                  // porque ya están incluidas en un colSpan
                  const skipCells: {[key: string]: boolean} = {};
                  
                  return timeSlots.map((time, timeIndex) => {
                    // Si esta celda debe ser saltada, no renderizamos nada
                    if (skipCells[time]) {
                      return null;
                    }
                    
                    const isAssigned = isCellAssigned(employee.id, time);
                    const isFirstCell = isFirstCellInShift(employee.id, time);
                    const shift = isFirstCell ? getShiftForCell(employee.id, time) : null;
                    const isSelected = isCellSelected(employee.id, time);
                    
                    // Si es la primera celda de un turno, calculamos cuántas celdas debe ocupar
                    let colSpan = 1;
                    if (isFirstCell && shift) {
                      colSpan = getShiftCellSpan(employee.id, time);
                      
                      // Marcar las siguientes celdas como "saltadas"
                      for (let i = 1; i < colSpan && timeIndex + i < timeSlots.length; i++) {
                        skipCells[timeSlots[timeIndex + i]] = true;
                      }
                    }
                    
                    return (
                      <td 
                        key={`${employee.id}-${time}`}
                        data-cell-id={`${employee.id}-${time}`}
                        colSpan={colSpan}
                        className={`time-cell ${
                          isAssigned ? 'assigned' : ''
                        } ${isSelected ? 'selected' : ''} ${
                          time.endsWith(':00') ? 'hour-marker' : ''
                        }`}
                        style={{
                          width: `${cellSize * colSpan}px`, // Ancho dinámico basado en cellSize y colSpan
                          height: `${cellSize}px`, // Altura dinámica basada en cellSize
                          lineHeight: `${cellSize}px`, // Garantizar altura exacta
                          padding: "0", // Sin padding para mantener tamaño exacto
                          boxSizing: "border-box", // Incluir bordes en dimensiones
                          backgroundColor: isSelected ? 'rgba(76, 175, 80, 0.4)' : 
                                          isAssigned ? 'rgba(25, 118, 210, 0.2)' : 
                                          'transparent',
                          borderTop: isSelected ? '1px solid #4CAF50' : 
                                   isAssigned ? '1px solid #1976D2' : '1px solid #E0E0E0',
                          borderRight: isSelected ? '1px solid #4CAF50' : 
                                      isAssigned ? '1px solid #1976D2' : '1px solid #E0E0E0',
                          borderBottom: isSelected ? '1px solid #4CAF50' : 
                                       isAssigned ? '1px solid #1976D2' : '1px solid #E0E0E0',
                          borderLeft: time.endsWith(':00') ? '2px solid #AAAAAA' : 
                                     time.endsWith(':30') ? '1px solid #DDDDDD' : 
                                     '1px dashed #EEEEEE',
                          cursor: 'pointer',
                          WebkitUserSelect: 'none',  // Safari
                          MozUserSelect: 'none',     // Firefox
                          msUserSelect: 'none',      // IE/Edge
                          userSelect: 'none',        // Standard
                          touchAction: 'none',       // Prevenir desplazamiento en celdas individuales
                          WebkitTapHighlightColor: 'transparent' // Quitar resaltado al tocar
                        }}
                        onMouseDown={(e) => {
                          // No activar selección si la celda ya tiene un turno asignado
                          if (!isAssigned) {
                            handleMouseDown(employee, time);
                          } else if (isFirstCell && shift && onDeleteShift) {
                            // Mostrar opciones contextuales si es un turno existente
                            e.preventDefault();
                            if (window.confirm(`¿Desea eliminar el turno de ${shift.startTime} a ${shift.endTime}?`)) {
                              handleDeleteShift(shift);
                            }
                          }
                        }}
                        onMouseEnter={() => {
                          if (!isAssigned) {
                            handleMouseEnter(employee, time);
                          }
                        }}
                        onClick={(e) => {
                          // Usar toggleSingleCell para añadir o quitar celdas
                          if (!isAssigned) {
                            console.log('Click en celda:', time, 'estado actual:', isSelected ? 'seleccionada' : 'no seleccionada');
                            toggleSingleCell(employee, time);
                          } else if (isFirstCell && shift && onDeleteShift) {
                            // Mostrar opciones para eliminar turno existente (celdas azules)
                            e.preventDefault();
                            if (window.confirm(`¿Desea eliminar el turno de ${shift.startTime} a ${shift.endTime}?`)) {
                              handleDeleteShift(shift);
                            }
                          }
                        }}
                        onTouchStart={(e) => {
                          // Comportamiento normal de selección para todas las celdas libres
                          if (!isAssigned) {
                            handleTouchStart(e, employee, time);
                          } else if (isFirstCell && shift && onDeleteShift) {
                            // Mostrar opciones contextuales si es un turno existente
                            e.preventDefault();
                            // Solo una confirmación simple para eliminación en móvil
                            if (window.confirm(`¿Desea eliminar el turno de ${shift.startTime} a ${shift.endTime}?`)) {
                              handleDeleteShift(shift);
                            }
                          }
                        }}
                      >
                        {isFirstCell && shift && (
                          <div 
                            className="flex items-center justify-center h-full w-full overflow-hidden"
                            style={{
                              fontSize: "0.55rem",
                              fontWeight: "bold",
                              color: "#1565C0",
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              padding: "0 2px"
                            }}
                          >
                            {`${shift.startTime} - ${shift.endTime}`}
                          </div>
                        )}
                      </td>
                    );
                  });
                })()}
              </tr>
            ))}
            
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
                  // Calcular total de empleados en este tiempo
                  const employeeCount = shifts.filter(shift => 
                    shift.date === formatDateForAPI(date) && 
                    isTimeBetween(time, shift.startTime, shift.endTime)
                  ).length;
                  
                  // Costo por 15 minutos (0.25 horas)
                  const cost = employeeCount * hourlyEmployeeCost * 0.25;
                  
                  // Costo como porcentaje de ventas diarias por 15 min
                  // (asumiendo distribución uniforme durante el día)
                  const totalSlots = timeSlots.length;
                  const salesPer15Min = estimatedDailySales / totalSlots;
                  const costPercentage = salesPer15Min > 0 ? (cost / salesPer15Min) * 100 : 0;
                  
                  // Color basado en porcentaje de costo
                  let bgColor = 'transparent';
                  let textColor = 'text-gray-500';
                  
                  if (employeeCount > 0) {
                    if (costPercentage <= 20) {
                      bgColor = 'rgba(220, 252, 231, 0.5)'; // Verde claro
                      textColor = 'text-green-700';
                    } else if (costPercentage <= 30) {
                      bgColor = 'rgba(254, 249, 195, 0.5)'; // Amarillo claro
                      textColor = 'text-amber-700';
                    } else {
                      bgColor = 'rgba(254, 226, 226, 0.5)'; // Rojo claro
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
  );
}