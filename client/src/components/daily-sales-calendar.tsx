import React, { useState, useEffect } from 'react';
import { DailySales, Company } from '@shared/schema';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatDateForAPI } from '@/lib/date-helpers';
import { toast } from '@/hooks/use-toast';
import { CalendarIcon, Save, Loader2, InfoIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DailySalesCalendarProps {
  companyId: number;
}

export default function DailySalesCalendar({ companyId }: DailySalesCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [estimatedSales, setEstimatedSales] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Obtener datos de ventas diarias
  const { data: dailySales, isLoading: isLoadingDailySales } = useQuery({
    queryKey: ['/api/companies', companyId, 'daily-sales'],
    queryFn: async () => {
      if (!companyId) return [];
      const response = await fetch(`/api/companies/${companyId}/daily-sales`);
      if (!response.ok) {
        throw new Error('Error al cargar datos de ventas diarias');
      }
      return response.json() as Promise<DailySales[]>;
    },
    enabled: !!companyId
  });

  // Mutation para guardar/actualizar datos de ventas diarias
  const saveDailySalesMutation = useMutation({
    mutationFn: async (data: { date: string; estimatedSales: string }) => {
      const response = await apiRequest(
        'POST', 
        `/api/companies/${companyId}/daily-sales`, 
        data
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar datos');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Datos guardados",
        description: "Los datos de venta estimada se han guardado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'daily-sales'] });
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al guardar los datos",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  });

  // Cargar datos cuando cambia la fecha seleccionada
  useEffect(() => {
    if (!selectedDate || !dailySales) return;
    
    const formattedDate = formatDateForAPI(selectedDate);
    const dailySale = dailySales.find(ds => ds.date === formattedDate);
    
    if (dailySale) {
      setEstimatedSales(dailySale.estimatedSales?.toString() || '');
    } else {
      // Si no hay datos para esta fecha, limpiar los campos
      setEstimatedSales('');
    }
  }, [selectedDate, dailySales]);

  const handleSaveData = async () => {
    if (!selectedDate) {
      toast({
        title: "Error",
        description: "Selecciona una fecha",
        variant: "destructive"
      });
      return;
    }
    
    if (!estimatedSales) {
      toast({
        title: "Error",
        description: "Ingresa un valor para la venta estimada",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    saveDailySalesMutation.mutate({
      date: formatDateForAPI(selectedDate),
      estimatedSales: estimatedSales // Enviamos directamente el string
    });
  };

  // Función para marcar días con datos
  const getDayClass = (date: Date): string => {
    if (!dailySales) return "";
    
    const formattedDate = formatDateForAPI(date);
    const hasDailySale = dailySales.some(ds => ds.date === formattedDate);
    
    return hasDailySale ? "bg-primary/10 font-bold" : "";
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Calendario de Ventas</CardTitle>
          <CardDescription>
            Selecciona un día para ver o configurar la venta estimada
          </CardDescription>
        </CardHeader>
        <CardContent className="py-2">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border"
            modifiers={{
              hasDailySale: (date) => {
                if (!dailySales) return false;
                const formattedDate = formatDateForAPI(date);
                return dailySales.some(ds => ds.date === formattedDate);
              }
            }}
            modifiersClassNames={{
              hasDailySale: "bg-primary/10 font-bold"
            }}
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Datos de Venta Diaria</CardTitle>
          <CardDescription>
            {selectedDate ? (
              <>Configurar datos para: {selectedDate.toLocaleDateString()}</>
            ) : (
              <>Selecciona una fecha en el calendario</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="estimatedSales">Venta Estimada Diaria</Label>
              <Input
                id="estimatedSales"
                type="number"
                placeholder="Ingresa la venta estimada"
                value={estimatedSales}
                onChange={(e) => setEstimatedSales(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
              <InfoIcon className="h-3.5 w-3.5" />
              <span>El coste por empleado y hora se configura globalmente para toda la empresa</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleSaveData}
            disabled={isSubmitting || !selectedDate}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar datos
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}