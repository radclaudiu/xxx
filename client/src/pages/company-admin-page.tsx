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
  
  // Solo permitir acceso a admins y gerentes
  if (!user) {
    return null; // No renderizar nada si no hay usuario (se redirigirá a login)
  }
  
  if (user.role !== "admin" && user.role !== "manager") {
    return <Redirect to="/" />;
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
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          className="p-2 rounded-full" 
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Regresar</span>
        </Button>
        <h1 className="text-3xl font-bold">Administración de Empresa</h1>
      </div>
      
      {isLoadingCompanies ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Selector de empresa */}
          <div className="flex items-center gap-3 mt-2">
            <Building className="h-5 w-5 text-muted-foreground" />
            <Select
              value={currentCompanyId?.toString() || ""}
              onValueChange={(value) => setCurrentCompanyId(parseInt(value))}
            >
              <SelectTrigger className="w-[300px]">
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
          
          {currentCompany && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Building className="h-5 w-5" /> {currentCompany.name}
              </h2>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full md:w-[300px] grid-cols-1">
                  <TabsTrigger value="users" className="flex items-center">
                    <Users className="mr-2 h-4 w-4" />
                    Gestión de Usuarios
                  </TabsTrigger>
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
              </Tabs>
            </div>
          )}
        </>
      )}
    </div>
  );
}