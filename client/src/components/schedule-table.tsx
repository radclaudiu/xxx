import { useMemo, useState, useRef, useEffect } from "react";
import { Employee, Shift } from "@shared/schema";
import { formatDateForAPI, generateTimeSlots, isTimeBetween } from "@/lib/date-helpers";
import { Edit } from "lucide-react";

interface ScheduleTableProps {
  employees: Employee[];
  shifts: Shift[];
  date: Date;
  onCellClick: (employee: Employee, startTime: string, endTime: string) => void;
}

export default function ScheduleTable({ employees, shifts, date, onCellClick }: ScheduleTableProps) {
  // Generate time slots from 9:00 to 18:00 in 30-minute increments
  const timeSlots = useMemo(() => generateTimeSlots(9, 18), []);
  
  // Format date for API
  const formattedDate = formatDateForAPI(date);
  
  // State for drag selection
  const [isDragging, setIsDragging] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [endSlot, setEndSlot] = useState<string | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  
  // Ref to track if mouse is pressed
  const mouseDownRef = useRef(false);
  
  // Clean up on unmount or date change
  useEffect(() => {
    resetSelection();
    
    const handleGlobalMouseUp = () => {
      if (isDragging && selectedEmployee && startSlot && endSlot) {
        // Sort start and end times to ensure correct order
        const times = [startSlot, endSlot].sort((a, b) => {
          const [aHour, aMinute] = a.split(':').map(Number);
          const [bHour, bMinute] = b.split(':').map(Number);
          return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
        });
        
        onCellClick(selectedEmployee, times[0], times[1]);
        resetSelection();
      }
      
      setIsDragging(false);
      mouseDownRef.current = false;
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [date, isDragging, selectedEmployee, startSlot, endSlot, onCellClick]);
  
  // Function to reset selection state
  const resetSelection = () => {
    setIsDragging(false);
    setSelectedEmployee(null);
    setStartSlot(null);
    setEndSlot(null);
    setSelectedCells(new Set());
    mouseDownRef.current = false;
  };
  
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
  
  // Handle mouse down on a cell
  const handleMouseDown = (employee: Employee, time: string) => {
    mouseDownRef.current = true;
    setIsDragging(true);
    setSelectedEmployee(employee);
    setStartSlot(time);
    setEndSlot(time);
    
    // Update selected cells
    const newSelectedCells = new Set<string>();
    newSelectedCells.add(`${employee.id}-${time}`);
    setSelectedCells(newSelectedCells);
  };
  
  // Handle mouse enter on a cell (for drag operation)
  const handleMouseEnter = (employee: Employee, time: string) => {
    if (!mouseDownRef.current || !isDragging || !selectedEmployee) return;
    
    // Only allow selecting within the same employee row
    if (employee.id !== selectedEmployee.id) return;
    
    setEndSlot(time);
    
    // Calculate range of selected cells
    if (startSlot) {
      const startIdx = timeSlots.indexOf(startSlot);
      const currentIdx = timeSlots.indexOf(time);
      
      if (startIdx >= 0 && currentIdx >= 0) {
        const newSelectedCells = new Set<string>();
        
        // Handle selection in either direction
        const minIdx = Math.min(startIdx, currentIdx);
        const maxIdx = Math.max(startIdx, currentIdx);
        
        for (let i = minIdx; i <= maxIdx; i++) {
          newSelectedCells.add(`${employee.id}-${timeSlots[i]}`);
        }
        
        setSelectedCells(newSelectedCells);
      }
    }
  };
  
  // Check if a cell is currently selected (during drag operation)
  const isCellSelected = (employeeId: number, time: string) => {
    return selectedCells.has(`${employeeId}-${time}`);
  };
  
  return (
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
                      backgroundColor: isSelected ? 'rgba(255, 152, 0, 0.4)' : 
                                      isAssigned ? 'rgba(25, 118, 210, 0.2)' : 
                                      'transparent',
                      border: isSelected ? '1px solid #FF9800' :
                              isAssigned ? '1px solid #1976D2' : 
                              '1px solid #E0E0E0',
                      borderLeft: time.endsWith(':00') ? '1px solid #BDBDBD' : '1px dashed #E0E0E0',
                      cursor: 'pointer'
                    }}
                    onMouseDown={() => handleMouseDown(employee, time)}
                    onMouseEnter={() => handleMouseEnter(employee, time)}
                  >
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
  );
}
