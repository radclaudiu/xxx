import { useMemo, useState, useEffect, useRef } from "react";
import { Employee, Shift } from "@shared/schema";
import { 
  formatDateForAPI, 
  generateTimeSlots, 
  isTimeBetween, 
  calculateHoursBetween, 
  formatHours,
  convertTimeToMinutes,
  getStartOfWeek,
  getEndOfWeek,
  isInSameWeek
} from "@/lib/date-helpers";
import { Edit, Save, Clock, DollarSign, Trash, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExportsModal from "@/components/exports-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

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
  // Para mostrar notificaciones
  const { toast } = useToast();
  // Estado para controlar el tamaño de las celdas
  const [cellSize, setCellSize] = useState(30);
  
  // Estados para controlar los rangos de horario
  const [startHour, setStartHour] = useState(8); // 8:00 AM por defecto
  const [endHour, setEndHour] = useState(26); // 02:00 AM del día siguiente (representado como 26:00)
  
  // Funciones para aumentar y disminuir tamaño
  const increaseCellSize = () => setCellSize(prev => Math.min(prev + 5, 50)); // Máximo 50px
  const decreaseCellSize = () => setCellSize(prev => Math.max(prev - 5, 15)); // Mínimo 15px
  
  // Efecto para actualizar las variables CSS cuando cambia el tamaño de celda
  useEffect(() => {
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
  }, [cellSize]);
  
  // Genera los slots de tiempo basados en las horas de inicio y fin configuradas
  const timeSlots = useMemo(() => {
    // Genera todos los slots en un solo rango, independientemente de si cruza medianoche
    // Si endHour >= 24, generateTimeSlots manejará correctamente la generación
    return generateTimeSlots(startHour, endHour);
  }, [startHour, endHour]); // Recalcular cuando cambien los rangos
  
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
  // Estado para forzar re-renderizado cuando cambian las selecciones en tiempo real
  const [updateCounter, setUpdateCounter] = useState(0);
  const mouseDownRef = useRef(false);
  
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
    } else {
      selectedCells.add(time);
    }
    
    // Update the Map with the modified Set
    if (selectedCells.size > 0) {
      newSelectedCellsByEmployee.set(employee.id, selectedCells);
    } else {
      newSelectedCellsByEmployee.delete(employee.id);
    }
    
    setSelectedCellsByEmployee(newSelectedCellsByEmployee);
    // Incrementar contador para forzar actualización inmediata de la UI
    setUpdateCounter(prev => prev + 1);
  };
  
  // Handler for starting an interaction (mouse or touch)
  const handleInteractionStart = (employee: Employee, time: string) => {
    // If cell is already assigned, don't allow selection
    if (isCellAssigned(employee.id, time)) return;
    
    mouseDownRef.current = true;
    setIsDragging(true);
    setStartTime(time);
    setActiveEmployee(employee);
    
    // Select or deselect the time slot immediately
    toggleSingleCell(employee, time);
  };
  
  // Mouse down handler
  const handleMouseDown = (employee: Employee, time: string) => {
    handleInteractionStart(employee, time);
  };
  
  // Estado para saber si estamos en un dispositivo táctil
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // Detectar si es un dispositivo táctil
  useEffect(() => {
    const isTouchCapable = 'ontouchstart' in window || 
      navigator.maxTouchPoints > 0 || 
      (navigator as any).msMaxTouchPoints > 0;
    
    setIsTouchDevice(isTouchCapable);
    
    // Añadir clase para prevenir zoom en dispositivos táctiles
    if (isTouchCapable) {
      document.documentElement.classList.add('touch-device');
    }
    
    return () => {
      document.documentElement.classList.remove('touch-device');
    };
  }, []);
  
  // Referencia para almacenar información sobre el toque
  const touchInfoRef = useRef({
    lastTouched: { employeeId: 0, time: '' },
    startX: 0,
    startY: 0,
    isSwiping: false
  });
  
  // Método simplificado para manejar el toque inicial
  const handleTouchStart = (e: React.TouchEvent, employee: Employee, time: string) => {
    // No hacer nada si la celda ya tiene un turno asignado
    if (isCellAssigned(employee.id, time)) return;
    
    // Para evitar comportamientos inesperados 
    e.stopPropagation();
    
    // Verificar si es un solo dedo (para selección) o varios (para scroll)
    if (e.touches.length !== 1) return;
    
    // Configurar estado inicial
    mouseDownRef.current = true;
    setIsDragging(true);
    setActiveEmployee(employee);
    setStartTime(time);
    
    // Seleccionar inmediatamente la celda tocada
    toggleSingleCell(employee, time);
    
    // Agregar clase a document.body para cambiar comportamiento táctil global
    document.documentElement.classList.add('is-selecting');
  };
  
  // Método para manejar la selección de celdas (tanto mouse como touch)
  const handleCellSelection = (employee: Employee, time: string) => {
    // No hacer nada si la interacción no está activa o es otro empleado
    if (!mouseDownRef.current || !isDragging || !activeEmployee) return;
    if (employee.id !== activeEmployee.id) return;
    if (isCellAssigned(employee.id, time)) return;
    
    // Realizar selección en rango desde startTime hasta time actual
    if (startTime) {
      const startIndex = timeSlots.indexOf(startTime);
      const currentIndex = timeSlots.indexOf(time);
      
      if (startIndex >= 0 && currentIndex >= 0) {
        // Crear nueva selección
        const newMap = new Map(selectedCellsByEmployee);
        const newSet = new Set<string>();
        
        // Determinar rango (funciona en ambas direcciones)
        const min = Math.min(startIndex, currentIndex);
        const max = Math.max(startIndex, currentIndex);
        
        // Seleccionar todas las celdas en el rango
        for (let i = min; i <= max; i++) {
          const timeSlot = timeSlots[i];
          if (!isCellAssigned(employee.id, timeSlot)) {
            newSet.add(timeSlot);
          }
        }
        
        // Actualizar mapa de selecciones
        if (newSet.size > 0) {
          newMap.set(employee.id, newSet);
        } else {
          newMap.delete(employee.id);
        }
        
        // Actualizar estado
        setSelectedCellsByEmployee(newMap);
        setUpdateCounter(prev => prev + 1);
      }
    }
  };
  
  // Manejador global para movimiento táctil (con evento pasivo: false)
  const handleTouchMove = (e: TouchEvent) => {
    // Solo procesar si estamos en modo arrastre con un dedo
    if (!isDragging || !activeEmployee || e.touches.length !== 1) return;
    
    // Importante: prevenir scroll durante selección
    e.preventDefault();
    
    // Buscar elemento bajo el dedo con puntos alrededor para mejorar detección
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    // Puntos de detección: centro y alrededor para mejorar la precisión
    const points = [
      [x, y],         // Centro
      [x-5, y],       // Izquierda
      [x+5, y],       // Derecha
      [x, y-5],       // Arriba
      [x, y+5],       // Abajo
      [x-5, y-5],     // Diagonal superior izquierda
      [x+5, y-5],     // Diagonal superior derecha
      [x-5, y+5],     // Diagonal inferior izquierda
      [x+5, y+5]      // Diagonal inferior derecha
    ];
    
    // Intentar cada punto hasta encontrar una celda
    for (const [pointX, pointY] of points) {
      const element = document.elementFromPoint(pointX, pointY);
      
      // Si encontramos un elemento con data-cell-id
      if (element && element.hasAttribute('data-cell-id')) {
        const cellId = element.getAttribute('data-cell-id');
        if (cellId) {
          const [empId, time] = cellId.split('-');
          const empIdNum = parseInt(empId, 10);
          
          // Solo procesar para el mismo empleado
          if (empIdNum === activeEmployee.id) {
            handleCellSelection(activeEmployee, time);
            return; // Salir al encontrar una celda válida
          }
        }
      }
    }
  };
  
  // Finalizar cualquier interacción táctil
  const handleTouchEnd = () => {
    mouseDownRef.current = false;
    setIsDragging(false);
    
    // Quitar clase del document para restaurar comportamiento táctil normal
    document.documentElement.classList.remove('is-selecting');
  };
  
  // Configurar/limpiar eventos globales según el estado de arrastre
  useEffect(() => {
    // Si no estamos arrastrando, no hacer nada
    if (!isDragging) return;
    
    // Manejadores globales
    const handleGlobalTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const handleGlobalTouchEnd = () => handleTouchEnd();
    
    // Agregar eventos globales
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('touchcancel', handleGlobalTouchEnd);
    
    // Limpiar al desmontar o cuando cambia isDragging
    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [isDragging, activeEmployee]);
  
  // Manejador para mouse enter (solo para desktop)
  const handleMouseEnter = (employee: Employee, time: string) => {
    if (!isTouchDevice) {
      handleCellSelection(employee, time);
    }
  };
  
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
      // Incrementar contador para forzar actualización inmediata de la UI
      setUpdateCounter(prev => prev + 1);
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
    <div className={`space-y-4 schedule-container ${isDragging ? 'is-dragging' : ''}`}>
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
        className="table-container border border-neutral-200 rounded select-none w-full"
        >
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
                          }
                        }}
                        onMouseEnter={() => handleMouseEnter(employee, time)}
                        onTouchStart={(e) => {
                          // Si la celda ya tiene un turno asignado, no hacer nada
                          if (isAssigned) return;
                          
                          // Manejar el toque para selección
                          handleTouchStart(e, employee, time);
                        }}
                        onTouchMove={(e) => {
                          // Permitir que el evento touchmove sea manejado por el listener global
                          if (!isDragging || !activeEmployee || isAssigned) return;
                          
                          if (activeEmployee.id === employee.id) {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Obtener el elemento actual bajo el dedo
                            const touch = e.touches[0];
                            const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
                            
                            // Si el elemento tiene un atributo data-cell-id, extraer employee-id y time
                            const cellId = elementUnderTouch?.getAttribute('data-cell-id');
                            if (cellId) {
                              const [empId, cellTime] = cellId.split('-');
                              if (empId && cellTime) {
                                const touchedEmployee = employees.find(e => e.id === parseInt(empId));
                                if (touchedEmployee) {
                                  handleMouseEnter(touchedEmployee, cellTime);
                                }
                              }
                            } else {
                              // Si no tenemos un data-cell-id, usar la celda actual
                              handleMouseEnter(employee, time);
                            }
                          }
                        }}
                        onTouchEnd={(e) => {
                          // Limpiar estado
                          if (isDragging && activeEmployee && activeEmployee.id === employee.id) {
                            setIsDragging(false);
                          }
                        }}
                      >
                        {isSelected && !isAssigned && (
                          <div className="flex justify-center items-center h-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          </div>
                        )}
                        {isFirstCell && shift && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button 
                                className="text-xs text-center font-semibold hover:bg-blue-100 w-full h-full cursor-pointer bg-transparent border-none flex items-center justify-center"
                                onTouchStart={(e) => {
                                  // Prevenir la propagación para eventos táctiles
                                  e.stopPropagation();
                                }}
                                onTouchEnd={(e) => {
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  // Detener la propagación para evitar que active el comportamiento de selección
                                  e.stopPropagation();
                                }}
                              >
                                <span className="pointer-events-none select-none">{shift.startTime} - {shift.endTime}</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="z-50 bg-white p-2 rounded-lg border shadow-lg">
                              <DropdownMenuItem 
                                className="text-red-600 cursor-pointer flex items-center gap-2 text-xs p-3"
                                onClick={() => handleDeleteShift(shift)}
                              >
                                <Trash className="h-3.5 w-3.5" />
                                Eliminar turno
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    );
                  }).filter(Boolean); // Filtrar los elementos null
                })()}
              </tr>
            ))}
            

            {/* Fila de Horas Diarias */}
            <tr className="daily-hours-row">
              <td 
                className="border-b border-r border-neutral-200 p-0 bg-blue-50"
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 10,
                  backgroundColor: '#EBF5FF',
                  boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                  height: `${cellSize}px`,
                  lineHeight: `${cellSize}px`,
                  minWidth: "150px",
                  width: "150px"
                }}
              >
                <div className="flex justify-center items-center h-full gap-1">
                  <Clock className="h-3 w-3 text-blue-600" />
                  <div className="text-[0.5rem] font-semibold text-blue-700">Horas Diarias</div>
                </div>
              </td>
              
              {/* Una celda por cada intervalo de tiempo */}
              {timeSlots.map((time) => {
                // Para esta fila, necesitamos mostrar las horas diarias para cada empleado
                // Calculamos el total para cada empleado cuando es la hora de inicio del día (8:00)
                // y mostramos un guión en las demás celdas para mantener la consistencia visual
                
                if (time === "8:00") {
                  // Mostrar la suma total de horas para cada empleado
                  return (
                    <td 
                      key={`daily-hours-${time}`}
                      colSpan={timeSlots.length} // Abarca todas las columnas de tiempo
                      className="border-b border-r border-neutral-200 p-0 text-center bg-blue-50"
                      style={{
                        height: `${cellSize}px`,
                        lineHeight: `${cellSize}px`,
                        boxSizing: "border-box"
                      }}
                    >
                      <div className="flex justify-center items-center h-full">
                        {(() => {
                          // Calcular el total de horas trabajadas por todos los empleados
                          let totalDailyHours = 0;
                          
                          // Primero, contar las horas ya guardadas en turnos para todos los empleados
                          shifts.forEach(shift => {
                            if (shift.date === formatDateForAPI(date)) {
                              totalDailyHours += calculateHoursBetween(shift.startTime, shift.endTime);
                            }
                          });
                          
                          // Ahora, contar las horas en selecciones actuales (no guardadas) para todos los empleados
                          // Convertir Map.entries() a Array para iterar de manera compatible con todas las versiones de TypeScript
                          Array.from(selectedCellsByEmployee.entries()).forEach(([employeeId, selectedTimes]) => {
                            if (selectedTimes.size > 0) {
                              // Convertir a array y ordenar por tiempo
                              const sortedTimes = Array.from(selectedTimes).sort((a, b) => {
                                return convertTimeToMinutes(a as string) - convertTimeToMinutes(b as string);
                              });
                              
                              // Agrupar tiempos consecutivos
                              let currentGroup: string[] = [sortedTimes[0] as string];
                              
                              for (let i = 1; i < sortedTimes.length; i++) {
                                const prevTime = currentGroup[currentGroup.length - 1];
                                const currTime = sortedTimes[i] as string;
                                
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
                                  // Para el tiempo final, necesitamos el siguiente slot después del último
                                  const endTime = lastTimeIndex + 1 < timeSlots.length ? 
                                                  timeSlots[lastTimeIndex + 1] : 
                                                  currentGroup[currentGroup.length - 1];
                                  
                                  // Sumar horas de este grupo
                                  totalDailyHours += calculateHoursBetween(startTime, endTime);
                                  
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
                                totalDailyHours += calculateHoursBetween(startTime, endTime);
                              }
                            }
                          });
                          
                          return (
                            <span className="text-xl font-bold text-blue-700">{formatHours(totalDailyHours)}</span>
                          );
                        })()}
                      </div>
                    </td>
                  );
                } else {
                  // Para las demás celdas, retornar null porque ya están cubiertas por el colSpan
                  return null;
                }
              }).filter(Boolean)}
            </tr>
            
            {/* Fila de análisis financiero */}
            {(estimatedDailySales > 0 || hourlyEmployeeCost > 0) && (
              <tr className="financial-analysis-row">
                <td 
                  className="border-b border-r border-neutral-200 p-0 bg-green-50"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    backgroundColor: '#f0fdf4',
                    boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                    height: `${cellSize}px`,
                    lineHeight: `${cellSize}px`,
                    minWidth: "150px",
                    width: "150px"
                  }}
                >
                  <div className="flex justify-center items-center h-full gap-1">
                    <DollarSign className="h-3 w-3 text-green-600" />
                    <div className="text-[0.5rem] font-semibold text-green-700">Análisis Financiero</div>
                  </div>
                </td>
                
                <td 
                  colSpan={timeSlots.length}
                  className="border-b border-r border-neutral-200 p-2 text-left bg-green-50"
                  style={{
                    height: `${cellSize}px`,
                    boxSizing: "border-box"
                  }}
                >
                  {(() => {
                    // Calcular las horas totales de todos los empleados para este día
                    let totalHours = 0;
                    
                    // Contar turnos guardados
                    shifts.forEach(shift => {
                      if (shift.date === formatDateForAPI(date)) {
                        totalHours += calculateHoursBetween(shift.startTime, shift.endTime);
                      }
                    });
                    
                    // Contar selecciones actuales no guardadas
                    // Usar Array.from para compatibilidad con versiones anteriores de TypeScript
                    Array.from(selectedCellsByEmployee.entries()).forEach(([employeeId, selectedTimes]) => {
                      if (selectedTimes.size === 0) return;
                      
                      // Convertir tiempos seleccionados a array y ordenar
                      const sortedTimes = Array.from(selectedTimes).sort((a, b) => {
                        return convertTimeToMinutes(a as string) - convertTimeToMinutes(b as string);
                      });
                      
                      if (sortedTimes.length === 0) return;
                      
                      // Agrupar tiempos consecutivos
                      let currentGroup: string[] = [sortedTimes[0] as string];
                      
                      for (let i = 1; i < sortedTimes.length; i++) {
                        const prevTime = currentGroup[currentGroup.length - 1];
                        const currTime = sortedTimes[i] as string;
                        
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
                          // Para el tiempo final, necesitamos el siguiente slot después del último
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
                    });
                    
                    // Calcular coste total de personal
                    const totalLaborCost = totalHours * hourlyEmployeeCost;
                    
                    // Calcular porcentaje de ventas destinado a personal
                    const laborCostPercentage = estimatedDailySales > 0 
                      ? (totalLaborCost / estimatedDailySales) * 100 
                      : 0;
                    
                    return (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-md p-2 shadow-sm">
                          <div className="text-xs text-gray-500 mb-1">Ventas Estimadas:</div>
                          <div className="text-sm font-bold text-green-700">€{estimatedDailySales.toFixed(2)}</div>
                        </div>
                        
                        <div className="bg-white rounded-md p-2 shadow-sm">
                          <div className="text-xs text-gray-500 mb-1">Coste de Personal:</div>
                          <div className="text-sm font-bold text-amber-600">€{totalLaborCost.toFixed(2)}</div>
                        </div>
                        
                        <div className="bg-white rounded-md p-2 shadow-sm">
                          <div className="text-xs text-gray-500 mb-1">% Ventas en Personal:</div>
                          <div className={`text-sm font-bold ${
                            laborCostPercentage > 40 ? 'text-red-600' : 
                            laborCostPercentage > 30 ? 'text-amber-600' : 
                            'text-green-600'
                          }`}>
                            {laborCostPercentage.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}