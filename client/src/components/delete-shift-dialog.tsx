import React from 'react';
import { Trash2 } from 'lucide-react';
import type { Shift } from '@shared/schema';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';

interface DeleteShiftDialogProps {
  shift: Shift;
  onConfirm: (shift: Shift) => void;
}

const DeleteShiftDialog: React.FC<DeleteShiftDialogProps> = ({ shift, onConfirm }) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs bg-transparent border-none text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Eliminar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar turno</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro que deseas eliminar el turno de {shift.startTime} a {shift.endTime}?
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(shift)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteShiftDialog;