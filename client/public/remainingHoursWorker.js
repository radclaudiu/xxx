// Web Worker para calcular las horas restantes de los empleados
self.onmessage = function(e) {
  const { employees, shifts, weekStart, weekEnd } = e.data;
  
  // Fechas de inicio y fin de la semana como objetos Date
  const weekStartDate = new Date(weekStart);
  const weekEndDate = new Date(weekEnd);

  // Calcular las horas restantes para cada empleado
  const remainingHours = {};
  
  employees.forEach(employee => {
    if (!employee.maxHoursPerWeek) {
      remainingHours[employee.id] = 0;
      return;
    }
    
    // Filtrar turnos para este empleado en esta semana específica
    const employeeWeekShifts = shifts.filter(shift => {
      if (shift.employeeId !== employee.id) return false;
      
      // Convertir string de fecha en objeto Date (formato YYYY-MM-DD)
      const shiftDate = new Date(shift.date);
      
      // Verificar si la fecha del turno está dentro de la semana
      return shiftDate >= weekStartDate && shiftDate <= weekEndDate;
    });
    
    // Calcular horas totales asignadas
    const totalAssignedHours = employeeWeekShifts.reduce((total, shift) => {
      // Parsear las horas de inicio y fin
      const [startHour, startMinute] = shift.startTime.split(':').map(Number);
      const [endHour, endMinute] = shift.endTime.split(':').map(Number);
      
      // Convertir a minutos para el cálculo
      const startInMinutes = startHour * 60 + startMinute;
      const endInMinutes = endHour * 60 + endMinute;
      
      // Si el horario de fin es anterior al de inicio, asumimos que es del día siguiente
      let diffMinutes = endInMinutes - startInMinutes;
      if (diffMinutes <= 0) {
          diffMinutes += 24 * 60; // Añadir 24 horas en minutos
      }
      
      // Añadir la duración del turno (en horas)
      return total + (diffMinutes / 60);
    }, 0);
    
    // Guardar las horas restantes (horas contratadas - asignadas)
    remainingHours[employee.id] = employee.maxHoursPerWeek - totalAssignedHours;
  });
  
  // Enviar los resultados de vuelta al hilo principal
  self.postMessage({ remainingHours });
};