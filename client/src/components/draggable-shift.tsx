import React, { useRef } from 'react';
import { useDrag } from 'react-dnd';
import { Shift, Employee } from '@shared/schema';
import { calculateHoursBetween } from '@/lib/date-helpers';

export interface DragItem {
  id: number;
  type: string;
  employeeId: number;
  startTime: string;
  endTime: string;
  date: string;
  originalX: number;
  originalY: number;
  width: number;
}

interface DraggableShiftProps {
  shift: Shift;
  employee: Employee;
  cellSize: number;
  timeSlots: string[];
  getShiftPosition: (employeeId: number, startTime: string) => { top: number; left: number };
  getShiftWidth: (startTime: string, endTime: string) => number;
}

const DraggableShift: React.FC<DraggableShiftProps> = ({
  shift,
  employee,
  cellSize,
  timeSlots,
  getShiftPosition,
  getShiftWidth
}) => {
  const ref = useRef<HTMLDivElement>(null);
  
  const hours = calculateHoursBetween(shift.startTime, shift.endTime);
  const width = getShiftWidth(shift.startTime, shift.endTime);
  const position = getShiftPosition(employee.id, shift.startTime);
  
  const [{ isDragging }, drag] = useDrag({
    type: 'SHIFT',
    item: (): DragItem => {
      return {
        id: shift.id,
        type: 'SHIFT',
        employeeId: employee.id,
        startTime: shift.startTime,
        endTime: shift.endTime,
        date: shift.date,
        originalX: position.left,
        originalY: position.top,
        width
      };
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    }),
    end: (item, monitor) => {
      const didDrop = monitor.didDrop();
      // Si no se soltó en un destino válido, mostrar alguna animación de rebote
      if (!didDrop && ref.current) {
        // Podríamos agregar alguna clase CSS para mostrar un efecto de rebote
        ref.current.classList.add('bounce-back');
        setTimeout(() => {
          if (ref.current) {
            ref.current.classList.remove('bounce-back');
          }
        }, 500);
      }
    }
  });
  
  drag(ref);
  
  return (
    <div
      ref={ref}
      className={`shift-card ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width: `${width}px`,
        height: `${cellSize - 4}px`,
        backgroundColor: isDragging ? 'rgba(14, 165, 233, 0.85)' : 'rgba(14, 165, 233, 0.7)',
        color: 'white',
        padding: '2px 4px',
        fontSize: '0.675rem',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        boxShadow: isDragging 
          ? '0 8px 20px rgba(0, 0, 0, 0.15)' 
          : '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        borderRadius: '4px',
        transition: isDragging 
          ? 'none' 
          : 'all 0.2s ease',
        opacity: isDragging ? 0.8 : 1,
        transform: isDragging ? 'scale(1.05)' : 'scale(1)',
        zIndex: isDragging ? 1000 : 10,
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <span>
        {shift.startTime} - {shift.endTime} ({hours}h)
      </span>
    </div>
  );
};

export default DraggableShift;