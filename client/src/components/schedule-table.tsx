import { useMemo } from "react";
import { Employee, Shift } from "@shared/schema";
import { formatDateForAPI, generateTimeSlots, isTimeBetween } from "@/lib/date-helpers";
import { Edit } from "lucide-react";

interface ScheduleTableProps {
  employees: Employee[];
  shifts: Shift[];
  date: Date;
  onCellClick: (employee: Employee, time: string) => void;
}

export default function ScheduleTable({ employees, shifts, date, onCellClick }: ScheduleTableProps) {
  // Generate time slots from 9:00 to 18:00 in 30-minute increments
  const timeSlots = useMemo(() => generateTimeSlots(9, 18), []);
  
  // Format date for API
  const formattedDate = formatDateForAPI(date);
  
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
            {timeSlots.map((time, index) => (
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
                  <button className="text-neutral-400 hover:text-error">
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              </td>
              
              {timeSlots.map((time) => {
                const isAssigned = isCellAssigned(employee.id, time);
                const isFirstCell = isFirstCellInShift(employee.id, time);
                const shift = isFirstCell ? getShiftForCell(employee.id, time) : null;
                
                return (
                  <td 
                    key={`${employee.id}-${time}`}
                    className={`border time-cell ${
                      isAssigned ? 'assigned' : ''
                    } ${time.endsWith(':00') ? 'hour-marker' : ''}`}
                    style={{
                      minWidth: '60px',
                      height: '30px',
                      backgroundColor: isAssigned ? 'rgba(25, 118, 210, 0.2)' : 'transparent',
                      border: isAssigned ? '1px solid #1976D2' : '1px solid #E0E0E0',
                      borderLeft: time.endsWith(':00') ? '1px solid #BDBDBD' : '1px dashed #E0E0E0',
                      cursor: 'pointer'
                    }}
                    onClick={() => onCellClick(employee, time)}
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
