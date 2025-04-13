// Format date as "Día de la semana, DD de Mes YYYY"
export function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  // Format date in Spanish
  let formattedDate = date.toLocaleDateString('es-ES', options);
  
  // Capitalize first letter
  formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  
  return formattedDate;
}

// Parse date string to Date object
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

// Format date as YYYY-MM-DD for API requests
export function formatDateForAPI(date: Date | string | undefined | null): string {
  try {
    // Verificamos si date es undefined o null
    if (date === undefined || date === null) {
      throw new Error("La fecha es undefined o null");
    }
    
    // Si es un string, verificamos si ya tiene el formato correcto YYYY-MM-DD
    if (typeof date === 'string') {
      // Si ya tiene el formato YYYY-MM-DD, simplemente devolvemos
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      // Si no, intentamos convertirlo a Date
      const parsedDate = new Date(date);
      
      // Verificar si la fecha es válida (isNaN se usa para comprobar fechas inválidas)
      if (isNaN(parsedDate.getTime())) {
        throw new Error(`Fecha inválida: ${date}`);
      }
      
      date = parsedDate;
    } else if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error(`Fecha inválida o no es una instancia de Date: ${date}`);
    }
    
    // Método seguro que no depende de toISOString()
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son 0-11, añadimos 1
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error formateando fecha para API:", error);
    // Fallback a la fecha actual
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
}

// Get previous day
export function getPreviousDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setDate(date.getDate() - 1);
  return newDate;
}

// Get next day
export function getNextDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setDate(date.getDate() + 1);
  return newDate;
}

// Generate time slots in 15-minute increments
export function generateTimeSlots(startHour: number, endHour: number): string[] {
  try {
    const slots: string[] = [];
    
    // Validar entrada
    if (startHour < 0 || endHour < 0 || startHour > 47 || endHour > 47) {
      console.warn("Horas fuera de rango permitido (0-47):", startHour, endHour);
      // Usar valores predeterminados seguros si están fuera de rango
      startHour = Math.max(0, Math.min(startHour, 47));
      endHour = Math.max(0, Math.min(endHour, 47));
    }
    
    // Si el horario termina en 00:00 del día siguiente o más tarde
    const actualEndHour = endHour <= startHour ? endHour + 24 : endHour;
    
    for (let hour = startHour; hour < actualEndHour; hour++) {
      // Normalizar hora para manejar casos > 23 (día siguiente)
      const normalizedHour = hour % 24;
      const formattedHour = normalizedHour.toString().padStart(2, '0');
      
      // Para cada hora, añadir todos los intervalos de 15 minutos
      slots.push(`${formattedHour}:00`);
      slots.push(`${formattedHour}:15`);
      slots.push(`${formattedHour}:30`);
      slots.push(`${formattedHour}:45`);
    }
    
    // Añadir la hora exacta final (sin subdivisiones)
    if (actualEndHour % 24 === 0) {
      // Si termina a una hora en punto que es medianoche, usar 00:00 para el siguiente día
      slots.push('00:00');
    } else {
      // Para otras horas finales, añadir la hora en punto
      const normalizedEndHour = actualEndHour % 24;
      const formattedEndHour = normalizedEndHour.toString().padStart(2, '0');
      slots.push(`${formattedEndHour}:00`);
    }
    
    console.log(`Generadas ${slots.length} franjas horarias de ${startHour} a ${endHour}`);
    return slots;
  } catch (error) {
    console.error("Error al generar franjas horarias:", error);
    // En caso de error, devolver un conjunto básico de horas (9am a 6pm)
    return ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', 
            '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45',
            '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', 
            '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', 
            '17:00', '17:15', '17:30', '17:45', '18:00'];
  }
}

// Check if a time (HH:MM) is between start and end times
export function isTimeBetween(time: string, startTime: string, endTime: string): boolean {
  // Convert times to comparable values (minutes since midnight)
  const timeMinutes = convertTimeToMinutes(time);
  const startMinutes = convertTimeToMinutes(startTime);
  const endMinutes = convertTimeToMinutes(endTime);
  
  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
}

// Convert time (HH:MM) to minutes since midnight
export function convertTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  // Si es 24:00, es medianoche (igual que 00:00)
  if (hours === 24 && minutes === 0) {
    return 0; // Medianoche (0 minutos desde medianoche)
  }
  return hours * 60 + minutes;
}

// Format time for display (ensure HH:MM format)
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

// Calculate hours between two times (returns decimal hours)
export function calculateHoursBetween(startTime: string, endTime: string): number {
  const startMinutes = convertTimeToMinutes(startTime);
  const endMinutes = convertTimeToMinutes(endTime);
  
  // Calculate difference in minutes
  let diff = endMinutes - startMinutes;
  
  // If end time is earlier than start time, assume it's the next day
  if (diff < 0) {
    diff += 24 * 60; // Add 24 hours in minutes
  }
  
  // Convert to hours with 2 decimal places
  return parseFloat((diff / 60).toFixed(2));
}

// Format hours (converts decimal hours to hours and minutes)
export function formatHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  return `${wholeHours}h ${minutes}m`;
}

// Get the start date of the week (Monday) containing the specified date
export function getStartOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Get the end date of the week (Sunday) containing the specified date
export function getEndOfWeek(date: Date): Date {
  const startOfWeek = getStartOfWeek(date);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
}

// Check if two dates are in the same week
export function isInSameWeek(date1: Date, date2: Date): boolean {
  const startOfWeek1 = getStartOfWeek(date1);
  const startOfWeek2 = getStartOfWeek(date2);
  return startOfWeek1.getTime() === startOfWeek2.getTime();
}
