/*
Esta es una solución temporal para una actualización pendiente.
El código en home.tsx necesita actualizarse para que el filtrado de turnos por fecha
funcione correctamente. Las siguientes líneas de código necesitan ser reemplazadas:

En las líneas que filtran turnos por fecha:

Ubicación 1 (línea ~329-332):
if (shift.date === formatDateForAPI(currentDate)) {
  return acc + calculateHoursBetween(shift.startTime, shift.endTime);
}
return acc;

Ubicación 2 (línea ~349-352):
if (shift.date === formatDateForAPI(currentDate)) {
  return acc + calculateHoursBetween(shift.startTime, shift.endTime);
}
return acc;

Ubicación 3 (línea ~367-370):
if (shift.date === formatDateForAPI(currentDate)) {
  return acc + calculateHoursBetween(shift.startTime, shift.endTime);
}
return acc;

Deben cambiarse a:

// Los turnos ya están filtrados por fecha
return acc + calculateHoursBetween(shift.startTime, shift.endTime);

Esto mejorará la funcionalidad de filtrado de turnos en la vista del calendario.
*/