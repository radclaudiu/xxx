import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDate, formatDateForAPI, getPreviousDay, getNextDay } from "@/lib/date-helpers";
import { useToast } from "@/hooks/use-toast";
import { Employee, Shift, InsertShift } from "@shared/schema";
import ScheduleTable from "@/components/schedule-table";
import EmployeeModal from "@/components/employee-modal";
import HelpModal from "@/components/help-modal";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Save, FolderOpen, HelpCircle, UserPlus } from "lucide-react";

export default function Home() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  const { toast } = useToast();
  
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
  
  // Fetch shifts for the current day
  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ["/api/shifts", formatDateForAPI(currentDate)],
    queryFn: async () => {
      const response = await fetch(`/api/shifts?date=${formatDateForAPI(currentDate)}`);
      if (!response.ok) throw new Error("Failed to fetch shifts");
      return response.json();
    },
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
        queryKey: ["/api/shifts", formatDateForAPI(currentDate)] 
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
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white p-4 shadow-md">
        <div className="w-full px-2 flex justify-between items-center">
          <h1 className="text-xl font-bold">Sistema de Turnos de Trabajo</h1>
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
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-grow p-4">
        <div className="w-full bg-white rounded-lg shadow-md p-4">
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
    </div>
  );
}
