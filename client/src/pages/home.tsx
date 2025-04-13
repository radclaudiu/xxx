import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDate, formatDateForAPI, getPreviousDay, getNextDay, getStartOfWeek } from "@/lib/date-helpers";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Employee, Shift, InsertShift } from "@shared/schema";
import ScheduleTable from "@/components/schedule-table";
import EmployeeModal from "@/components/employee-modal";
import HelpModal from "@/components/help-modal";
import ExportsModal, { ExportsModalRef } from "@/components/exports-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Save, FolderOpen, HelpCircle, UserPlus, DollarSign, Clock, Calendar } from "lucide-react";

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
  
  // Estado de autenticación
  const { user, isLoading, error, logoutMutation } = useAuth();
  
  const { toast } = useToast();
  
  // Mostrar información del usuario autenticado en la consola para depuración
  useEffect(() => {
    console.log("Home page - Auth state:", { 
      user, 
      isLoading, 
      error, 
      authenticated: !!user 
    });
  }, [user, isLoading, error]);
  
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
  const shifts = allShifts && allShifts.length > 0 
    ? allShifts.filter(shift => {
        if (!shift || !shift.date) return false;
        try {
          const shiftDate = new Date(shift.date);
          const formattedCurrentDate = formatDateForAPI(currentDate);
          const formattedShiftDate = formatDateForAPI(shiftDate);
          return formattedShiftDate === formattedCurrentDate;
        } catch (error) {
          console.error("Error al filtrar turno:", error);
          return false;
        }
      })
    : [];
  
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
        toast({
          title: "Turnos guardados",
          description: `Se han asignado ${selections.length} turno(s) exitosamente.`,
        });
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white p-4 shadow-md">
        <div className="w-full px-2 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Sistema de Turnos de Trabajo</h1>
            {user && (
              <span className="text-sm bg-white/20 px-2 py-1 rounded">
                {user.username}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            <Button 
              variant="destructive" 
              className="bg-red-600 text-white px-3 py-1 rounded flex items-center gap-1 text-sm font-medium hover:bg-red-700"
              onClick={() => {
                logoutMutation.mutate();
              }}
            >
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-grow p-4">
        <div className="w-full bg-white rounded-lg shadow-md p-4">
          {/* Financial Inputs */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 bg-blue-50 p-3 rounded-lg">
            <div className="flex flex-wrap items-center gap-4 w-full">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <Label htmlFor="estimatedSales" className="mb-1 text-xs font-medium flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Venta Estimada Diaria
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="estimatedSales"
                      type="number"
                      placeholder="0.00"
                      value={estimatedDailySales}
                      onChange={(e) => setEstimatedDailySales(e.target.value)}
                      className="w-32 text-sm"
                      min="0"
                      step="0.01"
                    />
                    <span className="ml-1 text-xs text-gray-500">€</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <Label htmlFor="hourlyCost" className="mb-1 text-xs font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Coste por Hora de Empleado
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="hourlyCost"
                      type="number"
                      placeholder="0.00"
                      value={hourlyEmployeeCost}
                      onChange={(e) => setHourlyEmployeeCost(e.target.value)}
                      className="w-32 text-sm"
                      min="0"
                      step="0.01"
                    />
                    <span className="ml-1 text-xs text-gray-500">€/hora</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                className="bg-neutral-100 hover:bg-neutral-200 p-2 rounded-full"
                onClick={handlePreviousDay}
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="sr-only">Día anterior</span>
              </Button>
              <div className="text-lg font-medium px-4 min-w-[200px] text-center">
                {formatDate(currentDate)}
              </div>
              <Button 
                variant="outline" 
                className="bg-neutral-100 hover:bg-neutral-200 p-2 rounded-full"
                onClick={handleNextDay}
              >
                <ChevronRight className="h-5 w-5" />
                <span className="sr-only">Día siguiente</span>
              </Button>
              
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
      <footer className="bg-neutral-100 py-3 text-neutral-500 text-center text-sm">
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
