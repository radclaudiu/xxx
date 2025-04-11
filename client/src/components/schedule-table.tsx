import { useMemo, useState, useEffect, useRef } from "react";
import { Employee, Shift } from "@shared/schema";
import { formatDateForAPI, generateTimeSlots, isTimeBetween } from "@/lib/date-helpers";
import { Edit, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScheduleTableProps {
  employees: Employee[];
  shifts: Shift[];
  date: Date;
  onSaveShifts: (selections: {employee: Employee, startTime: string, endTime: string}[]) => void;
}

export default function ScheduleTable({ employees, shifts, date, onSaveShifts }: ScheduleTableProps) {
  // Estado para controlar el tamaño de las celdas
  const [cellSize, setCellSize] = useState(30);
  
  // Funciones para aumentar y disminuir tamaño
  const increaseCellSize = () => setCellSize(prev => Math.min(prev + 5, 50)); // Máximo 50px
  const decreaseCellSize = () => setCellSize(prev => Math.max(prev - 5, 15)); // Mínimo 15px
  
  // Efecto para actualizar las variables CSS cuando cambia el tamaño de celda
  useEffect(() => {
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
  }, [cellSize]);
  // Generate time slots from 08:00 to 02:00 in 30-minute increments (02:00 del día siguiente)
  const timeSlots = useMemo(() => {
    // Para manejar el rango de 08:00 a 02:00 (del día siguiente),
    // generamos primero de 08:00 a 23:30, luego agregamos 00:00 a 02:00
    const morningToMidnight = generateTimeSlots(8, 23);
    const midnightToEarly = generateTimeSlots(0, 2);
    return [...morningToMidnight, ...midnightToEarly];
  }, []);
  
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
  
  // Touch start handler
  const handleTouchStart = (e: React.TouchEvent, employee: Employee, time: string) => {
    // Si hay 2 o más dedos, permitir el desplazamiento nativo
    if (e.touches.length >= 2) {
      return; // No prevenir el comportamiento por defecto
    }
    
    // Para un solo dedo, prevenir el desplazamiento durante la selección
    e.preventDefault();
    e.stopPropagation();
    
    // Asegurarnos que no se desplaza la tabla al hacer el gesto de arrastre con un dedo
    const touchEvent = e.nativeEvent;
    touchEvent.stopPropagation();
    
    handleInteractionStart(employee, time);
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
        // Incrementar contador para forzar actualización inmediata de la UI
        setUpdateCounter(prev => prev + 1);
      }
    }
  };
  
  // Mouse enter handler
  const handleMouseEnter = (employee: Employee, time: string) => {
    handleCellInteraction(employee, time);
  };
  
  // Touch move handler
  const handleTouchMove = (e: React.TouchEvent) => {
    // Si hay 2 o más dedos, permitir el desplazamiento (scroll) nativo
    if (e.touches.length >= 2) {
      return; // No prevenir el comportamiento por defecto para permitir desplazamiento con dos dedos
    }
    
    // Para un solo dedo, prevenir el desplazamiento durante la selección
    e.preventDefault();
    
    if (!isDragging || !activeEmployee) return;
    
    // Get touch position
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
    
    // Check if touch is over a cell
    if (element && element.tagName === 'TD') {
      // Try to get employee and time from data attributes
      const cellId = element.getAttribute('data-cell-id');
      if (cellId) {
        const [empId, time] = cellId.split('-');
        const employeeId = parseInt(empId, 10);
        const employee = employees.find(e => e.id === employeeId);
        
        if (employee && time) {
          handleCellInteraction(employee, time);
        }
      }
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
  
  return (
    <div className="space-y-4">
      {/* Control buttons */}
      <div className="flex justify-between mb-2">
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
      
      {/* Schedule table */}
      <div 
        className="overflow-x-auto border border-neutral-200 rounded select-none"
        style={{ 
          touchAction: "manipulation", // Permite gestos como pellizcar para zoom pero bloquea paneos
          WebkitOverflowScrolling: "touch" // Mejorar el desplazamiento suave
        }}
        onTouchMove={handleTouchMove}
        onTouchStart={(e) => {
          // Solo detener la propagación para eventos de un dedo
          if (e.touches.length === 1) {
            e.stopPropagation();
          }
        }}>
        <table className="w-full border-collapse table-fixed">
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
                    lineHeight: `${cellSize}px`
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
                    lineHeight: `${cellSize}px`
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
                      top: `${cellSize}px`, // Debajo de la primera fila
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
                    lineHeight: `${cellSize}px`
                  }}
                >
                  <div className="flex justify-between items-center px-1" style={{height: `${cellSize}px`, width: "120px", overflow: "hidden"}}>
                    <span className="truncate text-xs">{employee.name}</span>
                    <button className="text-neutral-400 hover:text-neutral-600 ml-1 p-0">
                      <Edit className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                
                {timeSlots.map((time) => {
                  const isAssigned = isCellAssigned(employee.id, time);
                  const isFirstCell = isFirstCellInShift(employee.id, time);
                  const shift = isFirstCell ? getShiftForCell(employee.id, time) : null;
                  const isSelected = isCellSelected(employee.id, time);
                  
                  return (
                    <td 
                      key={`${employee.id}-${time}`}
                      data-cell-id={`${employee.id}-${time}`}
                      className={`time-cell ${
                        isAssigned ? 'assigned' : ''
                      } ${isSelected ? 'selected' : ''} ${
                        time.endsWith(':00') ? 'hour-marker' : ''
                      }`}
                      style={{
                        width: `${cellSize}px`, // Ancho dinámico basado en cellSize
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
                        touchAction: 'none',       // Prevenir desplazamiento en celdas
                        WebkitTapHighlightColor: 'transparent' // Quitar resaltado al tocar
                      }}
                      onMouseDown={() => handleMouseDown(employee, time)}
                      onMouseEnter={() => handleMouseEnter(employee, time)}
                      onTouchStart={(e) => handleTouchStart(e, employee, time)}
                    >
                      {isSelected && !isAssigned && (
                        <div className="flex justify-center items-center h-full">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                      )}
                      {isFirstCell && shift && (
                        <div className="text-xs text-center">{shift.startTime} - {shift.endTime}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            
            {/* Fila de Totales (ahora al final de la tabla) */}
            <tr className="totals-row">
              <td 
                className="border-b border-r border-neutral-200 p-0"
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 10,
                  backgroundColor: '#F3F4F6',
                  boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                  height: `${cellSize}px`,
                  lineHeight: `${cellSize}px`
                }}
              >
                <div className="flex justify-center items-center h-full">
                  <div className="text-[0.5rem] font-semibold">Total</div>
                </div>
              </td>
              
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
                
                // Determinar color y fondo según el tipo de conteo (colores más neutros)
                const backgroundColor = selectedCount > 0 
                  ? 'rgba(229, 231, 235, 0.5)' // Gris claro para selecciones actuales
                  : assignedCount > 0 
                    ? 'rgba(229, 231, 235, 0.5)' // El mismo gris para asignaciones
                    : 'white';
                
                const textColor = selectedCount > 0 
                  ? 'text-gray-900' // Texto oscuro para todos
                  : 'text-gray-900';
                
                return (
                  <td 
                    key={`total-${time}`}
                    className={`border-b border-r border-neutral-200 p-0 text-center ${
                      time.endsWith(':00') ? 'hour-marker' : ''
                    }`}
                    style={{
                      backgroundColor,
                      width: `${cellSize}px`, // Ancho dinámico basado en cellSize
                      height: `${cellSize}px`, // Altura dinámica basada en cellSize
                      lineHeight: `${cellSize}px`, // Garantizar altura exacta
                      boxSizing: "border-box", // Incluir bordes en dimensiones
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
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}