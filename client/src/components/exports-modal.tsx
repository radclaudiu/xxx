import { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Employee, Shift } from "@shared/schema";
import { Download, Calendar, FileText, ChevronLeft, ChevronRight, Moon, CalendarClock } from "lucide-react";
import { formatDate, getStartOfWeek, isInSameWeek, calculateHoursBetween, formatHours, formatDateForAPI } from "@/lib/date-helpers";
import { useToast } from "@/hooks/use-toast";

import html2pdf from "html2pdf.js";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// Función para formatear el nombre del empleado (nombre + iniciales apellidos)
const formatEmployeeName = (fullName: string) => {
  const parts = fullName.trim().split(' ');
  
  if (parts.length === 1) {
    return parts[0]; // Solo hay un nombre
  }
  
  // Extraer el primer nombre
  const firstName = parts[0];
  
  // Obtener las iniciales de los apellidos
  const initials = parts.slice(1).map(part => part.charAt(0)).join('');
  
  return `${firstName} ${initials}`;
};

interface ExportsModalProps {
  employees: Employee[];
  shifts: Shift[];
  currentDate: Date;
}

// Definimos la interfaz para los métodos expuestos a través de la referencia
export interface ExportsModalRef {
  openWithReport: (reportType: string | null) => void;
}

const ExportsModal = forwardRef<ExportsModalRef, ExportsModalProps>(({ employees, shifts, currentDate }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const weeklyScheduleRef = useRef<HTMLDivElement>(null);
  const printTemplateRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Estado para controlar la semana seleccionada
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getStartOfWeek(currentDate));
  
  // Método para abrir el modal directamente con un reporte específico o mostrar el menú
  const openWithReport = (reportType: string | null = null) => {
    setSelectedReport(reportType);
    setIsOpen(true);
  };
  
  // Exponemos los métodos a través de la referencia
  useImperativeHandle(ref, () => ({
    openWithReport
  }));
  
  // Función para obtener todos los turnos de la semana seleccionada
  const getWeekShifts = () => {
    // Obtener fechas de inicio y fin de semana sin modificar los originales
    const startDate = new Date(weekDays[0]);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(weekDays[6]);
    endDate.setHours(23, 59, 59, 999);
    
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= startDate && shiftDate <= endDate;
    });
  };
  
  // Función para avanzar a la siguiente semana
  const goToNextWeek = () => {
    const nextWeek = new Date(selectedWeekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    setSelectedWeekStart(nextWeek);
  };
  
  // Función para retroceder a la semana anterior
  const goToPrevWeek = () => {
    const prevWeek = new Date(selectedWeekStart);
    prevWeek.setDate(prevWeek.getDate() - 7);
    setSelectedWeekStart(prevWeek);
  };
  
  // Generar array con los 7 días de la semana seleccionada
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(selectedWeekStart);
    day.setDate(day.getDate() + i);
    return day;
  });

  // Formato para mostrar el rango de la semana
  const weekRangeText = `${formatDate(weekDays[0])} - ${formatDate(weekDays[6])}`;
  
  // Días de la semana en español para encabezados
  const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  
  // Función para calcular horas nocturnas (entre 22:00 y 06:00)
  const calculateNightHours = (employeeId: number, isMonthly: boolean) => {
    // Determinar el rango de fechas a considerar
    let startDate: Date;
    let endDate: Date;
    
    if (isMonthly) {
      // Para informe mensual: primer y último día del mes actual
      const currentDate = new Date(selectedWeekStart);
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    } else {
      // Para informe semanal: usar la semana seleccionada
      startDate = new Date(weekDays[0]);
      endDate = new Date(weekDays[6]);
      endDate.setHours(23, 59, 59, 999);
    }
    
    // Filtrar turnos para este empleado en el período especificado
    const employeeShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return (
        shift.employeeId === employeeId &&
        shiftDate >= startDate && 
        shiftDate <= endDate
      );
    });
    
    // Calcular horas nocturnas para cada turno
    const details: { date: string; hours: number }[] = [];
    let totalNightHours = 0;
    
    employeeShifts.forEach(shift => {
      // Convertir a objetos Date para facilitar comparaciones
      const shiftDate = new Date(shift.date);
      const shiftStartParts = shift.startTime.split(':').map(Number);
      const shiftEndParts = shift.endTime.split(':').map(Number);
      
      // Crear objetos Date para inicio y fin del turno
      const shiftStart = new Date(shiftDate);
      shiftStart.setHours(shiftStartParts[0], shiftStartParts[1], 0, 0);
      
      const shiftEnd = new Date(shiftDate);
      shiftEnd.setHours(shiftEndParts[0], shiftEndParts[1], 0, 0);
      
      // Si el turno termina antes de que empiece (ej: 23:00 - 07:00), ajustar fin al día siguiente
      if (shiftEndParts[0] < shiftStartParts[0] || (shiftEndParts[0] === 0 && shiftEndParts[1] === 0)) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }
      
      // Definir período nocturno para este día
      const nightStart = new Date(shiftDate);
      nightStart.setHours(22, 0, 0, 0);
      
      const nightEnd = new Date(shiftDate);
      nightEnd.setHours(6, 0, 0, 0);
      if (nightStart.getTime() > nightEnd.getTime()) {
        nightEnd.setDate(nightEnd.getDate() + 1);
      }
      
      // Calcular superposición con horario nocturno
      let nightHours = 0;
      
      // Caso 1: El turno está completamente dentro del horario nocturno
      if (shiftStart >= nightStart && shiftEnd <= nightEnd) {
        nightHours = calculateHoursBetween(shift.startTime, shift.endTime);
      }
      // Caso 2: El turno comienza antes del horario nocturno pero termina durante el mismo
      else if (shiftStart < nightStart && shiftEnd > nightStart && shiftEnd <= nightEnd) {
        const nightStartTime = '22:00';
        nightHours = calculateHoursBetween(nightStartTime, shift.endTime);
      }
      // Caso 3: El turno comienza durante el horario nocturno pero termina después
      else if (shiftStart >= nightStart && shiftStart < nightEnd && shiftEnd > nightEnd) {
        const nightEndTime = '06:00';
        nightHours = calculateHoursBetween(shift.startTime, nightEndTime);
      }
      // Caso 4: El turno abarca todo el período nocturno
      else if (shiftStart < nightStart && shiftEnd > nightEnd) {
        nightHours = 8; // De 22:00 a 06:00 son 8 horas
      }
      
      if (nightHours > 0) {
        details.push({
          date: shift.date,
          hours: nightHours
        });
        totalNightHours += nightHours;
      }
    });
    
    return {
      totalHours: totalNightHours,
      details: details
    };
  };
  
  // Función para generar y descargar el PDF del informe seleccionado
  const generateWeeklySchedulePDF = () => {
    // Notificar al usuario que el proceso ha comenzado
    toast({
      title: "Generando PDF",
      description: "El proceso puede tardar unos segundos...",
    });
    
    if (selectedReport === 'week-schedule') {
      // Para el cuadrante semanal, usamos html2canvas + jsPDF
      const element = weeklyScheduleRef.current;
      if (!element) {
        console.error("No se encontró el elemento de referencia para el reporte:", selectedReport);
        toast({
          title: "Error al generar PDF",
          description: "No se pudo encontrar el contenido del informe",
          variant: "destructive"
        });
        return;
      }
      
      const dateRange = weekRangeText.replace(/\//g, "-");
      const filename = `cuadrante-semanal-${dateRange}.pdf`;
      
      try {
        // Capturar tabla como imagen
        html2canvas(element, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: true,
          allowTaint: true
        }).then(canvas => {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          });
          
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = pdfWidth - 20; // 10mm de margen a cada lado
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
          pdf.save(filename);
          
          toast({
            title: "Cuadrante semanal generado",
            description: "El PDF se ha descargado correctamente",
            variant: "default"
          });
        });
        return;
      } catch (error) {
        console.error("Error al generar el PDF del cuadrante semanal:", error);
        toast({
          title: "Error al generar el PDF",
          description: "Ocurrió un problema durante la generación",
          variant: "destructive"
        });
        return;
      }
    } else if (selectedReport === 'print-template') {
      // Para horarios individuales, generamos el PDF directamente con un diseño minimalista
      try {
        // Crear un nuevo PDF
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        // Título más pequeño para evitar desbordamiento
        pdf.setFontSize(12);
        const shortTitle = `Horarios: ${weekRangeText}`;
        pdf.text(shortTitle, pdf.internal.pageSize.getWidth() / 2, 10, { align: 'center' });
        
        // Configurar disposición simple (sin bordes)
        const pageWidth = pdf.internal.pageSize.getWidth();
        const marginX = 10;
        const marginY = 20; // Margen reducido
        const cardsPerRow = 3;
        const cardWidth = (pageWidth - (marginX * 2)) / cardsPerRow;
        const cardHeight = 38; // Altura ajustada para mejor legibilidad
        const spacing = 4; // Menos espacio entre tarjetas
        
        // Inicializar posición
        let currentX = marginX;
        let currentY = marginY;
        let cardCount = 0;
        
        // Para cada empleado, crear una sección simple sin bordes
        employees.forEach((employee, employeeIndex) => {
          // Verificar si necesitamos cambiar de fila
          if (cardCount > 0 && cardCount % cardsPerRow === 0) {
            currentX = marginX;
            currentY += cardHeight + spacing;
          }
          
          // Verificar si necesitamos una nueva página
          if (currentY + cardHeight > pdf.internal.pageSize.getHeight() - marginX) {
            pdf.addPage();
            currentX = marginX;
            currentY = marginY;
          }
          
          // Nombre del empleado (formateado) - sin borde
          const formattedName = formatEmployeeName(employee.name);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(formattedName, currentX + 1, currentY + 5);
          
          // No dibujamos ninguna línea ni borde
          
          // Establecer fuente más grande para los horarios
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          
          // Mostrar horarios por día
          let lineY = currentY + 10;
          weekDays.forEach((day, dayIndex) => {
            // Día de la semana (abreviado)
            const dayName = dayNames[dayIndex].substring(0, 3);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${dayName}${day.getDate()}:`, currentX + 1, lineY);
            
            // Buscar turnos para este empleado en este día
            const dayShifts = getWeekShifts().filter(shift => {
              const shiftDate = new Date(shift.date);
              return (
                shift.employeeId === employee.id && 
                shiftDate.getDate() === day.getDate() &&
                shiftDate.getMonth() === day.getMonth() &&
                shiftDate.getFullYear() === day.getFullYear()
              );
            });
            
            // Formatear horarios con formato super compacto
            let shiftsText = 'Libre';
            
            if (dayShifts.length > 0) {
              shiftsText = dayShifts.map((shift, i) => {
                const [startHour, startMinute] = shift.startTime.split(':').map(Number);
                const [endHour, endMinute] = shift.endTime.split(':').map(Number);
                const isMidnightCrossing = (endHour < startHour) || (endHour === 0 && endMinute === 0);
                
                // Formato extremadamente compacto
                const compactStart = shift.startTime.replace(/^0/, '');
                const compactEnd = shift.endTime.replace(/^0/, '');
                return isMidnightCrossing
                  ? `${compactStart}-${compactEnd}+`
                  : `${compactStart}-${compactEnd}`;
              }).join(' | '); // Cambiado a separador más visible con espacios
              
              // Texto de turno
              pdf.setFont('helvetica', 'normal');
              
              // Colorear turnos de medianoche en morado
              if (shiftsText.includes('+')) {
                pdf.setTextColor(138, 77, 247); // Morado para turnos de medianoche
              } else {
                pdf.setTextColor(0, 0, 0); // Negro normal
              }
            } else {
              pdf.setTextColor(180, 180, 180); // Gris más claro para "Libre"
              pdf.setFont('helvetica', 'italic');
            }
            
            // Alinear texto de turnos a la derecha con menos margen
            const textWidth = pdf.getTextWidth(shiftsText);
            pdf.text(shiftsText, currentX + cardWidth - 2 - textWidth, lineY);
            
            // Resetear color de texto
            pdf.setTextColor(0, 0, 0);
            
            // Avanzar a la siguiente línea (más espacio)
            lineY += 4.0;
          });
          
          // Actualizar posición para la siguiente tarjeta
          currentX += cardWidth;
          cardCount++;
        });
        
        // Guardar el PDF
        const dateRange = weekRangeText.replace(/\//g, "-");
        pdf.save(`horarios-empleados-${dateRange}.pdf`);
        
        // Notificar éxito
        toast({
          title: "Horarios individuales generados",
          description: "El PDF se ha descargado correctamente",
          variant: "default"
        });
        
        return;
      } catch (error) {
        console.error("Error al generar el PDF de horarios individuales:", error);
        toast({
          title: "Error al generar el PDF",
          description: "Ocurrió un problema durante la generación",
          variant: "destructive"
        });
        return;
      }
    }
    
    // Para el caso que no se haya manejado
    else {
      toast({
        title: "Tipo de informe no implementado",
        description: "Esta opción aún no está disponible",
        variant: "default"
      });
    }
  };

  // Renderizar el informe seleccionado
  const renderSelectedReport = () => {
    switch (selectedReport) {
      case 'week-schedule':
        return (
          <div className="rounded-md border" ref={weeklyScheduleRef}>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="min-w-full w-max-content table-auto border-collapse print:text-[8pt] print:w-full">
                <thead>
                  <tr>
                    <th className="border p-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 z-10 print:bg-gray-100 print:static" style={{ height: "42px", minHeight: "42px" }}>
                      Empleado
                    </th>
                    {dayNames.map((day, index) => (
                      <th key={day} className="border p-2 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase print:bg-gray-100" style={{ height: "42px", minHeight: "42px" }}>
                        {day} {weekDays[index].getDate()}
                      </th>
                    ))}
                    <th className="border p-2 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase print:bg-gray-100" style={{ height: "42px", minHeight: "42px" }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="text-xs print:text-[8pt]">
                  {employees.map((employee) => {
                    // Calcular las horas trabajadas para cada día de la semana
                    const weeklyHours = weekDays.map(day => {
                      // Filtrar turnos para este empleado en este día
                      const dayShifts = getWeekShifts().filter(shift => {
                        const shiftDate = new Date(shift.date);
                        return (
                          shift.employeeId === employee.id && 
                          shiftDate.getDate() === day.getDate() &&
                          shiftDate.getMonth() === day.getMonth() &&
                          shiftDate.getFullYear() === day.getFullYear()
                        );
                      });
                      
                      // Calcular horas totales para este día
                      let totalHours = 0;
                      dayShifts.forEach(shift => {
                        totalHours += calculateHoursBetween(shift.startTime, shift.endTime);
                      });
                      
                      // Formatear los detalles de turnos como array con formato compacto
                      const shiftsDetails = dayShifts.map(shift => {
                        // Formato más compacto, sin ceros en las horas y sin espacios
                        const compactStart = shift.startTime.replace(/^0/, '');
                        const compactEnd = shift.endTime.replace(/^0/, '');
                        return `${compactStart}-${compactEnd}`;
                      });
                      
                      return { totalHours, shiftsDetails };
                    });
                    
                    // Calcular total de horas para la semana
                    const totalWeeklyHours = weeklyHours.reduce(
                      (sum, day) => sum + day.totalHours, 0
                    );
                    
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="border p-2 text-xs font-medium sticky left-0 z-10 bg-white" style={{ height: "40px", minHeight: "40px" }}>
                          {employee.name}
                        </td>
                        
                        {weeklyHours.map((day, index) => (
                          <td key={index} className="border p-2 text-center text-xs" style={{ height: "40px", minHeight: "40px" }}>
                            {day.shiftsDetails?.length > 0 ? (
                              <div className="flex flex-col gap-1 text-xs text-gray-700">
                                {day.shiftsDetails.map((shift, idx) => {
                                  const containsMidnightIndicator = shift.includes('+1');
                                  return (
                                    <div 
                                      key={idx} 
                                      style={{ 
                                        color: containsMidnightIndicator ? '#8a4df7' : 'inherit',
                                        fontWeight: containsMidnightIndicator ? 'bold' : 'normal'
                                      }}
                                    >
                                      {shift}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-gray-500 italic text-[0.6rem]">Libre</span>
                            )}
                          </td>
                        ))}
                        
                        <td className="border p-2 text-center font-medium" style={{ height: "40px", minHeight: "40px" }}>
                          {formatHours(totalWeeklyHours)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'cost-report':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <DollarSign size={48} className="text-amber-500 mb-4" />
            <div className="text-center text-muted-foreground">
              <h3 className="text-lg font-medium mb-2">Informe de Costes</h3>
              <p className="mb-4">
                Este informe mostrará un análisis detallado de los costes de personal por día, semana y empleado.
              </p>
              <div className="text-sm text-gray-500">
                Próximamente disponible.
              </div>
            </div>
          </div>
        );
      case 'productivity-report':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <BarChart2 size={48} className="text-indigo-500 mb-4" />
            <div className="text-center text-muted-foreground">
              <h3 className="text-lg font-medium mb-2">Informe de Productividad</h3>
              <p className="mb-4">
                Visualiza la relación entre horas trabajadas y ventas generadas para optimizar la eficiencia.
              </p>
              <div className="text-sm text-gray-500">
                Próximamente disponible.
              </div>
            </div>
          </div>
        );
      case 'time-report':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Clock size={48} className="text-blue-500 mb-4" />
            <div className="text-center text-muted-foreground">
              <h3 className="text-lg font-medium mb-2">Informe de Horas</h3>
              <p className="mb-4">
                Reporte detallado de horas trabajadas por cada empleado, incluyendo totales acumulados.
              </p>
              <div className="text-sm text-gray-500">
                Próximamente disponible.
              </div>
            </div>
          </div>
        );
      case 'attendance-report':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Users size={48} className="text-green-500 mb-4" />
            <div className="text-center text-muted-foreground">
              <h3 className="text-lg font-medium mb-2">Informe de Asistencia</h3>
              <p className="mb-4">
                Control de asistencia y puntualidad de los empleados, con estadísticas por persona.
              </p>
              <div className="text-sm text-gray-500">
                Próximamente disponible.
              </div>
            </div>
          </div>
        );
      case 'print-template':
        return (
          <div className="print-employee-schedule p-4 bg-white" ref={printTemplateRef}>
            <h2 className="text-lg font-medium mb-6 text-center">Horarios Individuales - Semana: {weekRangeText}</h2>
            
            {/* Vista compacta de una sola página */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3"
                 style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', width: '100%' }}>
              {employees.map(employee => {
                // Formatear el nombre del empleado (nombre + iniciales)
                const formattedName = formatEmployeeName(employee.name);
                
                return (
                <div key={employee.id} className="mb-4 print:break-inside-avoid p-2 bg-white"
                     style={{ 
                       margin: '0 0 0.5rem 0', 
                       padding: '0.5rem', 
                       backgroundColor: 'white'
                     }}>
                  <div className="mb-1"
                       style={{ marginBottom: '0.3rem' }}>
                    <h3 className="text-sm font-bold text-gray-800"
                        style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>{formattedName}</h3>
                  </div>
                  
                  <div className="text-xs space-y-2" style={{ fontSize: '11px' }}>
                    {weekDays.map((day, index) => {
                      // Buscar turnos para este empleado en este día
                      const dayShifts = getWeekShifts().filter(shift => {
                        const shiftDate = new Date(shift.date);
                        return (
                          shift.employeeId === employee.id && 
                          shiftDate.getDate() === day.getDate() &&
                          shiftDate.getMonth() === day.getMonth() &&
                          shiftDate.getFullYear() === day.getFullYear()
                        );
                      });
                      
                      // Formatear horarios con formato compacto
                      const shiftsArray = dayShifts.map(shift => {
                        // Formato más compacto, sin ceros en las horas y sin espacios
                        const compactStart = shift.startTime.replace(/^0/, '');
                        const compactEnd = shift.endTime.replace(/^0/, '');
                        return `${compactStart}-${compactEnd}`;
                      });
                      
                      return (
                        <div key={index} className="flex justify-between items-center py-1"
                             style={{ 
                               display: 'flex', 
                               justifyContent: 'space-between', 
                               alignItems: 'center',
                               padding: '0.5rem 0',
                               marginBottom: '0.1rem',
                               borderBottom: index < 6 ? '1px dotted #eee' : 'none'
                             }}>
                          <span className="font-medium text-gray-700"
                                style={{ fontWeight: '600', minWidth: '50px' }}>
                            {dayNames[index].substring(0, 3)} {day.getDate()}
                          </span>
                          <span className="text-gray-800" style={{ textAlign: 'right' }}>
                            {shiftsArray.length > 0 ? (
                              <span>
                                {shiftsArray.map((shift, i) => {
                                  return (
                                    <span key={i}>
                                      {i > 0 && <span style={{ color: '#888', margin: '0 0.3em' }}>|</span>}
                                      <span style={{ 
                                        letterSpacing: '0.05em', 
                                        padding: '0 0.15em'
                                      }}>
                                        {shift}
                                      </span>
                                    </span>
                                  );
                                })}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic" style={{ color: '#aaa', fontStyle: 'italic' }}>Libre</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )})}
            </div>
          </div>
        );
      case 'export-csv':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <ClipboardList size={48} className="text-orange-500 mb-4" />
            <div className="text-center text-muted-foreground">
              <h3 className="text-lg font-medium mb-2">Exportar Datos (CSV)</h3>
              <p className="mb-4">
                Exporta todos los datos de turnos en formato CSV para análisis en Excel u otras herramientas.
              </p>
              <div className="text-sm text-gray-500">
                Próximamente disponible.
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportaciones
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] max-h-[85vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle>Exportaciones e Informes</DialogTitle>
        </DialogHeader>
        
        {/* Selector de semana */}
        <div className="flex items-center justify-center mb-6 mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToPrevWeek}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="mx-4 font-medium">
            Semana: {weekRangeText}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToNextWeek}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Si no hay informe seleccionado, mostrar la grid de botones */}
        {!selectedReport ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-28 flex flex-col items-center justify-center gap-2 p-2"
                onClick={() => setSelectedReport('week-schedule')}
              >
                <Calendar className="h-8 w-8 text-indigo-500" />
                <div className="text-center">Cuadrante Semanal</div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-28 flex flex-col items-center justify-center gap-2 p-2"
                onClick={() => setSelectedReport('print-template')}
              >
                <FileText className="h-8 w-8 text-teal-500" />
                <div className="text-center">Horario por Empleado</div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-28 flex flex-col items-center justify-center gap-2 p-2"
                onClick={() => setSelectedReport('night-hours-weekly')}
              >
                <Moon className="h-8 w-8 text-violet-500" />
                <div className="text-center">Horas Nocturnas Semanal</div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-28 flex flex-col items-center justify-center gap-2 p-2"
                onClick={() => setSelectedReport('night-hours-monthly')}
              >
                <CalendarClock className="h-8 w-8 text-purple-500" />
                <div className="text-center">Horas Nocturnas Mensual</div>
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Mostrar el informe seleccionado */}
            <div className="max-h-[50vh] overflow-y-auto">
              {renderSelectedReport()}
            </div>
            
            {/* Botones de acción */}
            <div className="flex justify-between mt-6">
              <Button 
                variant="outline" 
                onClick={() => setSelectedReport(null)}
              >
                Volver
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                >
                  Cerrar
                </Button>
                
                <Button 
                  onClick={generateWeeklySchedulePDF}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
});

// Nombre para la depuración
ExportsModal.displayName = 'ExportsModal';

// Exportamos el componente
export default ExportsModal;