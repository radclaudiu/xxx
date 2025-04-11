import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ayuda del Sistema</DialogTitle>
          <Button
            variant="ghost"
            className="absolute right-4 top-4"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="text-sm text-neutral-700 space-y-3">
          <p className="font-medium">Cómo usar el Sistema de Turnos de Trabajo:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Haga clic en las celdas de la tabla para seleccionar o deseleccionar franjas horarias.</li>
            <li>Las celdas seleccionadas se mostrarán con un punto verde.</li>
            <li>Use el botón "Guardar Turnos Seleccionados" para asignar los turnos.</li>
            <li>Utilice los botones de navegación para cambiar entre días.</li>
            <li>Agregue nuevos empleados con el botón "Agregar Empleado".</li>
            <li>Guarde el horario completo con el botón "Guardar" en la parte superior.</li>
            <li>Utilice "Cargar" para recuperar horarios guardados anteriormente.</li>
          </ol>
          <div className="mt-4 bg-neutral-100 p-3 rounded">
            <p className="font-medium mb-1">Atajos de teclado:</p>
            <ul className="space-y-1">
              <li>
                <span className="bg-neutral-200 px-1 rounded text-xs">←</span> / 
                <span className="bg-neutral-200 px-1 rounded text-xs">→</span> - 
                Día anterior / siguiente
              </li>
              <li>
                <span className="bg-neutral-200 px-1 rounded text-xs">Ctrl + S</span> - 
                Guardar horario
              </li>
              <li>
                <span className="bg-neutral-200 px-1 rounded text-xs">Ctrl + L</span> - 
                Cargar horario
              </li>
              <li>
                <span className="bg-neutral-200 px-1 rounded text-xs">Ctrl + E</span> - 
                Agregar empleado
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
