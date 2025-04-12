import React, { useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { Shift, Employee } from '@shared/schema';
import { calculateHoursBetween } from '@/lib/date-helpers';

// Tipo del item siendo arrastrado
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
  // Calcular la posición y dimensiones del turno
  const position = getShiftPosition(employee.id, shift.startTime);
  const width = getShiftWidth(shift.startTime, shift.endTime);
  
  // Configuración del hook useDrag
  const [{ isDragging }, drag, preview] = useDrag(() => ({
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
        width: width
      };
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [shift, employee, position, width]);

  // Estilo para el turno
  const shiftStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.left}px`,
    top: `${position.top}px`,
    width: `${width}px`,
    height: `${cellSize}px`,
    backgroundColor: isDragging ? 'rgba(25, 118, 210, 0.4)' : 'rgba(25, 118, 210, 0.8)',
    border: '1px solid #1565C0',
    borderRadius: '4px',
    color: 'white',
    fontSize: '0.55rem',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'move',
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 100 : 10,
    boxSizing: 'border-box',
    userSelect: 'none',
    touchAction: 'none',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    boxShadow: isDragging ? '0 4px 8px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
    transition: isDragging ? 'none' : 'all 0.2s ease',
  };

  return (
    <div
      ref={drag}
      style={shiftStyle}
      data-testid={`shift-${shift.id}`}
    >
      {`${shift.startTime} - ${shift.endTime}`}
    </div>
  );
};

export default DraggableShift;