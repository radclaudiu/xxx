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
export function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
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
  const slots: string[] = [];
  
  // Manejo especial para hora 24 (medianoche)
  const adjustedEndHour = endHour === 24 ? 23 : endHour;
  
  // Generar para todas las horas completas entre startHour y adjustedEndHour
  for (let hour = startHour; hour <= adjustedEndHour; hour++) {
    // Normalizar las horas para manejar horas > 23 (día siguiente)
    const normalizedHour = hour % 24;
    
    // Format hour with leading zero if needed
    const formattedHour = normalizedHour.toString().padStart(2, '0');
    
    // Add :00 slot para todas las horas
    slots.push(`${formattedHour}:00`);
    
    // Añadir los intervalos de 15, 30 y 45 minutos
    // Si es la última hora del rango y es la hora 23, o si no es la última hora del rango
    if ((hour === adjustedEndHour && normalizedHour === 23) || hour < adjustedEndHour) {
      slots.push(`${formattedHour}:15`);
      slots.push(`${formattedHour}:30`);
      slots.push(`${formattedHour}:45`);
    }
  }
  
  // Si estamos generando hasta la hora 24 (00:00 del día siguiente)
  // Usamos un formato ligeramente diferente para evitar duplicación de claves
  if (endHour === 24) {
    slots.push('24:00'); // Añadir 00:00 como 24:00 para evitar duplicación de claves
  }
  
  return slots;
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
