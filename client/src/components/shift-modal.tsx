import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Employee, Shift, InsertShift } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateForAPI, formatDate, generateTimeSlots, convertTimeToMinutes } from "@/lib/date-helpers";
import { X } from "lucide-react";

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  date: Date;
  initialTime?: string;
  shift: Shift | null;
}

export default function ShiftModal({ 
  isOpen, 
  onClose, 
  employee, 
  date, 
  initialTime,
  shift 
}: ShiftModalProps) {
  // Generate time slots from 9:00 to 18:00
  const startTimeOptions = generateTimeSlots(9, 17);
  const endTimeOptions = generateTimeSlots(9, 18).slice(1); // Start from 9:30
  
  const [startTime, setStartTime] = useState<string>(initialTime || "09:00");
  const [endTime, setEndTime] = useState<string>("09:30");
  const [notes, setNotes] = useState<string>("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Reset form when modal opens or shift changes
  useEffect(() => {
    if (isOpen) {
      if (shift) {
        // If editing an existing shift
        setStartTime(shift.startTime);
        setEndTime(shift.endTime);
        setNotes(shift.notes || "");
      } else if (initialTime) {
        // If creating a new shift with selected range
        setStartTime(initialTime);
        
        // Find next time slot after initialTime
        const timeIndex = startTimeOptions.indexOf(initialTime);
        let suggestedEndTime = "09:30";
        
        if (timeIndex >= 0 && timeIndex + 1 < endTimeOptions.length) {
          suggestedEndTime = endTimeOptions[timeIndex + 1];
        }
        
        // Get the next slot after the selected initialTime
        setEndTime(suggestedEndTime);
        setNotes("");
      } else {
        // Default values for new shift
        setStartTime("09:00");
        setEndTime("09:30");
        setNotes("");
      }
    }
  }, [isOpen, shift, initialTime, startTimeOptions, endTimeOptions]);
  
  // Handle start time change
  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    
    // Update end time if it's before or equal to the new start time
    const startMinutes = convertTimeToMinutes(value);
    const endMinutes = convertTimeToMinutes(endTime);
    
    if (endMinutes <= startMinutes) {
      // Find the next time slot after the new start time
      const startIndex = startTimeOptions.indexOf(value);
      if (startIndex >= 0 && startIndex + 1 < endTimeOptions.length) {
        setEndTime(endTimeOptions[startIndex + 1]);
      } else {
        // If we're at the last start time option, just set the end time to the last end time option
        setEndTime(endTimeOptions[endTimeOptions.length - 1]);
      }
    }
  };
  
  // Create shift mutation
  const createMutation = useMutation({
    mutationFn: async (newShift: InsertShift) => {
      const response = await apiRequest("POST", "/api/shifts", newShift);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/shifts", formatDateForAPI(date)] 
      });
      toast({
        title: "Turno asignado",
        description: "El turno ha sido asignado exitosamente.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al asignar turno: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Update shift mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertShift> }) => {
      const response = await apiRequest("PUT", `/api/shifts/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/shifts", formatDateForAPI(date)] 
      });
      toast({
        title: "Turno actualizado",
        description: "El turno ha sido actualizado exitosamente.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al actualizar turno: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Delete shift mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/shifts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/shifts", formatDateForAPI(date)] 
      });
      toast({
        title: "Turno eliminado",
        description: "El turno ha sido eliminado exitosamente.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al eliminar turno: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employee) {
      toast({
        title: "Error",
        description: "No se ha seleccionado un empleado.",
        variant: "destructive",
      });
      return;
    }
    
    const shiftData: InsertShift = {
      employeeId: employee.id,
      date: formatDateForAPI(date),
      startTime,
      endTime,
      notes,
    };
    
    if (shift) {
      updateMutation.mutate({ id: shift.id, data: shiftData });
    } else {
      createMutation.mutate(shiftData);
    }
  };
  
  // Handle delete button click
  const handleDelete = () => {
    if (!shift) return;
    
    deleteMutation.mutate(shift.id);
  };
  
  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  
  if (!employee) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {shift ? "Editar Turno" : "Asignar Turno"}
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
            <div id="employeeInfoContainer">
              <p className="text-neutral-700 font-medium">Empleado: <span className="font-normal">{employee.name}</span></p>
              <p className="text-neutral-700 font-medium mt-1">Fecha: <span className="font-normal">{formatDate(date)}</span></p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Hora de inicio</Label>
                <Select 
                  value={startTime} 
                  onValueChange={handleStartTimeChange}
                  disabled={isLoading}
                >
                  <SelectTrigger id="startTime">
                    <SelectValue placeholder="Seleccionar hora" />
                  </SelectTrigger>
                  <SelectContent>
                    {startTimeOptions.map((time) => (
                      <SelectItem key={`start-${time}`} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="endTime">Hora de fin</Label>
                <Select 
                  value={endTime} 
                  onValueChange={setEndTime}
                  disabled={isLoading}
                >
                  <SelectTrigger id="endTime">
                    <SelectValue placeholder="Seleccionar hora" />
                  </SelectTrigger>
                  <SelectContent>
                    {endTimeOptions.map((time) => (
                      <SelectItem 
                        key={`end-${time}`} 
                        value={time}
                        disabled={startTimeOptions.indexOf(time) <= startTimeOptions.indexOf(startTime)}
                      >
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="shiftNotes">Notas (opcional)</Label>
              <Textarea
                id="shiftNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalles adicionales del turno"
                disabled={isLoading}
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter className="flex justify-between sm:justify-between">
            {shift && (
              <Button 
                type="button" 
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
              >
                Eliminar Turno
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
