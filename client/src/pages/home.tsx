import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDate, formatDateForAPI, getPreviousDay, getNextDay, getStartOfWeek, calculateHoursBetween } from "@/lib/date-helpers";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Employee, Shift, InsertShift } from "@shared/schema";
import ScheduleTable from "@/components/schedule-table";
import EmployeeModal from "@/components/employee-modal";
import HelpModal from "@/components/help-modal";
import ExportsModal, { ExportsModalRef } from "@/components/exports-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Save, FolderOpen, HelpCircle, UserPlus, DollarSign, Clock, Calendar, FileText, Settings } from "lucide-react";

export default function Home() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isWeekViewOpen, setIsWeekViewOpen] = useState(false);
  
  // Referencia para el modal de exportaciones
  const exportsModalRef = useRef<ExportsModalRef>(null);
  
  // Estados para gestionar los datos financieros
  const [estimatedDailySales, setEstimatedDailySales] = useState<string>('');
  const [hourlyEmployeeCost, setHourlyEmployeeCost] = useState<string>('');
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Obtener las empresas asociadas al usuario
  const { data: companies = [] } = useQuery({
    queryKey: ["/api/companies"],
  });
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent handling shortcuts when modals are open or in input fields
      if (
        isEmployeeModalOpen || 
        isHelpModalOpen || 
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      
      if (e.key === "ArrowLeft") {
        handlePreviousDay();
      } else if (e.key === "ArrowRight") {
        handleNextDay();
      } else if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        // Save functionality could be implemented here
        toast({
          title: "Función no implementada",
          description: "La funcionalidad de guardar está en desarrollo.",
        });
      } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        // Load functionality could be implemented here
        toast({
          title: "Función no implementada",
          description: "La funcionalidad de cargar está en desarrollo.",
        });
      } else if (e.ctrlKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setIsEmployeeModalOpen(true);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEmployeeModalOpen, isHelpModalOpen, toast]);
  
  // Fetch employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });
  
  // Fetch all shifts (without date filter) for use in exports
  const { data: allShifts = [] } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    queryFn: async () => {
      const response = await fetch(`/api/shifts`);
      if (!response.ok) throw new Error("Failed to fetch shifts");
      return response.json();
    },
  });
  
  // Filter shifts for the current day (for the main schedule display)
  const shifts = allShifts.filter(shift => {
    const shiftDate = new Date(shift.date);
    const formattedCurrentDate = formatDateForAPI(currentDate);
    const formattedShiftDate = formatDateForAPI(shiftDate);
    return formattedShiftDate === formattedCurrentDate;
  });
  
  // Navigate to previous day
  const handlePreviousDay = () => {
    setCurrentDate(getPreviousDay(currentDate));
  };
  
  // Navigate to next day
  const handleNextDay = () => {
    setCurrentDate(getNextDay(currentDate));
  };
  
  // Create shift mutation
  const createShiftMutation = useMutation({
    mutationFn: async (newShift: InsertShift) => {
      const response = await apiRequest("POST", "/api/shifts", newShift);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/shifts"] 
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al asignar turno: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Delete shift mutation
  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      const response = await apiRequest("DELETE", `/api/shifts/${shiftId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/shifts"] 
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al eliminar turno: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Handle saving selected shifts
  const handleSaveShifts = (selections: {employee: Employee, startTime: string, endTime: string}[]) => {
    // Process each selection and create a shift
    const promises = selections.map(selection => {
      const shiftData: InsertShift = {
        employeeId: selection.employee.id,
        date: formatDateForAPI(currentDate),
        startTime: selection.startTime,
        endTime: selection.endTime,
        notes: "",
      };
      
      return createShiftMutation.mutateAsync(shiftData);
    });
    
    // Wait for all shifts to be created
    Promise.all(promises)
      .then(() => {
        // Eliminamos la notificación de éxito para que no moleste al usuario
        // cuando se hacen múltiples selecciones automáticas
        // Solo guardaremos el turno silenciosamente
      })
      .catch((error) => {
        toast({
          title: "Error",
          description: `Algunos turnos no pudieron ser asignados. ${error.message}`,
          variant: "destructive",
        });
      });
  };
  
  // Save schedule (placeholder)
  const handleSaveSchedule = () => {
    toast({
      title: "Guardado",
      description: "Horario guardado exitosamente.",
    });
  };
  
  // Load schedule (placeholder)
  const handleLoadSchedule = () => {
    toast({
      title: "Cargado",
      description: "Horario cargado exitosamente.",
    });
  };
  
  // Handle deleting a shift
  const handleDeleteShift = (shiftId: number) => {
    deleteShiftMutation.mutate(shiftId);
  };
  
  return (
    <div className="min-h-screen flex flex-col w-full max-w-[100vw] overflow-x-hidden">
      {/* Header */}
      <header className="bg-primary text-white p-2 md:p-4 shadow-md w-full">
        <div className="w-full px-1 md:px-2 flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold">Sistema de Turnos de Trabajo</h1>
            {companies.length > 0 && (
              <div className="text-sm font-medium opacity-90">
                Empresa: {companies[0].name}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user?.role === 'admin' && (
              <Link href="/admin">
                <Button 
                  variant="secondary" 
                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 px-3 py-1 rounded flex items-center gap-1 text-sm font-medium"
                >
                  <Settings className="h-4 w-4" />
                  Administración
                </Button>
              </Link>
            )}
            <Button 
              variant="secondary" 
              className="bg-white text-primary px-3 py-1 rounded flex items-center gap-1 text-sm font-medium hover:bg-gray-100"
              onClick={handleSaveSchedule}
            >
              <Save className="h-4 w-4" />
              Guardar
            </Button>
            <Button 
              variant="secondary" 
              className="bg-white text-primary px-3 py-1 rounded flex items-center gap-1 text-sm font-medium hover:bg-gray-100"
              onClick={handleLoadSchedule}
            >
              <FolderOpen className="h-4 w-4" />
              Cargar
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-grow p-2 md:p-4 w-full overflow-x-hidden">
        <div className="w-full bg-white rounded-lg shadow-md p-2 md:p-4 overflow-x-hidden">
          {/* Financial Inputs and Costs Summary */}
          <div className="flex flex-col mb-4 gap-3 bg-blue-50 p-3 rounded-lg">
            {/* Inputs Row */}
            <div className="flex flex-wrap items-center gap-4 w-full">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <Label htmlFor="estimatedSales" className="mb-1 text-sm font-medium flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Venta Estimada Diaria
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="estimatedSales"
                      type="number"
                      placeholder="0.00"
                      value={estimatedDailySales}
                      onChange={(e) => setEstimatedDailySales(e.target.value)}
                      className="w-32 text-base"
                      min="0"
                      step="0.01"
                    />
                    <span className="ml-1 text-sm text-gray-500">€</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <Label htmlFor="hourlyCost" className="mb-1 text-sm font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Coste por Hora de Empleado
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="hourlyCost"
                      type="number"
                      placeholder="0.00"
                      value={hourlyEmployeeCost}
                      onChange={(e) => setHourlyEmployeeCost(e.target.value)}
                      className="w-32 text-base"
                      min="0"
                      step="0.01"
                    />
                    <span className="ml-1 text-sm text-gray-500">€/hora</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Cost Summary Row */}
            {(parseFloat(estimatedDailySales) > 0 || parseFloat(hourlyEmployeeCost) > 0) && (
              <div className="flex flex-wrap items-center gap-6 mt-1 pt-2 border-t border-blue-200">
                {parseFloat(hourlyEmployeeCost) > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">Coste Total Personal:</span>
                    <span className="bg-white px-2 py-0.5 rounded text-sm text-blue-700 font-medium">
                      {(() => {
                        // Calcular horas totales programadas para el día
                        const totalHours = shifts.reduce((acc, shift) => {
                          if (shift.date === formatDateForAPI(currentDate)) {
                            return acc + calculateHoursBetween(shift.startTime, shift.endTime);
                          }
                          return acc;
                        }, 0);
                        
                        // Calcular coste total
                        const totalCost = totalHours * parseFloat(hourlyEmployeeCost);
                        return `${totalCost.toFixed(2)} €`;
                      })()}
                    </span>
                  </div>
                )}
                
                {parseFloat(estimatedDailySales) > 0 && parseFloat(hourlyEmployeeCost) > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">% de Ventas:</span>
                    <span className={`bg-white px-2 py-0.5 rounded text-sm font-medium ${(() => {
                      // Calcular horas totales programadas para el día
                      const totalHours = shifts.reduce((acc, shift) => {
                        if (shift.date === formatDateForAPI(currentDate)) {
                          return acc + calculateHoursBetween(shift.startTime, shift.endTime);
                        }
                        return acc;
                      }, 0);
                      
                      // Calcular coste total y porcentaje
                      const totalCost = totalHours * parseFloat(hourlyEmployeeCost);
                      const percentage = (totalCost / parseFloat(estimatedDailySales)) * 100;
                      
                      // Determinar color basado en porcentaje
                      if (percentage <= 20) return "text-green-600";
                      if (percentage <= 30) return "text-amber-600";
                      return "text-red-600";
                    })()}`}>
                      {(() => {
                        // Calcular horas totales programadas para el día
                        const totalHours = shifts.reduce((acc, shift) => {
                          if (shift.date === formatDateForAPI(currentDate)) {
                            return acc + calculateHoursBetween(shift.startTime, shift.endTime);
                          }
                          return acc;
                        }, 0);
                        
                        // Calcular coste total y porcentaje
                        const totalCost = totalHours * parseFloat(hourlyEmployeeCost);
                        const percentage = (totalCost / parseFloat(estimatedDailySales)) * 100;
                        
                        return `${percentage.toFixed(1)}%`;
                      })()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center">
              <div className="flex items-center justify-between w-[300px]">
                <Button 
                  variant="outline" 
                  className="bg-neutral-100 hover:bg-neutral-200 p-2 rounded-full"
                  onClick={handlePreviousDay}
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span className="sr-only">Día anterior</span>
                </Button>
                <div className="text-xl font-medium px-4 w-[200px] text-center flex justify-center items-center">
                  <span>{formatDate(currentDate)}</span>
                </div>
                <Button 
                  variant="outline" 
                  className="bg-neutral-100 hover:bg-neutral-200 p-2 rounded-full"
                  onClick={handleNextDay}
                >
                  <ChevronRight className="h-5 w-5" />
                  <span className="sr-only">Día siguiente</span>
                </Button>
              </div>

              <Button 
                variant="outline"
                className="flex items-center gap-1 ml-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                onClick={() => {
                  // Abre el modal de exportaciones directamente con el reporte de semana seleccionado
                  if (exportsModalRef.current) {
                    exportsModalRef.current.openWithReport('week-schedule');
                  }
                }}
              >
                <Calendar className="h-4 w-4" />
                <span>Ver Semana</span>
              </Button>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 px-3 py-1 rounded flex items-center gap-1 text-sm font-medium"
                onClick={() => {
                  if (exportsModalRef.current) {
                    exportsModalRef.current.openWithReport('exports');
                  }
                }}
              >
                <FileText className="h-4 w-4" />
                Exportar
              </Button>
              <Button
                className="bg-[#F57C00] text-white px-4 py-2 rounded flex items-center gap-1 text-sm font-medium hover:bg-opacity-90"
                onClick={() => setIsEmployeeModalOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
                Agregar Empleado
              </Button>
              <Button
                variant="outline"
                className="bg-neutral-100 hover:bg-neutral-200 p-2 rounded-full"
                onClick={() => setIsHelpModalOpen(true)}
              >
                <HelpCircle className="h-5 w-5" />
                <span className="sr-only">Ayuda</span>
              </Button>
            </div>
          </div>
          
          {/* Schedule Table */}
          <ScheduleTable 
            employees={employees} 
            shifts={shifts} 
            date={currentDate}
            onSaveShifts={handleSaveShifts}
            onDeleteShift={handleDeleteShift}
            estimatedDailySales={parseFloat(estimatedDailySales) || 0}
            hourlyEmployeeCost={parseFloat(hourlyEmployeeCost) || 0}
          />
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-neutral-100 py-3 text-neutral-500 text-center text-sm w-full">
        <div className="w-full px-2">
          Sistema de Turnos de Trabajo &copy; {new Date().getFullYear()}
        </div>
      </footer>
      
      {/* Modals */}
      <EmployeeModal 
        isOpen={isEmployeeModalOpen} 
        onClose={() => setIsEmployeeModalOpen(false)} 
        employeeToEdit={null}
      />
      
      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
      />
      
      {/* Exportaciones Modal con referencia - usando todos los turnos */}
      <ExportsModal 
        employees={employees} 
        shifts={allShifts} 
        currentDate={currentDate}
        ref={exportsModalRef}
      />
    </div>
  );
}
