import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { 
  User, 
  Company, 
  insertCompanySchema
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Redirect } from "wouter";
import { Loader2, Plus, Building2, User as UserIcon, Trash2, Edit } from "lucide-react";

// Esquema para creación/edición de empresa
const companyFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres" }),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email({ message: "Email inválido" }).optional().or(z.literal('')),
  website: z.string().url({ message: "URL inválida" }).optional().or(z.literal('')),
  taxId: z.string().optional(),
});

// Esquema para asignar usuario a empresa
const assignUserSchema = z.object({
  userId: z.number().min(1, { message: "Seleccione un usuario" }),
  role: z.string().min(1, { message: "Seleccione un rol" }),
});

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("companies");
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  const [isAssignUserModalOpen, setIsAssignUserModalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  // Verificar si el usuario es administrador
  if (user && user.role !== "admin") {
    return <Redirect to="/" />;
  }

  // Consultar empresas
  const { 
    data: companies = [], 
    isLoading: isLoadingCompanies 
  } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Consultar usuarios
  const { 
    data: users = [], 
    isLoading: isLoadingUsers 
  } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  
  // Definir tipo para las relaciones usuario-empresa expandidas
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

  // Consultar relaciones usuario-empresa
  const { 
    data: userCompanies = [],
    isLoading: isLoadingUserCompanies
  } = useQuery<UserCompanyExpanded[]>({
    queryKey: ["/api/user-companies"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Formulario para crear/editar empresa
  const companyForm = useForm<z.infer<typeof companyFormSchema>>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      taxId: "",
    },
  });

  // Formulario para asignar usuario a empresa
  const assignUserForm = useForm<z.infer<typeof assignUserSchema>>({
    resolver: zodResolver(assignUserSchema),
    defaultValues: {
      userId: 0,
      role: "user",
    },
  });

  // Cargar datos de empresa a editar en el formulario
  const loadCompanyToEdit = (company: Company) => {
    setCompanyToEdit(company);
    companyForm.reset({
      name: company.name,
      address: company.address || "",
      phone: company.phone || "",
      email: company.email || "",
      website: company.website || "",
      taxId: company.taxId || "",
    });
    setIsCompanyModalOpen(true);
  };

  // Abrir modal para asignar usuario a empresa
  const openAssignUserModal = (companyId: number) => {
    setSelectedCompanyId(companyId);
    setIsAssignUserModalOpen(true);
  };

  // Cerrar modal y limpiar formulario de empresa
  const closeCompanyModal = () => {
    setIsCompanyModalOpen(false);
    setCompanyToEdit(null);
    companyForm.reset();
  };

  // Crear empresa
  const createCompanyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof companyFormSchema>) => {
      const res = await apiRequest("POST", "/api/companies", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Empresa creada",
        description: "La empresa ha sido creada exitosamente",
      });
      closeCompanyModal();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear empresa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Actualizar empresa
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: { id: number; company: z.infer<typeof companyFormSchema> }) => {
      const res = await apiRequest("PUT", `/api/companies/${data.id}`, data.company);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Empresa actualizada",
        description: "La empresa ha sido actualizada exitosamente",
      });
      closeCompanyModal();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar empresa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Eliminar empresa
  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const res = await apiRequest("DELETE", `/api/companies/${companyId}`);
      if (!res.ok) {
        throw new Error("Error al eliminar empresa");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Empresa eliminada",
        description: "La empresa ha sido eliminada exitosamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar empresa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Asignar usuario a empresa
  const assignUserMutation = useMutation({
    mutationFn: async (data: { companyId: number; userData: z.infer<typeof assignUserSchema> }) => {
      const res = await apiRequest(
        "POST", 
        `/api/companies/${data.companyId}/users`, 
        data.userData
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-companies"] });
      toast({
        title: "Usuario asignado",
        description: "El usuario ha sido asignado a la empresa exitosamente",
      });
      setIsAssignUserModalOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
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

  // Manejar envío de formulario de empresa
  const onCompanySubmit = (values: z.infer<typeof companyFormSchema>) => {
    if (companyToEdit) {
      updateCompanyMutation.mutate({ id: companyToEdit.id, company: values });
    } else {
      createCompanyMutation.mutate(values);
    }
  };

  // Manejar envío de formulario para asignar usuario
  const onAssignUserSubmit = (values: z.infer<typeof assignUserSchema>) => {
    if (selectedCompanyId) {
      assignUserMutation.mutate({
        companyId: selectedCompanyId,
        userData: values,
      });
    }
  };

  // Confirmar eliminación de empresa
  const handleDeleteCompany = (companyId: number) => {
    if (confirm("¿Está seguro que desea eliminar esta empresa?")) {
      deleteCompanyMutation.mutate(companyId);
    }
  };

  // Confirmar eliminación de usuario de empresa
  const handleRemoveUser = (userId: number, companyId: number) => {
    if (confirm("¿Está seguro que desea eliminar este usuario de la empresa?")) {
      removeUserMutation.mutate({ userId, companyId });
    }
  };

  if (!user) {
    return null; // No renderizar nada si no hay usuario (se redirigirá a login)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="companies" className="flex items-center">
            <Building2 className="mr-2 h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center">
            <UserIcon className="mr-2 h-4 w-4" />
            Usuarios
          </TabsTrigger>
        </TabsList>

        {/* Tab de empresas */}
        <TabsContent value="companies" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Gestión de Empresas</h2>
            <Button onClick={() => setIsCompanyModalOpen(true)} className="flex items-center">
              <Plus className="mr-2 h-4 w-4" /> Nueva Empresa
            </Button>
          </div>

          {isLoadingCompanies ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map(company => (
                <Card key={company.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle>{company.name}</CardTitle>
                    <CardDescription>
                      {company.address} {company.address && company.phone && "•"} {company.phone}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2 text-sm">
                    {company.email && <p><strong>Email:</strong> {company.email}</p>}
                    {company.website && <p><strong>Website:</strong> {company.website}</p>}
                    {company.taxId && <p><strong>ID Fiscal:</strong> {company.taxId}</p>}
                    
                    {/* Sección de usuarios asignados */}
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <h4 className="font-medium mb-2 flex items-center gap-1">
                        <UserIcon className="h-3.5 w-3.5" /> 
                        Usuarios Asignados
                      </h4>
                      
                      {userCompanies
                        .filter(uc => uc.company.id === company.id)
                        .map(uc => (
                          <div key={`${uc.userId}-${uc.companyId}`} className="flex justify-between items-center py-1.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{uc.user.fullName || uc.user.username}</span>
                              <span className="text-gray-500">({uc.user.email})</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 p-1 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleRemoveUser(uc.user.id, company.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        
                      {userCompanies.filter(uc => uc.company.id === company.id).length === 0 && (
                        <div className="text-xs text-gray-500 italic">
                          No hay usuarios asignados a esta empresa.
                        </div>
                      )}
                    </div>
                    
                    <p className="text-muted-foreground text-xs mt-4">
                      Creada: {new Date(company.createdAt || "").toLocaleDateString()}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t pt-4">
                    <div>
                      <Button variant="outline" size="sm" className="mr-2" onClick={() => loadCompanyToEdit(company)}>
                        <Edit className="h-4 w-4 mr-1" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openAssignUserModal(company.id)}>
                        <UserIcon className="h-4 w-4 mr-1" /> Asignar
                      </Button>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteCompany(company.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {companies.length === 0 && !isLoadingCompanies && (
            <div className="text-center p-8 border rounded-lg">
              <h3 className="text-lg font-medium">No hay empresas registradas</h3>
              <p className="text-muted-foreground">Comience creando una nueva empresa</p>
            </div>
          )}
        </TabsContent>

        {/* Tab de usuarios */}
        <TabsContent value="users" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Usuarios del Sistema</h2>
          </div>

          {isLoadingUsers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Empresas</TableHead>
                    <TableHead>Creado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.id}</TableCell>
                      <TableCell>{user.fullName || user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                        {userCompanies.filter(uc => uc.userId === user.id).length} empresas
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt || "").toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {users.length === 0 && !isLoadingUsers && (
            <div className="text-center p-8 border rounded-lg">
              <h3 className="text-lg font-medium">No hay usuarios registrados</h3>
              <p className="text-muted-foreground">Los usuarios pueden registrarse desde la página de autenticación</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de crear/editar empresa */}
      <Dialog open={isCompanyModalOpen} onOpenChange={setIsCompanyModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {companyToEdit ? "Editar Empresa" : "Crear Nueva Empresa"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...companyForm}>
            <form onSubmit={companyForm.handleSubmit(onCompanySubmit)} className="space-y-4">
              <FormField
                control={companyForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la empresa *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la empresa" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={companyForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Input placeholder="Dirección" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={companyForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="Teléfono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={companyForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={companyForm.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sitio web</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={companyForm.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Fiscal / CIF</FormLabel>
                    <FormControl>
                      <Input placeholder="ID Fiscal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeCompanyModal}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createCompanyMutation.isPending || updateCompanyMutation.isPending}
                >
                  {(createCompanyMutation.isPending || updateCompanyMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {companyToEdit ? "Actualizando..." : "Creando..."}
                    </>
                  ) : (
                    companyToEdit ? "Actualizar Empresa" : "Crear Empresa"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal para asignar usuario a empresa */}
      <Dialog open={isAssignUserModalOpen} onOpenChange={setIsAssignUserModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Asignar Usuario a Empresa</DialogTitle>
          </DialogHeader>
          
          <Form {...assignUserForm}>
            <form onSubmit={assignUserForm.handleSubmit(onAssignUserSubmit)} className="space-y-4">
              <FormField
                control={assignUserForm.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario</FormLabel>
                    <FormControl>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      >
                        <option value={0}>Seleccionar usuario</option>
                        {users
                          .filter(u => u.id !== user.id) // No mostrar el usuario actual (admin)
                          .map(u => (
                            <option key={u.id} value={u.id}>
                              {u.fullName || u.username} ({u.email})
                            </option>
                          ))
                        }
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={assignUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol en la empresa</FormLabel>
                    <FormControl>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        <option value="user">Usuario</option>
                        <option value="manager">Gerente</option>
                        <option value="staff">Personal</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAssignUserModalOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={assignUserMutation.isPending}
                >
                  {assignUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Asignando...
                    </>
                  ) : (
                    "Asignar Usuario"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}