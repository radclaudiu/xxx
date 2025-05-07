import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Redirect, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Building, 
  Loader2, 
  Mail, 
  UserPlus, 
  Users 
} from "lucide-react";

// Esquema para el formulario de asignación de usuarios
const assignUserSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  role: z.string().min(1, { message: "Seleccione un rol" }),
});

// Tipo para las relaciones usuario-empresa expandidas
interface UserCompanyExpanded {
  userId: number;
  companyId: number;
  role: string;
  user: {
    id: number;
    username: string;
    email: string;
    fullName?: string;
    role?: string;
  };
  company: {
    id: number;
    name: string;
  };
}

export default function CompanyAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null);
  
  // Solo permitir acceso si no hay usuario (se redirigirá a login)
  if (!user) {
    return null;
  }
  
  // Consultar empresas del usuario
  const { 
    data: companies = [] as any[], 
    isLoading: isLoadingCompanies 
  } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    enabled: !!user,
  });
  
  // Consultar relaciones usuario-empresa
  const { 
    data: userCompanies = [] as UserCompanyExpanded[], 
    isLoading: isLoadingUserCompanies 
  } = useQuery<UserCompanyExpanded[]>({
    queryKey: ["/api/user-companies"],
    enabled: !!user,
  });
  
  // Establecer la primera empresa como predeterminada si no hay ninguna seleccionada
  useEffect(() => {
    if (companies.length > 0 && !currentCompanyId) {
      setCurrentCompanyId(companies[0].id);
    }
  }, [companies, currentCompanyId]);
  
  // Formulario para asignar usuario a empresa
  const assignUserForm = useForm<z.infer<typeof assignUserSchema>>({
    resolver: zodResolver(assignUserSchema),
    defaultValues: {
      email: "",
      role: "employee", // Por defecto, rol de empleado
    },
  });
  
  // Asignar usuario a empresa por correo electrónico
  const assignUserByEmailMutation = useMutation({
    mutationFn: async (data: { 
      companyId: number; 
      userData: z.infer<typeof assignUserSchema> 
    }) => {
      const res = await apiRequest(
        "POST", 
        `/api/companies/${data.companyId}/assign-by-email`, 
        data.userData
      );
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al asignar usuario");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-companies"] });
      toast({
        title: "Usuario asignado",
        description: "El usuario ha sido asignado a la empresa exitosamente",
      });
      assignUserForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al asignar usuario",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Eliminar usuario de empresa
  const removeUserMutation = useMutation({
    mutationFn: async ({ userId, companyId }: { userId: number; companyId: number }) => {
      const res = await apiRequest(
        "DELETE", 
        `/api/companies/${companyId}/users/${userId}`
      );
      if (!res.ok) {
        throw new Error("Error al eliminar usuario de la empresa");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-companies"] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado de la empresa exitosamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar usuario",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Manejar envío de formulario para asignar usuario
  const onAssignUserSubmit = (values: z.infer<typeof assignUserSchema>) => {
    if (currentCompanyId) {
      assignUserByEmailMutation.mutate({
        companyId: currentCompanyId,
        userData: values,
      });
    } else {
      toast({
        title: "Error",
        description: "Debe seleccionar una empresa",
        variant: "destructive",
      });
    }
  };
  
  // Confirmar eliminación de usuario de empresa
  const handleRemoveUser = (userId: number, companyId: number) => {
    if (confirm("¿Está seguro que desea eliminar este usuario de la empresa?")) {
      removeUserMutation.mutate({ userId, companyId });
    }
  };
  
  // Obtener la empresa actual
  const currentCompany = companies.find(c => c.id === currentCompanyId);
  
  // Filtrar usuarios asignados a la empresa actual
  const companyUsers = userCompanies.filter(uc => uc.companyId === currentCompanyId);
  
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Menú lateral */}
      <div className="w-72 flex-shrink-0 h-full border-r">
        <div className="py-4">
          <div className="px-6 py-3">
            <Button 
              variant="ghost" 
              className="p-2 flex items-center gap-2 text-sm mb-4 hover:bg-gray-100" 
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Regresar</span>
            </Button>
            
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Administrar Empresa
            </h3>
          </div>
          
          {isLoadingCompanies ? (
            <div className="px-6 py-3 flex items-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <span>Cargando empresas...</span>
            </div>
          ) : (
            <>
              {/* Selector de empresa */}
              <div className="px-6 py-2">
                <div className="flex items-center gap-3 mt-2">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <Select
                    value={currentCompanyId?.toString() || ""}
                    onValueChange={(value) => setCurrentCompanyId(parseInt(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(company => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Menú de opciones */}
              <nav className="mt-4 px-3 space-y-1">
                <div
                  className={`flex items-center px-4 py-3 text-sm rounded-md cursor-pointer transition-colors ${
                    activeTab === "users" 
                      ? "bg-primary text-white" 
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("users")}
                >
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    <div>
                      <div className="font-medium">Gestión de Usuarios</div>
                      <div className={`text-xs ${activeTab === "users" ? "text-gray-100" : "text-gray-500"}`}>
                        Administrar usuarios de la empresa
                      </div>
                    </div>
                  </div>
                </div>
                
                <div
                  className={`flex items-center px-4 py-3 text-sm rounded-md cursor-pointer transition-colors ${
                    activeTab === "roles" 
                      ? "bg-primary text-white" 
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("roles")}
                >
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                      <div className="font-medium">Roles y Permisos</div>
                      <div className={`text-xs ${activeTab === "roles" ? "text-gray-100" : "text-gray-500"}`}>
                        Configurar roles de usuario
                      </div>
                    </div>
                  </div>
                </div>
                
                <div
                  className={`flex items-center px-4 py-3 text-sm rounded-md cursor-pointer transition-colors ${
                    activeTab === "config" 
                      ? "bg-primary text-white" 
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("config")}
                >
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <div className="font-medium">Configuración</div>
                      <div className={`text-xs ${activeTab === "config" ? "text-gray-100" : "text-gray-500"}`}>
                        Ajustes de la empresa
                      </div>
                    </div>
                  </div>
                </div>
              </nav>
            </>
          )}
        </div>
      </div>
      
      {/* Contenido principal */}
      <div className="flex-grow p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Administración de Empresa</h1>
          
          {currentCompany && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Building className="h-5 w-5" /> {currentCompany.name}
              </h2>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="hidden">
                  <TabsTrigger value="users">Gestión de Usuarios</TabsTrigger>
                  <TabsTrigger value="roles">Roles y Permisos</TabsTrigger>
                  <TabsTrigger value="config">Configuración</TabsTrigger>
                </TabsList>
              
                <TabsContent value="users" className="space-y-6 pt-4">
                  {/* Formulario para asignar usuarios por correo electrónico */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Asignar Usuario
                      </CardTitle>
                      <CardDescription>
                        Asigne un usuario existente a esta empresa utilizando su correo electrónico.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...assignUserForm}>
                        <form 
                          onSubmit={assignUserForm.handleSubmit(onAssignUserSubmit)} 
                          className="space-y-4"
                        >
                          <FormField
                            control={assignUserForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Correo Electrónico del Usuario</FormLabel>
                                <FormControl>
                                  <div className="flex items-center">
                                    <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <Input 
                                      placeholder="usuario@ejemplo.com" 
                                      {...field} 
                                    />
                                  </div>
                                </FormControl>
                                <FormDescription>
                                  El usuario debe estar registrado en el sistema.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={assignUserForm.control}
                            name="role"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rol en la Empresa</FormLabel>
                                <Select 
                                  onValueChange={field.onChange} 
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccione un rol" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="manager">Gerente</SelectItem>
                                    <SelectItem value="employee">Empleado</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  Los gerentes pueden asignar usuarios y modificar horarios, 
                                  los empleados solo pueden ver y exportar.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <Button 
                            type="submit" 
                            className="w-full"
                            disabled={assignUserByEmailMutation.isPending}
                          >
                            {assignUserByEmailMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Asignando...
                              </>
                            ) : (
                              "Asignar Usuario"
                            )}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                  
                  {/* Lista de usuarios asignados */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Usuarios Asignados
                      </CardTitle>
                      <CardDescription>
                        Usuarios con acceso a {currentCompany.name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingUserCompanies ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <>
                          {companyUsers.length > 0 ? (
                            <div className="space-y-4">
                              {companyUsers.map(uc => (
                                <div 
                                  key={`${uc.userId}-${uc.companyId}`} 
                                  className="flex justify-between items-center p-3 bg-muted/30 rounded-md"
                                >
                                  <div>
                                    <div className="font-medium">
                                      {uc.user.fullName || uc.user.username}
                                    </div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                      <Mail className="h-3.5 w-3.5" /> {uc.user.email}
                                    </div>
                                    <div className="text-xs mt-1 inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                      {uc.role === "manager" ? "Gerente" : 
                                       uc.role === "employee" ? "Empleado" : 
                                       uc.role === "admin" ? "Administrador" : uc.role}
                                    </div>
                                  </div>
                                  
                                  {/* No mostrar botón eliminar para uno mismo o para administradores */}
                                  {uc.user.id !== user.id && uc.user.role !== "admin" && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="text-destructive hover:bg-destructive/10"
                                      onClick={() => handleRemoveUser(uc.userId, uc.companyId)}
                                    >
                                      Eliminar
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              No hay usuarios asignados a esta empresa.
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* Contenido para la pestaña de Roles */}
                <TabsContent value="roles" className="space-y-6 pt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Gestión de Roles y Permisos
                      </CardTitle>
                      <CardDescription>
                        Administre los roles y permisos de los usuarios en {currentCompany.name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="p-6 bg-gray-50 rounded-lg text-center">
                        <h3 className="text-lg font-medium mb-2">Próximamente</h3>
                        <p className="text-gray-600">Esta funcionalidad estará disponible en una próxima actualización.</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* Contenido para la pestaña de Configuración */}
                <TabsContent value="config" className="space-y-6 pt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Configuración de la Empresa
                      </CardTitle>
                      <CardDescription>
                        Ajuste la configuración de {currentCompany.name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-5">
                        <div className="border-b pb-5">
                          <h3 className="text-lg font-medium mb-3">Información General</h3>
                          <div className="flex items-baseline justify-between">
                            <span className="text-gray-600">Nombre:</span>
                            <span className="font-medium">{currentCompany.name}</span>
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-gray-600">Dirección:</span>
                            <span className="font-medium">{currentCompany.address || "No especificada"}</span>
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-gray-600">Teléfono:</span>
                            <span className="font-medium">{currentCompany.phone || "No especificado"}</span>
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-medium">{currentCompany.email || "No especificado"}</span>
                          </div>
                        </div>
                      
                        <div className="pt-2">
                          <h3 className="text-lg font-medium mb-3">Configuración Avanzada</h3>
                          <p className="text-gray-600 mb-4">Estas configuraciones se implementarán en futuras actualizaciones.</p>
                          
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md mb-3">
                            <div>
                              <h4 className="font-medium">Notificaciones por Email</h4>
                              <p className="text-xs text-gray-500">Enviar notificaciones a los empleados cuando se modifican sus turnos</p>
                            </div>
                            <div className="text-gray-400 italic text-sm">Próximamente</div>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md mb-3">
                            <div>
                              <h4 className="font-medium">Integración con Calendario</h4>
                              <p className="text-xs text-gray-500">Sincronizar turnos con Google Calendar o Microsoft Outlook</p>
                            </div>
                            <div className="text-gray-400 italic text-sm">Próximamente</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}