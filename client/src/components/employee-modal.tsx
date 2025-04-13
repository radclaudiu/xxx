import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { InsertEmployee, Employee } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeToEdit: Employee | null;
}

export default function EmployeeModal({ isOpen, onClose, employeeToEdit }: EmployeeModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [maxHoursPerWeek, setMaxHoursPerWeek] = useState("40"); // Default 40 hours
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Reset form when modal opens or employeeToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (employeeToEdit) {
        setName(employeeToEdit.name);
        setRole(employeeToEdit.role || "");
        setMaxHoursPerWeek(employeeToEdit.maxHoursPerWeek?.toString() || "40");
      } else {
        setName("");
        setRole("");
        setMaxHoursPerWeek("40");
      }
    }
  }, [isOpen, employeeToEdit]);
  
  // Create employee mutation
  const createMutation = useMutation({
    mutationFn: async (newEmployee: InsertEmployee) => {
      const response = await apiRequest("POST", "/api/employees", newEmployee);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Empleado agregado",
        description: "El empleado ha sido agregado exitosamente.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al agregar empleado: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Update employee mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertEmployee> }) => {
      const response = await apiRequest("PUT", `/api/employees/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Empleado actualizado",
        description: "El empleado ha sido actualizado exitosamente.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al actualizar empleado: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Delete employee mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      // Also invalidate shifts as they might be related to the deleted employee
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Empleado eliminado",
        description: "El empleado ha sido eliminado exitosamente.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al eliminar empleado: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "El nombre del empleado es requerido.",
        variant: "destructive",
      });
      return;
    }
    
    // Validar que maxHoursPerWeek sea un número válido
    const maxHours = parseInt(maxHoursPerWeek, 10);
    if (isNaN(maxHours) || maxHours < 0) {
      toast({
        title: "Error",
        description: "Las horas máximas semanales deben ser un número positivo.",
        variant: "destructive",
      });
      return;
    }
    
    const employeeData: InsertEmployee = {
      name: name.trim(),
      role: role.trim(),
      maxHoursPerWeek: maxHours
    };
    
    if (employeeToEdit) {
      updateMutation.mutate({ id: employeeToEdit.id, data: employeeData });
    } else {
      createMutation.mutate(employeeData);
    }
  };
  
  // Handle delete button click
  const handleDelete = () => {
    if (!employeeToEdit) return;
    
    if (confirm("¿Está seguro de que desea eliminar este empleado? Esta acción no se puede deshacer.")) {
      deleteMutation.mutate(employeeToEdit.id);
    }
  };
  
  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {employeeToEdit ? "Editar Empleado" : "Agregar Empleado"}
          </DialogTitle>
          <Button 
            variant="ghost" 
            className="absolute right-4 top-4" 
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="employeeName">
                Nombre del Empleado
              </Label>
              <Input
                id="employeeName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
                disabled={isLoading}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="employeeRole">
                Cargo
              </Label>
              <Input
                id="employeeRole"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Cargo o posición"
                disabled={isLoading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="maxHoursPerWeek" className="flex items-center gap-2">
                Horas Máximas Semanales
                <span className="text-xs text-muted-foreground">(Lun-Dom)</span>
              </Label>
              <Input
                id="maxHoursPerWeek"
                type="number"
                min="0"
                max="168"
                value={maxHoursPerWeek}
                onChange={(e) => setMaxHoursPerWeek(e.target.value)}
                placeholder="40"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <DialogFooter className="flex justify-between sm:justify-between">
            {employeeToEdit && (
              <Button 
                type="button" 
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
              >
                Eliminar
              </Button>
            )}
            
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={isLoading}
              >
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
