import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shift, Employee } from '@shared/schema';
import { convertTimeToMinutes, calculateHoursBetween, isTimeBetween, getStartOfWeek, getEndOfWeek, isInSameWeek, formatDateForAPI } from '@/lib/date-helpers';

interface ScheduleTableProps {
  employees: Employee[];
  shifts: Shift[];
  date: Date;
  onSaveShifts: (selections: {employee: Employee, startTime: string, endTime: string}[]) => void;
  onDeleteShift?: (shiftId: number) => void;
  estimatedDailySales?: number;
  hourlyEmployeeCost?: number;
  startHour?: number;
  endHour?: number;
  onSaveTimeRange?: (startHour: number, endHour: number) => void;
  isReadOnly?: boolean;
  onEditEmployee?: (employee: Employee) => void;
}

export default function ScheduleTable({
  employees,
  shifts,
  date,
  onSaveShifts,
  onDeleteShift,
  estimatedDailySales,
  hourlyEmployeeCost,
  startHour: initialStartHour = 8,
  endHour: initialEndHour = 22,
  onSaveTimeRange,
  isReadOnly = false,
  onEditEmployee
}: ScheduleTableProps) {
  // Formatted date for API and display
  const formattedDate = formatDateForAPI(date);
  const displayDate = format(date, 'EEEE, dd MMMM yyyy', {locale: es});
  
  // State for cell size
  const [cellSize, setCellSize] = useState(30);
  
  // State for time range
  const [startHour, setStartHour] = useState(initialStartHour);
  const [endHour, setEndHour] = useState(initialEndHour);
  
  // Increase cell size
  const increaseCellSize = () => {
    setCellSize(prev => Math.min(prev + 5, 50));
  };
  
  // Decrease cell size
  const decreaseCellSize = () => {
    setCellSize(prev => Math.max(prev - 5, 20));
  };
  
  // Generate time slots based on start/end hours
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    
    // Adjust for 24-hour rollover
    let adjustedEndHour = endHour;
    if (endHour < startHour) {
      adjustedEndHour += 24; // Add 24 hours
    }
    
    // Generate slots at 15-minute intervals
    for (let hour = startHour; hour < adjustedEndHour; hour++) {
      const displayHour = hour % 24; // To handle 24+ hours
      
      for (let minute = 0; minute < 60; minute += 15) {
        // Skip last entry of the last hour to avoid duplicates with the next day
        if (hour === adjustedEndHour - 1 && minute === 45) continue;
        
        const formattedHour = displayHour.toString().padStart(2, '0');
        const formattedMinute = minute.toString().padStart(2, '0');
        slots.push(`${formattedHour}:${formattedMinute}`);
      }
    }
    
    return slots;
  }, [startHour, endHour]);
  
  // State for selected cells by employee
  const [selectedCellsByEmployee, setSelectedCellsByEmployee] = useState<Map<number, Set<string>>>(
    new Map()
  );
  
  // Function to check if a cell is selected
  const isCellSelected = (employeeId: number, time: string): boolean => {
    const selectedTimes = selectedCellsByEmployee.get(employeeId);
    return selectedTimes ? selectedTimes.has(time) : false;
  };
  
  // Reset selections when date changes
  useEffect(() => {
    setSelectedCellsByEmployee(new Map());
  }, [date]);
  
  // Estado para almacenar las horas restantes calculadas por empleado
  const [employeeRemainingHours, setEmployeeRemainingHours] = useState<Record<number, number>>({});
  
  // Función para calcular horas de la semana (memoizada para mejor rendimiento)
  const calculateWeeklyHours = useCallback((employee: Employee) => {
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
  }, [date, shifts, selectedCellsByEmployee, timeSlots]);
  
  // Efecto para calcular y actualizar las horas restantes de cada empleado
  useEffect(() => {
    // Crear un nuevo objeto para almacenar las horas restantes
    const newRemainingHours: Record<number, number> = {};
    
    // Calcular las horas restantes para cada empleado
    employees.forEach(employee => {
      const { remainingHours } = calculateWeeklyHours(employee);
      newRemainingHours[employee.id] = remainingHours;
    });
    
    // Actualizar el estado con los nuevos valores
    setEmployeeRemainingHours(newRemainingHours);
  }, [employees, shifts, date, selectedCellsByEmployee, calculateWeeklyHours]);
  
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
  
  // State for drag selection
  const [isDragging, setIsDragging] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const mouseDownRef = useRef(false);
  
  // Variables para controlar actualizaciones durante arrastre táctil
  const lastTouchUpdateRef = useRef<number>(0);
  const batchedSelectionsRef = useRef<Map<number, Set<string>> | null>(null);
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado para menú contextual
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    shift: Shift | null;
    x: number;
    y: number;
  }>({
    isOpen: false,
    shift: null,
    x: 0,
    y: 0
  });
  
  // Manejar apertura de menú contextual
  const handleOpenContextMenu = (e: React.MouseEvent | React.TouchEvent, shift: Shift) => {
    // Si está en modo solo lectura, no mostrar el menú contextual
    if (isReadOnly) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // En dispositivos táctiles, obtener coordenadas del toque
    let x = 0;
    let y = 0;
    
    if ('touches' in e) {
      // Es un evento táctil
      const touch = e.touches[0];
      x = touch.clientX;
      y = touch.clientY;
    } else {
      // Es un evento de mouse
      x = (e as React.MouseEvent).clientX;
      y = (e as React.MouseEvent).clientY;
    }
    
    // Cerrar cualquier menú contextual abierto previamente
    setContextMenu(prev => ({
      isOpen: false,
      shift: null,
      x: 0,
      y: 0
    }));
    
    // Retrasar la apertura para evitar conflictos con los eventos táctiles
    setTimeout(() => {
      // Abrir menú contextual
      setContextMenu({
        isOpen: true,
        shift,
        x,
        y
      });
    }, 50);
  };
  
  // Cerrar menú contextual
  const closeContextMenu = () => {
    setContextMenu(prev => ({
      ...prev,
      isOpen: false
    }));
  };
  
  // Eliminar turno cuando se hace clic en la opción correspondiente del menú contextual
  const handleDeleteShift = (shift: Shift) => {
    if (!onDeleteShift) return;
    
    // Close the context menu
    closeContextMenu();
    
    // Eliminar el turno sin mostrar notificación
    onDeleteShift(shift.id);
  };

  // Handle document-wide mouse/touch up events
  useEffect(() => {
    // Handler for mouse up and touch end events
    const handleEndInteraction = () => {
      // Importante: Verificar si batchedSelectionsRef.current es null
      // porque en los clicks simples lo configuramos como null explícitamente
      // para evitar que este manejador interfiera con el toggle de celdas
      if (batchedSelectionsRef.current === null) {
        // Si es null, significa que fue un clic simple para alternar una celda
        // Solo limpiamos el estado de arrastre
        setIsDragging(false);
        mouseDownRef.current = false;
        setStartTime(null);
        setActiveEmployee(null);
        
        // Si es un click único, también podríamos guardar después de un breve retardo
        // para dar tiempo a que el usuario realice múltiples selecciones si así lo desea
        // setTimeout(() => {
        //   handleSaveSelections();
        // }, 1000);
        
        return;
      }
      
      // Si llegamos aquí, este es un fin de arrastre real
      setIsDragging(false);
      mouseDownRef.current = false;
      setStartTime(null);
      setActiveEmployee(null);
      
      // Para arrastres reales, aplicar las selecciones
      if (batchedSelectionsRef.current) {
        // Solo actualizar si hay algo en el batch
        // Guardamos la referencia actual para usarla después de actualizar el estado
        const currentBatch = new Map(batchedSelectionsRef.current);
        
        // Actualizamos el estado con las selecciones actuales
        setSelectedCellsByEmployee(currentBatch);
        
        // Limpiar el batch
        batchedSelectionsRef.current = null;
        
        // Limpiar cualquier actualización pendiente
        if (pendingUpdateRef.current) {
          clearTimeout(pendingUpdateRef.current);
          pendingUpdateRef.current = null;
        }
        
        // Guardamos automáticamente después de un pequeño retardo para dar tiempo
        // a que el estado se actualice completamente
        setTimeout(() => {
          // Procesamos y guardamos las selecciones (similar a handleSaveSelections)
          const selections: { employee: Employee, startTime: string, endTime: string }[] = [];
          
          // Procesamos cada empleado y sus selecciones
          currentBatch.forEach((selectedTimes, employeeId) => {
            if (selectedTimes.size === 0) return;
            
            const employee = employees.find(e => e.id === employeeId);
            if (!employee) return;
            
            // Ordenamos los tiempos seleccionados
            const sortedTimes = Array.from(selectedTimes).sort((a, b) => {
              const [aHour, aMinute] = a.split(':').map(Number);
              const [bHour, bMinute] = b.split(':').map(Number);
              return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
            });
            
            if (sortedTimes.length === 0) return;
            
            // Agrupamos tiempos consecutivos
            let currentGroup: string[] = [sortedTimes[0]];
            
            for (let i = 1; i < sortedTimes.length; i++) {
              const prevTime = currentGroup[currentGroup.length - 1];
              const currTime = sortedTimes[i];
              
              // Verificamos si los tiempos son consecutivos
              const prevIndex = timeSlots.indexOf(prevTime);
              const currIndex = timeSlots.indexOf(currTime);
              
              if (currIndex - prevIndex === 1) {
                // Si son consecutivos, añadimos al grupo actual
                currentGroup.push(currTime);
              } else {
                // Si no son consecutivos, guardamos el grupo actual y comenzamos uno nuevo
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
                
                // Comenzamos un nuevo grupo
                currentGroup = [currTime];
              }
            }
            
            // Procesamos el último grupo
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
          
          // Si hay selecciones, las guardamos
          if (selections.length > 0) {
            onSaveShifts(selections);
            
            // Limpiamos las selecciones después de guardar
            setSelectedCellsByEmployee(new Map());
          }
        }, 100);
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
    // Si está en modo solo lectura, no permitir la selección
    if (isReadOnly) return;
    
    // Create a new Map from the current state for immutability
    const newSelectedCellsByEmployee = new Map(selectedCellsByEmployee);
    
    // Get or create the set of selected cells for this employee
    const selectedCells = newSelectedCellsByEmployee.get(employee.id) || new Set<string>();
    
    // Hacer una copia de las celdas seleccionadas para evitar problemas de referencia
    const selectedCellsCopy = new Set<string>(selectedCells);
    
    // Toggle the cell selection
    if (selectedCellsCopy.has(time)) {
      selectedCellsCopy.delete(time);
      console.log('Quitando selección de celda:', time); // Debug
    } else {
      selectedCellsCopy.add(time);
      console.log('Añadiendo selección de celda:', time); // Debug
    }
    
    // Update the Map with the modified Set
    if (selectedCellsCopy.size > 0) {
      newSelectedCellsByEmployee.set(employee.id, selectedCellsCopy);
    } else {
      newSelectedCellsByEmployee.delete(employee.id);
    }
    
    // Actualizar INMEDIATAMENTE el estado para prevenir que otros eventos lo sobreescriban
    setSelectedCellsByEmployee(newSelectedCellsByEmployee);
    
    // También actualizar la referencia batch para que esté sincronizada
    if (mouseDownRef.current) {
      batchedSelectionsRef.current = newSelectedCellsByEmployee;
    }
  };
  
  // Handler for starting an interaction (mouse or touch)
  const handleInteractionStart = (employee: Employee, time: string) => {
    // Si el componente está en modo de solo lectura, no permitir interacción
    if (isReadOnly) return;
    
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
  
  // Touch start handler: añadir o quitar celdas individuales cuando se usa el arrastre
  const handleTouchStart = (e: React.TouchEvent, employee: Employee, time: string) => {
    // Si el componente está en modo de solo lectura, no permitir interacción
    if (isReadOnly) return;
    
    // No permitir selección en celdas ya asignadas
    if (isCellAssigned(employee.id, time)) return;
    
    // Detener eventos de propagación (pero NO prevenir el comportamiento predeterminado)
    // para permitir eventos táctiles normales
    const touchEvent = e.nativeEvent;
    touchEvent.stopPropagation();
    
    // Iniciar estado de arrastre pero sin activar modo arrastre inmediatamente
    mouseDownRef.current = true;
    setActiveEmployee(employee);
    setStartTime(time);
    
    console.log(`Iniciando arrastre posible en celda ${time} para empleado ${employee.id}`);
    
    // SIMPLEMENTE USAR TOGGLE para añadir la celda inicial
    const newSelectedCellsByEmployee = new Map(selectedCellsByEmployee);
    const selectedCells = newSelectedCellsByEmployee.get(employee.id) || new Set<string>();
    const selectedCellsCopy = new Set<string>(selectedCells);
    
    // SIEMPRE añadir la celda inicial en un arrastre
    selectedCellsCopy.add(time);
    
    // Actualizar mapa
    newSelectedCellsByEmployee.set(employee.id, selectedCellsCopy);
    
    // Actualizar estado inmediatamente
    setSelectedCellsByEmployee(newSelectedCellsByEmployee);
    
    // Iniciar arrastre después de un pequeño retraso
    const timeoutId = setTimeout(() => {
      if (mouseDownRef.current) {
        setIsDragging(true);
        // Inicializar el batch para arrastre con el estado actualizado
        batchedSelectionsRef.current = new Map(selectedCellsByEmployee);
        lastTouchUpdateRef.current = Date.now();
      }
    }, 150); // Tiempo suficiente para iniciar arrastre, pero no tan largo para un tap
    
    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current);
    }
    pendingUpdateRef.current = timeoutId;
  };
  
  // Handler for cell interaction during drag
  const handleCellInteraction = (employee: Employee, time: string) => {
    // Si no está en modo arrastre o es un empleado diferente, no hacer nada
    if (!isDragging || !mouseDownRef.current || !activeEmployee || activeEmployee.id !== employee.id) return;
    
    // Si la celda ya está asignada a un turno, no permitir selección
    if (isCellAssigned(employee.id, time)) return;
    
    // Si batchedSelectionsRef.current es null, significa que no es un arrastre real
    if (!batchedSelectionsRef.current) return;
    
    // Obtener conjunto de celdas seleccionadas para este empleado
    const selectedTimes = batchedSelectionsRef.current.get(employee.id) || new Set<string>();
    
    // Clone the set to avoid mutation issues
    const newSelectedTimes = new Set(selectedTimes);
    
    // Simple toggle for now - more complex logic can be added later
    if (selectedTimes.has(time)) {
      newSelectedTimes.delete(time);
    } else {
      newSelectedTimes.add(time);
    }
    
    // Create a new map with the updated selection
    const newMap = new Map(batchedSelectionsRef.current);
    
    // Update the map with our modified selection
    if (newSelectedTimes.size > 0) {
      newMap.set(employee.id, newSelectedTimes);
    } else {
      newMap.delete(employee.id);
    }
    
    // Update the batch ref
    batchedSelectionsRef.current = newMap;
  };
  
  // Mouse enter handler
  const handleMouseEnter = (employee: Employee, time: string) => {
    if (isDragging && mouseDownRef.current) {
      handleCellInteraction(employee, time);
    }
  };
  
  // Touch move handler - used to track touch movement across cells
  const handleTouchMove = (e: TouchEvent) => {
    // Si no está en modo arrastre o es demasiado pronto para la siguiente actualización, no hacer nada
    if (!isDragging || !mouseDownRef.current || !activeEmployee || !batchedSelectionsRef.current) return;
    
    // Limitar la frecuencia de actualizaciones para mejorar rendimiento
    const now = Date.now();
    if (now - lastTouchUpdateRef.current < 50) return; // Solo actualizar cada 50ms
    
    lastTouchUpdateRef.current = now;
    
    // Obtener el elemento bajo el toque
    const touch = e.touches[0];
    const elem = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
    
    if (!elem) return;
    
    // Buscar el data-time y data-employee-id en el elemento o sus padres
    let currentElem: HTMLElement | null = elem;
    let timeAttr: string | null = null;
    let employeeIdAttr: string | null = null;
    
    while (currentElem && (!timeAttr || !employeeIdAttr)) {
      if (!timeAttr) timeAttr = currentElem.getAttribute('data-time');
      if (!employeeIdAttr) employeeIdAttr = currentElem.getAttribute('data-employee-id');
      
      if (timeAttr && employeeIdAttr) break;
      
      currentElem = currentElem.parentElement;
    }
    
    // Si encontramos los atributos necesarios, procesar la interacción
    if (timeAttr && employeeIdAttr) {
      const employeeId = parseInt(employeeIdAttr, 10);
      
      // Verificar que es para el empleado activo
      if (employeeId === activeEmployee.id) {
        // Verificar si la celda ya está asignada a un turno
        if (!isCellAssigned(employeeId, timeAttr)) {
          // Obtener conjunto de celdas seleccionadas
          const selectedTimes = batchedSelectionsRef.current.get(employeeId) || new Set<string>();
          
          // Clone the set
          const newSelectedTimes = new Set(selectedTimes);
          
          // Determinar si estamos añadiendo o quitando celdas basándonos en la primera celda
          // Para simplificar, en el arrastre táctil siempre añadimos la celda
          newSelectedTimes.add(timeAttr);
          
          // Update the map
          const newMap = new Map(batchedSelectionsRef.current);
          newMap.set(employeeId, newSelectedTimes);
          
          // Update the batch ref
          batchedSelectionsRef.current = newMap;
          
          console.log(`Touch pasó sobre celda ${timeAttr} para empleado ${employeeId}`);
        }
      }
    }
  };
  
  // Add touch move event listener
  useEffect(() => {
    // Solo añadir el listener cuando estamos en modo arrastre
    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      
      return () => {
        document.removeEventListener('touchmove', handleTouchMove);
      };
    }
  }, [isDragging]);
  
  // Actualizar estados cuando cambian los props
  useEffect(() => {
    setStartHour(initialStartHour);
    setEndHour(initialEndHour);
  }, [initialStartHour, initialEndHour]);

  return (
    <div className="space-y-4 w-full max-w-[100vw] overflow-x-hidden">
      {/* Menú contextual para turnos */}
      {contextMenu.isOpen && contextMenu.shift && (
        <div 
          className="fixed z-50 bg-white shadow-lg rounded-md p-3 border border-gray-200"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            transform: 'translate(-50%, -120%)',
            minWidth: '180px',
            touchAction: 'none' // Prevenir gestos táctiles que cierren el menú
          }}
          onClick={(e) => {
            // Evitar que los clics dentro del menú se propaguen al overlay
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            // Evitar que los toques dentro del menú se propaguen
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="text-xs font-semibold mb-2 text-gray-600 border-b pb-1">
            Turno: {contextMenu.shift.startTime} - {contextMenu.shift.endTime}
          </div>
          <button
            onClick={(e) => {
              // Evitar propagación al overlay
              e.preventDefault();
              e.stopPropagation();
              
              // Eliminar turno
              if (contextMenu.shift && onDeleteShift) {
                // Eliminar turno sin mostrar notificación
                onDeleteShift(contextMenu.shift.id);
              }
              closeContextMenu();
            }}
            className="w-full text-left text-red-600 hover:bg-red-50 p-2 rounded-sm text-sm flex items-center gap-2"
          >
            <span className="text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </span>
            Eliminar turno
          </button>
        </div>
      )}
      
      {/* Overlay para cerrar el menú al hacer clic fuera */}
      {contextMenu.isOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={closeContextMenu}
        />
      )}
      
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
            
            {/* Botón para guardar el rango horario */}
            {onSaveTimeRange && (
              <Button
                onClick={() => onSaveTimeRange(startHour, endHour)}
                size="sm"
                variant="outline"
                className="ml-2 h-8"
              >
                Guardar
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Schedule table */}
      <div 
        className="overflow-x-auto border border-neutral-200 rounded select-none w-full touch-container"
        style={{ 
          touchAction: "auto", // Permitir todos los gestos táctiles
          WebkitOverflowScrolling: "touch", // Mejorar el desplazamiento suave
          width: "100%",
          maxWidth: "100%", // Limitar al ancho del contenedor padre
          overflowX: "auto", // Scroll horizontal cuando sea necesario
          overflowY: "hidden", // Evitar scroll vertical innecesario
          paddingRight: "0" // Eliminar padding que podría causar problemas
        }}>
        <table className="w-full border-collapse" style={{ minWidth: "max-content", tableLayout: "fixed", maxWidth: "none" }}>
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
                <span className="text-sm font-semibold">Empleados</span>
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
                      <div className="text-[0.7rem] font-bold tracking-tight">{hourValue}h</div>
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
                  <div className="text-[0.6rem] font-semibold">Personal</div>
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
                        <div className={`text-[0.65rem] font-bold ${textColor}`}>
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
                      <div className="text-[0.55rem] tracking-tighter text-gray-500">{minutes}</div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          
          {/* Table Body - Employees and time slots */}
          <tbody>
            {employees.map((employee) => {
              // Obtener horas restantes para este empleado
              const remainingHours = employeeRemainingHours[employee.id] || 0;
              
              // Determinar color de fondo según horas restantes (verde si tiene suficientes, amarillo si está bajo, rojo si no tiene)
              let hoursColor = 'text-green-600'; // Por defecto, verde
              if (remainingHours <= 8) {
                hoursColor = 'text-amber-500'; // Amarillo si quedan pocas horas
              }
              if (remainingHours <= 0) {
                hoursColor = 'text-red-500'; // Rojo si no quedan horas
              }
              
              // Array para llevar control de celdas que deben saltarse
              const skipCells: Record<string, boolean> = {};
              
              return (
                <tr key={employee.id} className="employee-row">
                  {/* Employee name column - sticky left */}
                  <td
                    className="border-b border-r border-neutral-200 font-medium bg-white p-0"
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      boxShadow: '2px 0 5px rgba(0,0,0,0.05)',
                      height: `${cellSize}px`,
                      minWidth: "150px",
                      width: "150px"
                    }}
                  >
                    <div className="flex flex-col justify-center h-full px-1" 
                      style={{
                        width: "110px",
                        borderRight: "1px dashed #EEEEEE",
                        overflow: "hidden"
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="truncate text-sm font-medium pr-1" style={{maxWidth: "95px", display: "block"}}>{employee.name}</span>
                        {/* Botón de edición de empleado - solo visible si no es modo de solo lectura y hay función onEditEmployee */}
                        {!isReadOnly && onEditEmployee && (
                          <button 
                            className="text-neutral-400 hover:text-neutral-600 flex-shrink-0 p-0"
                            onClick={(e) => {
                              e.stopPropagation(); // Evitar interacción con la celda
                              if (onEditEmployee) {
                                onEditEmployee(employee);
                              }
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                              <path d="m15 5 4 4"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      {/* Información de horas restantes */}
                      <div className={`text-[0.65rem] ${hoursColor} mt-0.5`}>
                        {remainingHours} h restantes
                      </div>
                    </div>
                  </td>
                  
                  {/* Time slots */}
                  {timeSlots.map((time) => {
                    // Si esta celda debe saltarse (porque forma parte de un turno que ya se ha renderizado), no renderizarla
                    if (skipCells[time]) {
                      return null;
                    }
                    
                    // Check if this cell is part of a shift
                    const isAssigned = isCellAssigned(employee.id, time);
                    const isFirstCell = isFirstCellInShift(employee.id, time);
                    
                    // If this is the first cell in a shift, render a cell that spans multiple slots
                    if (isAssigned && isFirstCell) {
                      const shift = getShiftForCell(employee.id, time)!;
                      const cellSpan = getShiftCellSpan(employee.id, time);
                      
                      // Marcar las siguientes celdas para saltarlas
                      for (let i = 1; i < cellSpan; i++) {
                        const nextIndex = timeSlots.indexOf(time) + i;
                        if (nextIndex < timeSlots.length) {
                          skipCells[timeSlots[nextIndex]] = true;
                        }
                      }
                      
                      // Renderizar celda de turno
                      return (
                        <td
                          key={`${employee.id}-${time}`}
                          className="shift-cell relative p-0 border-b border-neutral-200"
                          colSpan={cellSpan}
                          style={{
                            height: `${cellSize}px`,
                            borderLeft: time.endsWith(':00') ? '2px solid #AAAAAA' : 
                                    time.endsWith(':30') ? '1px solid #DDDDDD' : 
                                    '1px dashed #EEEEEE'
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (!isReadOnly && onDeleteShift) {
                              handleOpenContextMenu(e, shift);
                            }
                          }}
                          onTouchStart={(e) => {
                            // Para dispositivos táctiles, un toque largo activa el menú contextual
                            if (isReadOnly || !onDeleteShift) return;
                            
                            // Evitar que el evento se propague pero permitir el comportamiento predeterminado
                            e.stopPropagation();
                            
                            // Mostrar menú contextual después de un tiempo para simular toque largo
                            const touchTimeout = setTimeout(() => {
                              handleOpenContextMenu(e, shift);
                            }, 500); // 500ms es un tiempo razonable para un toque largo
                            
                            // Limpiar el timeout si el toque termina antes
                            const clearTouchTimeout = () => {
                              clearTimeout(touchTimeout);
                              document.removeEventListener('touchend', clearTouchTimeout);
                            };
                            
                            document.addEventListener('touchend', clearTouchTimeout, { once: true });
                          }}
                        >
                          <div 
                            className="h-full flex items-center justify-center bg-blue-100 text-blue-800 rounded-sm mx-0.5"
                            style={{
                              fontSize: "0.65rem",
                              width: `${cellSize * cellSpan - 4}px` // -4px for margin
                            }}
                          >
                            {shift.startTime} - {shift.endTime}
                          </div>
                        </td>
                      );
                    } else if (!isAssigned) {
                      // If not assigned, render a regular selectable cell
                      const isSelected = isCellSelected(employee.id, time);
                      
                      // Determine cell color based on selection
                      const cellClassName = isSelected
                        ? 'selected-cell bg-blue-500 border-blue-600'
                        : 'unselected-cell bg-white hover:bg-gray-50';
                      
                      return (
                        <td
                          key={`${employee.id}-${time}`}
                          className={`relative p-0 border-b border-neutral-200 ${cellClassName}`}
                          style={{
                            height: `${cellSize}px`,
                            width: `${cellSize}px`,
                            cursor: isReadOnly ? 'default' : 'pointer',
                            borderLeft: time.endsWith(':00') ? '2px solid #AAAAAA' : 
                                      time.endsWith(':30') ? '1px solid #DDDDDD' : 
                                      '1px dashed #EEEEEE'
                          }}
                          data-time={time}
                          data-employee-id={employee.id}
                          onMouseDown={() => handleMouseDown(employee, time)}
                          onMouseEnter={() => handleMouseEnter(employee, time)}
                          onTouchStart={(e) => handleTouchStart(e, employee, time)}
                        >
                          {/* Célda vacía o seleccionada */}
                          <div className="w-full h-full">
                            {isSelected && (
                              <div className="h-full w-full flex items-center justify-center">
                                <div className="h-2 w-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    }
                    
                    // Default empty cell for non-first cells in a shift
                    return (
                      <td
                        key={`${employee.id}-${time}`}
                        className="empty-shift-cell p-0 border-b border-neutral-200"
                        style={{
                          height: `${cellSize}px`,
                          width: `${cellSize}px`,
                          borderLeft: time.endsWith(':00') ? '2px solid #AAAAAA' : 
                                   time.endsWith(':30') ? '1px solid #DDDDDD' : 
                                   '1px dashed #EEEEEE'
                        }}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}