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
  // Generate time slots from 9:00 to 18:00 in 30-minute increments
  const timeSlots = useMemo(() => generateTimeSlots(9, 18), []);
  
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
  
  // State for drag selection
  const [isDragging, setIsDragging] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const mouseDownRef = useRef(false);
  
  // Handle document-wide mouse up event
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      mouseDownRef.current = false;
      setStartTime(null);
      setActiveEmployee(null);
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  
  // Handle mouse down on a cell
  const handleMouseDown = (employee: Employee, time: string) => {
    // If cell is already assigned, don't allow selection
    if (isCellAssigned(employee.id, time)) return;
    
    mouseDownRef.current = true;
    setIsDragging(true);
    setStartTime(time);
    setActiveEmployee(employee);
    
    // Select or deselect the time slot immediately
    toggleSingleCell(employee, time);
  };
  
  // Handle mouse enter (hover) on a cell during drag
  const handleMouseEnter = (employee: Employee, time: string) => {
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
        
        // Get or create the set of selected cells for this employee
        const selectedCells = newSelectedCellsByEmployee.get(employee.id) || new Set<string>();
        
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
  
  // Toggle single cell selection (used on initial click)
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
          // For end time, we need the next slot after the last one (since shifts end at the start of the next slot)
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
  
  return (
    <div className="space-y-4">
      {/* Save button */}
      {hasSelections && (
        <div className="flex justify-end mb-2">
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={handleSaveSelections}
          >
            <Save className="h-4 w-4 mr-2" />
            Guardar Turnos Seleccionados
          </Button>
        </div>
      )}
      
      {/* Schedule table */}
      <div className="overflow-x-auto border border-neutral-200 rounded">
        <table className="w-full border-collapse table-fixed">
          {/* Table Header */}
          <thead>
            <tr>
              <th className="sticky-corner border-b border-r border-neutral-200 p-3 bg-neutral-100 min-w-[200px] text-left"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 30,
                    backgroundColor: 'white',
                    boxShadow: '2px 0 5px rgba(0,0,0,0.1)'
                  }}>
                Empleados
              </th>
              {timeSlots.map((time) => (
                <th 
                  key={time}
                  className={`border-b border-neutral-200 p-2 text-center time-cell ${
                    time.endsWith(':00') ? 'hour-marker' : ''
                  }`}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    backgroundColor: 'white',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                    minWidth: '60px',
                    borderLeft: time.endsWith(':00') ? '1px solid #BDBDBD' : '1px dashed #E0E0E0'
                  }}
                >
                  <div className="text-xs font-normal">{time}</div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="employee-row">
                <td 
                  className="border-b border-r border-neutral-200 p-3 bg-white"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    backgroundColor: 'white',
                    boxShadow: '2px 0 5px rgba(0,0,0,0.1)'
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="truncate">{employee.name}</span>
                    <button className="text-neutral-400 hover:text-neutral-600">
                      <Edit className="h-4 w-4" />
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
                      className={`border time-cell ${
                        isAssigned ? 'assigned' : ''
                      } ${isSelected ? 'selected' : ''} ${
                        time.endsWith(':00') ? 'hour-marker' : ''
                      }`}
                      style={{
                        minWidth: '60px',
                        height: '30px',
                        backgroundColor: isSelected ? 'rgba(76, 175, 80, 0.4)' : 
                                        isAssigned ? 'rgba(25, 118, 210, 0.2)' : 
                                        'transparent',
                        border: isSelected ? '1px solid #4CAF50' :
                                isAssigned ? '1px solid #1976D2' : 
                                '1px solid #E0E0E0',
                        borderLeft: time.endsWith(':00') ? '1px solid #BDBDBD' : '1px dashed #E0E0E0',
                        cursor: 'pointer'
                      }}
                      onMouseDown={() => handleMouseDown(employee, time)}
                      onMouseEnter={() => handleMouseEnter(employee, time)}
                    >
                      {isSelected && !isAssigned && (
                        <div className="flex justify-center items-center h-full">
                          <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
