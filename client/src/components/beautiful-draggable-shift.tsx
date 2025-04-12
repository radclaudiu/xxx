import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Shift, Employee } from '@shared/schema';
import { calculateHoursBetween } from '@/lib/date-helpers';

interface BeautifulDraggableShiftProps {
  shift: Shift;
  employee: Employee;
  index: number;
  cellSize: number;
  timeSlots: string[];
  getShiftWidth: (startTime: string, endTime: string) => number;
  onDelete?: (shiftId: number) => void;
}

const BeautifulDraggableShift: React.FC<BeautifulDraggableShiftProps> = ({
  shift,
  employee,
  index,
  cellSize,
  timeSlots,
  getShiftWidth,
  onDelete
}) => {
  const width = getShiftWidth(shift.startTime, shift.endTime);
  const hours = calculateHoursBetween(shift.startTime, shift.endTime);
  
  return (
    <Draggable
      draggableId={`shift-${shift.id}`}
      index={index}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`rounded-md ${snapshot.isDragging ? 'shadow-lg z-50' : 'shadow-sm'}`}
          style={{
            ...provided.draggableProps.style,
            width: `${width}px`,
            backgroundColor: snapshot.isDragging 
              ? 'rgba(14, 165, 233, 0.85)' 
              : 'rgba(14, 165, 233, 0.7)',
            color: 'white',
            padding: '2px 4px',
            fontSize: '0.675rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            transform: snapshot.isDragging 
              ? `${provided.draggableProps.style?.transform} scale(1.05)` 
              : provided.draggableProps.style?.transform,
            transition: snapshot.isDragging 
              ? 'none' 
              : 'all 0.2s ease',
            borderLeft: '3px solid #0284c7',
            userSelect: 'none',
            height: `${cellSize - 4}px`,
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (onDelete) {
              if (window.confirm(`¿Eliminar el turno de ${shift.startTime} a ${shift.endTime}?`)) {
                onDelete(shift.id);
              }
            }
          }}
        >
          <span>
            {shift.startTime} - {shift.endTime} ({hours}h)
          </span>
        </div>
      )}
    </Draggable>
  );
};

export default BeautifulDraggableShift;