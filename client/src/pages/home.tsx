import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  useToast 
} from "@/hooks/use-toast";
import { 
  Button 
} from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Building,
  Calendar,
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  DollarSign,
  FileText,
  FolderOpen,
  HelpCircle,
  LogOut,
  Save,
  Settings,
  UserPlus,
  Users
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import ScheduleTable from "@/components/schedule-table";
import EmployeeModal from "@/components/employee-modal";
import HelpModal from "@/components/help-modal";
import ExportsModal, { ExportsModalRef } from "@/components/exports-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  formatDateForAPI, 
  formatDate,
  getPreviousDay,
  getNextDay,
  calculateHoursBetween
} from "@/lib/date-helpers";
import { useAuth } from '@/hooks/use-auth';
import { Employee, InsertEmployee, InsertShift } from '@shared/schema';

export default function Home() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  
  // States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [estimatedDailySales, setEstimatedDailySales] = useState("0");
  const [hourlyEmployeeCost, setHourlyEmployeeCost] = useState("0");
  // Estados para rangos horarios (con valores por defecto que se actualizarán desde la empresa)
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(22);
  // Estado para el id de la empresa actual
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null);
  
  // Refs
  const exportsModalRef = useRef<ExportsModalRef>(null);
  
  // Fetch employees (filtrados por la empresa actual)
  const {
    data: employees = [],
    isLoading: isLoadingEmployees,
  } = useQuery<Employee[]>({
    queryKey: ["/api/employees", currentCompanyId],
    queryFn: async () => {
      const url = currentCompanyId ? `/api/employees?companyId=${currentCompanyId}` : "/api/employees";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Error al cargar empleados");
      }
      return response.json();
    },
    enabled: !!currentCompanyId,
    select: (data) => {
      return data.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  
  // Fetch shifts (filtrados por la empresa actual)
  const {
    data: allShifts = [],
    isLoading: isLoadingShifts,
  } = useQuery<any[]>({
    queryKey: ["/api/shifts", currentCompanyId],
    queryFn: async () => {
      const url = currentCompanyId ? `/api/shifts?companyId=${currentCompanyId}` : "/api/shifts";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Error al cargar turnos");
      }
      return response.json();
    },
    enabled: !!currentCompanyId,
    select: (data) => {
      return data.map((item) => {
        if (item.shifts) {
          return item.shifts; // Si los turnos están anidados dentro de un objeto
        }
        return item; // Si los turnos están en el primer nivel
      });
    },
  });
  
  // Fetch companies
  const {
    data: companies = [],
    isLoading: isLoadingCompanies,
  } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    select: (data) => {
      return data;
    },
  });
  
  // Actualizar los rangos horarios cuando se carguen las empresas
  useEffect(() => {
    if (companies.length > 0 && companies[0]) {
      // Establecer los valores desde la empresa o usar los valores por defecto
      setStartHour(companies[0].startHour || 9);
      setEndHour(companies[0].endHour || 22);
      setCurrentCompanyId(companies[0].id);
      console.log("Rango horario cargado de la empresa:", companies[0].startHour, "-", companies[0].endHour);
    }
  }, [companies]);
  
  // Mutación para actualizar el rango horario de la empresa
  const updateTimeRangeMutation = useMutation({
    mutationFn: async ({ companyId, startHour, endHour }: { companyId: number, startHour: number, endHour: number }) => {
      const response = await apiRequest("PATCH", `/api/companies/${companyId}`, { 
        startHour, 
        endHour 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/companies"] 
      });
      toast({
        title: "Configuración guardada",
        description: "El rango horario ha sido actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo guardar el rango horario: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Filter shifts for the current day (for the main schedule display)
  const currentDateFormatted = formatDateForAPI(currentDate);
  console.log("Fecha actual formateada:", currentDateFormatted);
  
  // Filtramos los turnos por fecha directamente comparando strings en formato YYYY-MM-DD
  const shifts = allShifts.filter(shift => {
    try {
      // Verificamos primero si shift o shift.date son undefined o null
      if (!shift || !shift.date) {
        console.warn("Turno sin fecha válida:", shift);
        return false;
      }
      
      // Si shift.date ya es un string en formato YYYY-MM-DD, no necesitamos convertirlo
      const formattedShiftDate = formatDateForAPI(shift.date);
      console.log("Comparando turno:", shift.id, "fecha:", formattedShiftDate, "con:", currentDateFormatted);
      return formattedShiftDate === currentDateFormatted;
    } catch (error) {
      console.error("Error al procesar fecha de turno:", error, shift);
      return false; // Excluir turnos con fechas problemáticas
    }
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
      // Invalidar la consulta con el ID de la empresa actual
      queryClient.invalidateQueries({ 
        queryKey: ["/api/shifts", currentCompanyId] 
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
      // Invalidar la consulta con el ID de la empresa actual
      queryClient.invalidateQueries({ 
        queryKey: ["/api/shifts", currentCompanyId] 
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
                Empresa: {
                  companies.find(company => company.id === currentCompanyId)?.name || 
                  companies[0].name
                }
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Mostrar el botón de administración general solo para administradores */}
            {user?.role === 'admin' && (
              <Link href="/admin">
                <Button 
                  variant="secondary" 
                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 px-3 py-1 rounded flex items-center gap-1 text-sm font-medium"
                >
                  <Settings className="h-4 w-4" />
                  Admin General
                </Button>
              </Link>
            )}
            
            {/* Mostrar botón de administración de empresa para administradores y gerentes */}
            {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'user') && (
              <Link href="/company-admin">
                <Button 
                  variant="secondary" 
                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 px-3 py-1 rounded flex items-center gap-1 text-sm font-medium"
                >
                  <Users className="h-4 w-4" />
                  Admin Empresa
                </Button>
              </Link>
            )}
            {user?.role !== 'employee' && (
              <Button 
                variant="secondary" 
                className="bg-white text-primary px-3 py-1 rounded flex items-center gap-1 text-sm font-medium hover:bg-gray-100"
                onClick={handleSaveSchedule}
              >
                <Save className="h-4 w-4" />
                Guardar
              </Button>
            )}
            {user?.role !== 'employee' && (
              <Button 
                variant="secondary" 
                className="bg-white text-primary px-3 py-1 rounded flex items-center gap-1 text-sm font-medium hover:bg-gray-100"
                onClick={handleLoadSchedule}
              >
                <FolderOpen className="h-4 w-4" />
                Cargar
              </Button>
            )}
            {/* Dropdown para cambiar de empresa (solo si hay más de una) */}
            {companies.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary" 
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 px-3 py-1 rounded flex items-center gap-1 text-sm font-medium"
                  >
                    <Building className="h-4 w-4" />
                    Cambiar Empresa
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Seleccionar Empresa</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {companies.map(company => (
                    <DropdownMenuItem 
                      key={company.id}
                      className={company.id === currentCompanyId ? "bg-indigo-50 font-medium" : ""}
                      onClick={() => {
                        if (company.id !== currentCompanyId) {
                          setCurrentCompanyId(company.id);
                          setStartHour(company.startHour || 9);
                          setEndHour(company.endHour || 22);
                          
                          toast({
                            title: "Empresa cambiada",
                            description: `Ahora estás trabajando con: ${company.name}`,
                          });
                          
                          // Recargar datos específicos de la empresa
                          queryClient.invalidateQueries({ queryKey: ["/api/employees", company.id] });
                          queryClient.invalidateQueries({ queryKey: ["/api/shifts", company.id] });
                        }
                      }}
                    >
                      {company.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <Button 
              variant="secondary" 
              className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200 px-3 py-1 rounded flex items-center gap-1 text-sm font-medium ml-2"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
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
                      readOnly={user?.role === 'employee'}
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
                      readOnly={user?.role === 'employee'}
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
                          // Los turnos ya están filtrados por fecha anteriormente
                          return acc + calculateHoursBetween(shift.startTime, shift.endTime);
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
                        // Los turnos ya están filtrados por fecha anteriormente
                        return acc + calculateHoursBetween(shift.startTime, shift.endTime);
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
                          // Los turnos ya están filtrados por fecha anteriormente
                          return acc + calculateHoursBetween(shift.startTime, shift.endTime);
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
                    exportsModalRef.current.openWithReport(null);
                  }
                }}
              >
                <FileText className="h-4 w-4" />
                Exportar
              </Button>
              {/* Botón de agregar empleado solo para administradores y gerentes */}
              {user?.role !== 'employee' && (
                <Button
                  className="bg-[#F57C00] text-white px-4 py-2 rounded flex items-center gap-1 text-sm font-medium hover:bg-opacity-90"
                  onClick={() => setIsEmployeeModalOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  Agregar Empleado
                </Button>
              )}
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
            startHour={startHour}
            endHour={endHour}
            onSaveTimeRange={(newStartHour, newEndHour) => {
              if (currentCompanyId) {
                updateTimeRangeMutation.mutate({
                  companyId: currentCompanyId,
                  startHour: newStartHour,
                  endHour: newEndHour
                });
              } else {
                toast({
                  title: "Error",
                  description: "No se pudo determinar la empresa actual",
                  variant: "destructive",
                });
              }
            }}
            isReadOnly={user?.role === 'employee'}
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
      
      {/* Exportaciones Modal con referencia */}
      <ExportsModal 
        ref={exportsModalRef}
        employees={employees}
        shifts={allShifts}
        currentDate={currentDate}
      />
    </div>
  );
}