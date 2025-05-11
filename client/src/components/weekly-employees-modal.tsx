import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/query-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Employee, InsertWeeklyEmployee, WeeklyEmployee } from "../../shared/schema";

// Calcula fechas de inicio y fin de semana desde una fecha dada
function getWeekRange(date: Date): { start: Date; end: Date } {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Lunes como inicio de semana
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 }); // Domingo como fin de semana
  return { start: weekStart, end: weekEnd };
}

interface WeeklyEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompanyId: number | null;
  currentDate: Date;
}

export default function WeeklyEmployeesModal({ 
  isOpen, 
  onClose, 
  currentCompanyId,
  currentDate
}: WeeklyEmployeesModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados para manejar la selección
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<Date>(currentDate);
  
  // Calcular la semana actual
  const weekRange = getWeekRange(selectedWeek);
  const weekStartStr = format(weekRange.start, "yyyy-MM-dd");
  const weekEndStr = format(weekRange.end, "yyyy-MM-dd");
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedEmployeeId("");
      setSelectedWeek(currentDate);
    }
  }, [isOpen, currentDate]);

  // Fetch all employees for the current company
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees", currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const url = `/api/employees?companyId=${currentCompanyId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch employees");
      return response.json();
    },
    enabled: !!currentCompanyId && isOpen
  });

  // Fetch weekly assignments for the current company and week
  const { data: weeklyEmployees = [], refetch: refetchWeeklyEmployees } = useQuery<WeeklyEmployee[]>({
    queryKey: ["/api/weekly-employees", currentCompanyId, weekStartStr, weekEndStr],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const url = `/api/weekly-employees?companyId=${currentCompanyId}&weekStartDate=${weekStartStr}&weekEndDate=${weekEndStr}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch weekly employees");
      return response.json();
    },
    enabled: !!currentCompanyId && isOpen
  });

  // Find assigned employees for this week
  const assignedEmployeeIds = weeklyEmployees.map(we => we.employeeId);
  
  // Filter out already assigned employees
  const availableEmployees = employees.filter(emp => !assignedEmployeeIds.includes(emp.id));

  // Create weekly employee assignment mutation
  const createMutation = useMutation({
    mutationFn: async (newWeeklyEmployee: InsertWeeklyEmployee) => {
      const response = await apiRequest("POST", "/api/weekly-employees", newWeeklyEmployee);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-employees"] });
      refetchWeeklyEmployees();
      toast({
        title: "Asignación agregada",
        description: "El empleado ha sido asignado a esta semana exitosamente.",
      });
      setSelectedEmployeeId("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al asignar empleado: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete weekly employee assignment mutation
  const deleteMutation = useMutation({
    mutationFn: async (weeklyEmployeeId: number) => {
      const response = await apiRequest("DELETE", `/api/weekly-employees/${weeklyEmployeeId}`);
      return response.status === 204;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-employees"] });
      refetchWeeklyEmployees();
      toast({
        title: "Asignación eliminada",
        description: "El empleado ha sido eliminado de esta semana.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al eliminar asignación: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleAddEmployee = () => {
    if (!selectedEmployeeId || !currentCompanyId) {
      toast({
        title: "Error",
        description: "Seleccione un empleado",
        variant: "destructive",
      });
      return;
    }

    const newWeeklyEmployee: InsertWeeklyEmployee = {
      employeeId: parseInt(selectedEmployeeId),
      companyId: currentCompanyId,
      weekStartDate: weekStartStr,
      weekEndDate: weekEndStr
    };

    createMutation.mutate(newWeeklyEmployee);
  };

  // Handle removing an employee from the week
  const handleRemoveEmployee = (weeklyEmployeeId: number) => {
    deleteMutation.mutate(weeklyEmployeeId);
  };

  // Handle week navigation
  const handlePreviousWeek = () => {
    setSelectedWeek(prevDate => addDays(prevDate, -7));
  };

  const handleNextWeek = () => {
    setSelectedWeek(prevDate => addDays(prevDate, 7));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gestión de empleados por semana</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          {/* Week selector */}
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePreviousWeek}
              className="h-8"
            >
              &lt; Semana anterior
            </Button>
            
            <div className="text-center font-medium">
              {format(weekRange.start, "dd MMM", { locale: es })} - {format(weekRange.end, "dd MMM yyyy", { locale: es })}
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNextWeek}
              className="h-8"
            >
              Semana siguiente &gt;
            </Button>
          </div>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Agregar empleado a esta semana</Label>
              <div className="flex space-x-2">
                <Select
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEmployees.length === 0 ? (
                      <SelectItem value="none" disabled>No hay empleados disponibles</SelectItem>
                    ) : (
                      availableEmployees.map(employee => (
                        <SelectItem key={employee.id} value={employee.id.toString()}>
                          {employee.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                
                <Button
                  type="button"
                  onClick={handleAddEmployee}
                  disabled={!selectedEmployeeId || createMutation.isPending}
                >
                  Agregar
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Empleados asignados a esta semana</Label>
              {weeklyEmployees.length > 0 ? (
                <div className="border rounded-md divide-y">
                  {weeklyEmployees.map(weeklyEmployee => {
                    const employee = employees.find(emp => emp.id === weeklyEmployee.employeeId);
                    return (
                      <div key={weeklyEmployee.id} className="p-2 flex justify-between items-center">
                        <span>{employee?.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEmployee(weeklyEmployee.id)}
                          className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          Quitar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border rounded-md p-4 text-center text-neutral-500">
                  No hay empleados asignados a esta semana
                </div>
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}