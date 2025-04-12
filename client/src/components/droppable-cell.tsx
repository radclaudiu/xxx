import React from 'react';
import { useDrop } from 'react-dnd';
import { Employee } from '@shared/schema';
import { DragItem } from './draggable-shift';
import { convertTimeToMinutes } from '@/lib/date-helpers';

interface DroppableCellProps {
  employee: Employee;
  time: string;
  timeSlots: string[];
  date: string;
  isAssigned: boolean;
  isSelected: boolean;
  cellSize: number;
  onDropShift: (data: {
    shiftId: number;
    sourceEmployeeId: number;
    targetEmployeeId: number;
    startTime: string;
    endTime: string;
    date: string;
  }) => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
}

const DroppableCell: React.FC<DroppableCellProps> = ({
  employee,
  time,
  timeSlots,
  date,
  isAssigned,
  isSelected,
  cellSize,
  onDropShift,
  children,
  className = '',
  style = {},
  onMouseDown,
  onMouseEnter,
  onTouchStart
}) => {
  // Calcular la duración entre dos tiempos en intervalos de 15 minutos
  const calculateDurationInSlots = (startTime: string, endTime: string): number => {
    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = timeSlots.indexOf(endTime);
    if (startIndex === -1 || endIndex === -1) return 0;
    return endIndex - startIndex;
  };

  // Hook para la zona de destino
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'SHIFT',
    canDrop: (item: DragItem) => {
      // No permitir soltar en el mismo empleado y hora
      if (item.employeeId === employee.id && item.startTime === time) {
        return false;
      }
      
      // No permitir soltar en celdas que ya tienen un turno asignado
      if (isAssigned) {
        return false;
      }
      
      return true;
    },
    drop: (item: DragItem) => {
      // Calcular la duración del turno original en intervalos de 15 minutos
      const durationInSlots = calculateDurationInSlots(item.startTime, item.endTime);
      
      // Calcular la nueva hora de fin basada en la hora de inicio del destino
      // y la duración del turno original
      const startIndex = timeSlots.indexOf(time);
      const endIndex = Math.min(startIndex + durationInSlots, timeSlots.length - 1);
      const newEndTime = timeSlots[endIndex];
      
      // Llamar a la función para manejar el evento de soltar
      onDropShift({
        shiftId: item.id,
        sourceEmployeeId: item.employeeId,
        targetEmployeeId: employee.id,
        startTime: time,
        endTime: newEndTime,
        date: date
      });
      
      return { moved: true };
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }), [employee.id, time, isAssigned, timeSlots, date, onDropShift]);

  // Estilo para la celda receptora
  const dropStyle: React.CSSProperties = {
    ...style,
    backgroundColor: isOver && canDrop 
      ? 'rgba(76, 175, 80, 0.3)' // Verde claro cuando se está arrastrando sobre y se puede soltar
      : isOver && !canDrop 
        ? 'rgba(244, 67, 54, 0.3)' // Rojo claro cuando se está arrastrando sobre pero no se puede soltar
        : isSelected 
          ? 'rgba(76, 175, 80, 0.4)' // Verde para celdas seleccionadas
          : isAssigned 
            ? 'rgba(25, 118, 210, 0.2)' // Azul para celdas asignadas
            : 'transparent', // Transparente para celdas vacías
    borderTop: isSelected ? '1px solid #4CAF50' : 
                isAssigned ? '1px solid #1976D2' : '1px solid #E0E0E0',
    borderRight: isSelected ? '1px solid #4CAF50' : 
                 isAssigned ? '1px solid #1976D2' : '1px solid #E0E0E0',
    borderBottom: isSelected ? '1px solid #4CAF50' : 
                  isAssigned ? '1px solid #1976D2' : '1px solid #E0E0E0',
  };

  return (
    <td
      ref={drop}
      className={`time-cell ${className} ${isOver && canDrop ? 'drop-target' : ''} ${isOver && !canDrop ? 'no-drop' : ''}`}
      style={dropStyle}
      data-cell-id={`${employee.id}-${time}`}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onTouchStart={onTouchStart}
    >
      {children}
    </td>
  );
};

export default DroppableCell;