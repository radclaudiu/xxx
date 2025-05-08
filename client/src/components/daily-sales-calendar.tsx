import React, { useState, useEffect } from 'react';
import { DailySales } from '@shared/schema';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatDateForAPI } from '@/lib/date-helpers';
import { toast } from '@/hooks/use-toast';
import { CalendarIcon, Save, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DailySalesCalendarProps {
  companyId: number;
}

export default function DailySalesCalendar({ companyId }: DailySalesCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [estimatedSales, setEstimatedSales] = useState<string>('');
  const [hourlyEmployeeCost, setHourlyEmployeeCost] = useState<string>('');
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
    mutationFn: async (data: { date: string; estimatedSales: number; hourlyEmployeeCost?: number }) => {
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
      setHourlyEmployeeCost(dailySale.hourlyEmployeeCost?.toString() || '');
    } else {
      // Si no hay datos para esta fecha, limpiar los campos
      setEstimatedSales('');
      setHourlyEmployeeCost('');
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
      estimatedSales: parseFloat(estimatedSales),
      hourlyEmployeeCost: hourlyEmployeeCost ? parseFloat(hourlyEmployeeCost) : undefined
    });
  };

  // Función para renderizar días con datos especiales
  const renderDay = (day: Date) => {
    if (!dailySales) return null;
    
    const formattedDay = formatDateForAPI(day);
    const dailySale = dailySales.find(ds => ds.date === formattedDay);
    
    // Si hay datos para este día, mostrar un punto o algún indicador visual
    if (dailySale) {
      return (
        <div className="h-full w-full flex items-center justify-center relative">
          {day.getDate()}
          <div className="absolute bottom-1 w-1 h-1 bg-primary rounded-full"></div>
        </div>
      );
    }
    
    return day.getDate();
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
            components={{
              Day: ({ day, ...props }) => (
                <button {...props}>
                  {renderDay(day)}
                </button>
              )
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
            <div className="grid gap-2">
              <Label htmlFor="hourlyCost">Coste por empleado y hora</Label>
              <Input
                id="hourlyCost"
                type="number"
                placeholder="Ingresa el coste por hora"
                value={hourlyEmployeeCost}
                onChange={(e) => setHourlyEmployeeCost(e.target.value)}
                min="0"
                step="0.01"
              />
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