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

// Generate time slots in 30-minute increments
export function generateTimeSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  
  for (let hour = startHour; hour <= endHour; hour++) {
    // Format hour with leading zero if needed
    const formattedHour = hour.toString().padStart(2, '0');
    
    // Add both :00 and :30 slots, except for the last hour which only has :00
    slots.push(`${formattedHour}:00`);
    if (hour < endHour) {
      slots.push(`${formattedHour}:30`);
    }
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
  return hours * 60 + minutes;
}

// Format time for display (ensure HH:MM format)
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}
