import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Employee, Shift } from "@shared/schema";
import { Download, Calendar, BarChart2, ClipboardList } from "lucide-react";
import { formatDate, getStartOfWeek, isInSameWeek, calculateHoursBetween, formatHours, formatDateForAPI } from "@/lib/date-helpers";

interface ExportsModalProps {
  employees: Employee[];
  shifts: Shift[];
  currentDate: Date;
}

export default function ExportsModal({ employees, shifts, currentDate }: ExportsModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Obtener la fecha de inicio de la semana (lunes)
  const weekStart = getStartOfWeek(currentDate);
  
  // Generar array con los 7 días de la semana actual
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    return day;
  });

  // Días de la semana en español para encabezados
  const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

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
      <DialogContent className="max-w-4xl w-[90vw]">
        <DialogHeader>
          <DialogTitle>Exportaciones e Informes</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="week-schedule">
          <TabsList className="mb-4">
            <TabsTrigger value="week-schedule" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Cuadrante Semanal</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1">
              <BarChart2 className="h-4 w-4" />
              <span>Informes</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-1">
              <ClipboardList className="h-4 w-4" />
              <span>Plantillas</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="week-schedule" className="px-1">
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                        Empleado
                      </th>
                      {dayNames.map((day, index) => (
                        <th key={day} className="border p-2 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase">
                          {day}
                          <div className="text-[0.6rem] font-normal text-gray-400">
                            {formatDate(weekDays[index])}
                          </div>
                        </th>
                      ))}
                      <th className="border p-2 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => {
                      // Calcular las horas trabajadas para cada día de la semana
                      const weeklyHours = weekDays.map(day => {
                        // Filtrar turnos para este empleado en este día
                        const dayShifts = shifts.filter(shift => {
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
                        
                        // Formatear los detalles de turnos
                        const shiftsDetails = dayShifts.map(shift => 
                          `${shift.startTime} - ${shift.endTime}`
                        ).join(", ");
                        
                        return { totalHours, shiftsDetails };
                      });
                      
                      // Calcular total de horas para la semana
                      const totalWeeklyHours = weeklyHours.reduce(
                        (sum, day) => sum + day.totalHours, 0
                      );
                      
                      return (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="border p-2 text-sm">
                            {employee.name}
                          </td>
                          
                          {weeklyHours.map((day, index) => (
                            <td key={index} className="border p-2 text-center text-xs">
                              {day.shiftsDetails ? (
                                <div>
                                  <div className="font-medium">{formatHours(day.totalHours)}</div>
                                  <div className="text-gray-500 text-[0.65rem]">{day.shiftsDetails}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          ))}
                          
                          <td className="border p-2 text-center font-medium">
                            {formatHours(totalWeeklyHours)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="p-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cerrar
                </Button>
                <Button 
                  onClick={() => {
                    // Aquí iría la funcionalidad para imprimir o exportar a PDF
                    window.print();
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="reports">
            <div className="flex flex-col gap-4 items-center justify-center py-8">
              <p className="text-muted-foreground text-center">
                Los informes estadísticos estarán disponibles próximamente.
              </p>
              <Button variant="outline" disabled>Informe de Costes</Button>
              <Button variant="outline" disabled>Informe de Productividad</Button>
              <Button variant="outline" disabled>Informe de Asistencia</Button>
            </div>
          </TabsContent>
          
          <TabsContent value="templates">
            <div className="flex flex-col gap-4 items-center justify-center py-8">
              <p className="text-muted-foreground text-center">
                Las plantillas para exportación estarán disponibles próximamente.
              </p>
              <Button variant="outline" disabled>Plantilla Simple</Button>
              <Button variant="outline" disabled>Plantilla Detallada</Button>
              <Button variant="outline" disabled>Plantilla para Nóminas</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}