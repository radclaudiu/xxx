import React from 'react';
import { useDrop } from 'react-dnd';
import { Employee } from '@shared/schema';

// Interfaz para los datos que se arrastran
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

interface DroppableCellProps {
  employee: Employee;
  time: string;
  timeSlots: string[];
  date: string;
  isAssigned: boolean;
  isSelected: boolean;
  cellSize: number;
  colSpan?: number;
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
  colSpan = 1,
  onDropShift,
  children,
  className = '',
  style,
  onMouseDown,
  onMouseEnter,
  onTouchStart,
}) => {
  // Configurar la lógica de soltar con react-dnd
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'SHIFT',
    
    // Determinar si se puede soltar
    canDrop: (item: DragItem) => {
      // No permitir soltar en celdas ya asignadas
      if (isAssigned) return false;
      
      // Verificar si el turno cabe en los intervalos disponibles
      const startIndex = timeSlots.indexOf(time);
      
      // Calcular el número de intervalos que ocupa el turno
      const hoursDuration = item.width / cellSize;
      const intervalsCount = Math.round(hoursDuration * 4); // 4 intervalos de 15min por hora
      
      // Verificar si hay suficientes intervalos después de la posición actual
      if (startIndex + intervalsCount >= timeSlots.length) {
        return false;
      }
      
      // Verificar si hay turnos asignados en el rango donde se quiere soltar
      for (let i = 0; i < intervalsCount; i++) {
        const checkTime = timeSlots[startIndex + i];
        // Aquí se debería verificar si hay un turno asignado en este intervalo
        // Como no tenemos acceso directo al estado de asignaciones, lo dejamos pendiente
      }
      
      return true;
    },
    
    // Manejar el evento cuando se suelta
    drop: (item: DragItem) => {
      // Calcular la hora de finalización basada en la duración original del turno
      const startIndex = timeSlots.indexOf(time);
      const originalStartIndex = timeSlots.indexOf(item.startTime);
      const originalEndIndex = timeSlots.indexOf(item.endTime);
      const durationInIntervals = originalEndIndex - originalStartIndex;
      
      // Nueva hora de finalización
      const newEndIndex = Math.min(startIndex + durationInIntervals, timeSlots.length - 1);
      const newEndTime = timeSlots[newEndIndex];
      
      // Llamar a la función para actualizar el turno
      onDropShift({
        shiftId: item.id,
        sourceEmployeeId: item.employeeId,
        targetEmployeeId: employee.id,
        startTime: time,
        endTime: newEndTime,
        date: date,
      });
      
      return { moved: true };
    },
    
    // Propiedades a recopilar
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  });
  
  // Estilo para la celda
  const cellStyle: React.CSSProperties = {
    width: `${cellSize * colSpan}px`,
    height: `${cellSize}px`,
    borderLeft: time.endsWith(':00') ? '2px solid #AAAAAA' : 
              time.endsWith(':30') ? '1px solid #DDDDDD' : 
              '1px dashed #EEEEEE',
    padding: 0,
    position: 'relative',
    verticalAlign: 'top',
    backgroundColor: isOver && canDrop 
      ? 'rgba(76, 175, 80, 0.2)' 
      : isSelected 
        ? 'rgba(76, 175, 80, 0.15)' 
        : 'transparent',
    cursor: isAssigned ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.2s',
    ...style,
  };
  
  return (
    <td 
      ref={drop}
      style={cellStyle}
      className={`time-cell ${isSelected ? 'selected-cell' : ''} ${
        isOver && canDrop ? 'drop-target' : ''
      } ${className}`}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onTouchStart={onTouchStart}
    >
      {children}
    </td>
  );
};

export default DroppableCell;