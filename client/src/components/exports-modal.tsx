import { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Employee, Shift } from "@shared/schema";
import { Download, Calendar, FileText, ClipboardList, ChevronLeft, ChevronRight, BarChart2, Clock, Users, DollarSign } from "lucide-react";
import { formatDate, getStartOfWeek, isInSameWeek, calculateHoursBetween, formatHours, formatDateForAPI } from "@/lib/date-helpers";

import html2pdf from "html2pdf.js";

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
  
  // Función para generar y descargar el PDF del informe seleccionado
  const generateWeeklySchedulePDF = () => {
    // Determinar cuál referencia usar según el tipo de reporte
    let element: HTMLDivElement | null = null;
    
    if (selectedReport === 'week-schedule') {
      element = weeklyScheduleRef.current;
    } else if (selectedReport === 'print-template') {
      element = printTemplateRef.current;
    }
    
    if (!element) {
      console.error("No se encontró el elemento de referencia para el reporte:", selectedReport);
      return;
    }
    
    // Configurar nombre del archivo según el tipo de reporte
    const dateRange = weekRangeText.replace(/\//g, "-");
    let filename = '';
    
    if (selectedReport === 'week-schedule') {
      filename = `cuadrante-semanal-${dateRange}.pdf`;
    } else if (selectedReport === 'print-template') {
      filename = `horarios-empleados-${dateRange}.pdf`;
    } else {
      filename = `informe-${dateRange}.pdf`;
    }
    
    console.log("Generando PDF para:", selectedReport);
    
    // Definir opciones para el PDF según el tipo de reporte
    let pdfOptions = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: selectedReport === 'print-template' ? 'portrait' : 'landscape'
      },
      pagebreak: { mode: 'avoid-all' }
    };
    
    // Crear una copia del elemento para modificarla sin afectar a la original
    const elementClone = element.cloneNode(true) as HTMLElement;
    document.body.appendChild(elementClone);
    elementClone.style.position = 'absolute';
    elementClone.style.left = '-9999px';
    
    // Ajustar estilos específicos para imprimir
    if (selectedReport === 'print-template') {
      // Para el reporte de horarios individuales
      const gridContainers = elementClone.querySelectorAll('.grid');
      gridContainers.forEach(grid => {
        (grid as HTMLElement).style.display = 'grid';
        (grid as HTMLElement).style.gridTemplateColumns = 'repeat(3, 1fr)';
        (grid as HTMLElement).style.gap = '8px';
      });
      
      // Asegurar que los bordes de las tarjetas sean visibles en el PDF
      const employeeCards = elementClone.querySelectorAll('.border');
      employeeCards.forEach(card => {
        (card as HTMLElement).style.border = '1px solid #ccc';
        (card as HTMLElement).style.borderRadius = '4px';
        (card as HTMLElement).style.padding = '8px';
        (card as HTMLElement).style.margin = '4px';
        (card as HTMLElement).style.backgroundColor = '#ffffff';
      });
      
      // Asegurar que la hora se muestre correctamente
      const timeSlots = elementClone.querySelectorAll('.flex.justify-between');
      timeSlots.forEach(slot => {
        (slot as HTMLElement).style.display = 'flex';
        (slot as HTMLElement).style.justifyContent = 'space-between';
        (slot as HTMLElement).style.marginBottom = '4px';
        
        // Dar estilos concretos a los textos
        const textElements = slot.querySelectorAll('span');
        if (textElements.length >= 2) {
          (textElements[0] as HTMLElement).style.fontWeight = 'bold';
          (textElements[0] as HTMLElement).style.minWidth = '50px';
          (textElements[1] as HTMLElement).style.textAlign = 'right';
          (textElements[1] as HTMLElement).style.color = '#333';
        }
      });
      
      // Mejorar la visibilidad de los nombres de empleados
      const employeeNames = elementClone.querySelectorAll('.text-base.font-bold');
      employeeNames.forEach(name => {
        (name as HTMLElement).style.borderBottom = '1px solid #ddd';
        (name as HTMLElement).style.paddingBottom = '4px';
        (name as HTMLElement).style.marginBottom = '6px';
        (name as HTMLElement).style.fontWeight = 'bold';
        (name as HTMLElement).style.fontSize = '14px';
      });
    } else {
      // Para el cuadrante semanal
      const tables = elementClone.querySelectorAll('table');
      tables.forEach(table => {
        table.style.width = '100%';
        table.style.fontSize = '9pt';
        table.style.borderCollapse = 'collapse';
        
        // Asegurar que todas las celdas tengan bordes
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
          (cell as HTMLElement).style.border = '1px solid #ccc';
          (cell as HTMLElement).style.padding = '4px';
        });
      });
    }
    
    // Generar el PDF
    try {
      html2pdf()
        .from(elementClone)
        .set(pdfOptions)
        .save()
        .then(() => {
          // Eliminar el clon una vez generado el PDF
          document.body.removeChild(elementClone);
          console.log("PDF generado con éxito");
        })
        .catch(error => {
          document.body.removeChild(elementClone);
          console.error("Error al generar el PDF:", error);
          alert("Error al generar el PDF. Por favor, inténtelo de nuevo.");
        });
    } catch (error) {
      console.error("Error al iniciar la generación del PDF:", error);
      document.body.removeChild(elementClone);
      alert("Error al generar el PDF. Por favor, inténtelo de nuevo.");
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
                      
                      // Formatear los detalles de turnos como array
                      const shiftsDetails = dayShifts.map(shift => 
                        `${shift.startTime} - ${shift.endTime}`
                      );
                      
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
                                {day.shiftsDetails.map((shift, idx) => (
                                  <div key={idx}>{shift}</div>
                                ))}
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
          <div className="print-employee-schedule" ref={printTemplateRef}>
            <h2 className="text-lg font-medium mb-6 text-center">Horarios Individuales - Semana: {weekRangeText}</h2>
            
            {/* Vista compacta de una sola página */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
              {employees.map(employee => {
                // Formatear el nombre del empleado (nombre + iniciales)
                const formattedName = formatEmployeeName(employee.name);
                
                return (
                <div key={employee.id} className="mb-4 print:break-inside-avoid border border-gray-300 p-3 rounded-md shadow-sm bg-white">
                  <div className="mb-2 border-b pb-1 border-gray-200">
                    <h3 className="text-base font-bold text-gray-800">{formattedName}</h3>
                  </div>
                  
                  <div className="text-xs space-y-2">
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
                      
                      // Formatear horarios
                      const shiftsArray = dayShifts.map(shift => 
                        `${shift.startTime} - ${shift.endTime}`
                      );
                      
                      return (
                        <div key={index} className="flex justify-between items-center py-1">
                          <span className="font-medium text-gray-700">{dayNames[index].substring(0, 3)} {day.getDate()}</span>
                          <span className="text-gray-800">
                            {shiftsArray.length > 0 ? (
                              shiftsArray.join(", ")
                            ) : (
                              <span className="text-gray-400 italic">Libre</span>
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
                onClick={() => setSelectedReport('cost-report')}
              >
                <DollarSign className="h-8 w-8 text-amber-500" />
                <div className="text-center">Informe de Costes</div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-28 flex flex-col items-center justify-center gap-2 p-2"
                onClick={() => setSelectedReport('productivity-report')}
              >
                <BarChart2 className="h-8 w-8 text-indigo-500" />
                <div className="text-center">Informe de Productividad</div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-28 flex flex-col items-center justify-center gap-2 p-2"
                onClick={() => setSelectedReport('time-report')}
              >
                <Clock className="h-8 w-8 text-blue-500" />
                <div className="text-center">Informe de Horas</div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-28 flex flex-col items-center justify-center gap-2 p-2"
                onClick={() => setSelectedReport('attendance-report')}
              >
                <Users className="h-8 w-8 text-green-500" />
                <div className="text-center">Informe de Asistencia</div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-28 flex flex-col items-center justify-center gap-2 p-2"
                onClick={() => setSelectedReport('export-csv')}
              >
                <ClipboardList className="h-8 w-8 text-orange-500" />
                <div className="text-center">Exportar Datos (CSV)</div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-28 flex flex-col items-center justify-center gap-2 p-2"
                onClick={() => setSelectedReport('print-template')}
              >
                <FileText className="h-8 w-8 text-teal-500" />
                <div className="text-center">Horario por Empleado</div>
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