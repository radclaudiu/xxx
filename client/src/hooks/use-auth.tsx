import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  email: string;
  password: string;
  username: string;
  fullName: string;
};

// Definición del contexto inicial (vacío)
const AuthContext = createContext<any>(null);

// Proveedor del contexto de autenticación
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Consulta para obtener el usuario actual
  const {
    data: user,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  // Consulta para obtener las relaciones usuario-empresa
  const { data: userCompanies = [] } = useQuery({
    queryKey: ["/api/user-companies"],
    enabled: !!user,
  });

  // Mutación para iniciar sesión
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      
      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido, ${user.fullName || user.username}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al iniciar sesión",
        description: error.message || "Credenciales incorrectas",
        variant: "destructive",
      });
    },
  });

  // Mutación para registrarse
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      
      toast({
        title: "Registro exitoso",
        description: `Bienvenido, ${user.fullName || user.username}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al registrarse",
        description: error.message || "No se pudo crear la cuenta",
        variant: "destructive",
      });
    },
  });

  // Mutación para cerrar sesión
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al cerrar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Función para verificar si el usuario tiene un rol específico en una empresa
  const hasCompanyRole = (companyId: number, role: string | string[]) => {
    if (!user) return false;
    
    // Los administradores globales siempre tienen acceso
    if (user.role === "admin") return true;
    
    // Verificar el rol específico en la empresa
    const userCompany = userCompanies?.find((uc: any) => uc.companyId === companyId);
    
    if (!userCompany) return false;
    
    if (Array.isArray(role)) {
      return role.includes(userCompany.role);
    }
    
    return userCompany.role === role;
  };

  // Proveer todos los valores del contexto
  const value = {
    user: user || null,
    userCompanies: userCompanies || [],
    isLoading,
    error,
    loginMutation,
    logoutMutation,
    registerMutation,
    hasCompanyRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook personalizado para usar el contexto de autenticación
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}