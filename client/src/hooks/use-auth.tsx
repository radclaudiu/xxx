import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Definición del contexto de autenticación
interface AuthContextType {
  user: User | null;
  userCompanies: any[] | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  hasCompanyRole: (companyId: number, role: string | string[]) => boolean;
}

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

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      // Invalidar otras consultas que podrían depender del estado del usuario
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      
      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido, ${user.fullName || user.username}`,
      });
      
      // La navegación se maneja en el componente AuthPage a través del useEffect
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar sesión",
        description: error.message || "Credenciales incorrectas",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      // Invalidar otras consultas que podrían depender del estado del usuario
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      
      toast({
        title: "Registro exitoso",
        description: `Bienvenido, ${user.fullName || user.username}`,
      });
      
      // La navegación se maneja en el componente AuthPage a través del useEffect
    },
    onError: (error: Error) => {
      toast({
        title: "Error al registrarse",
        description: error.message || "No se pudo crear la cuenta",
        variant: "destructive",
      });
    },
  });

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
    onError: (error: Error) => {
      toast({
        title: "Error al cerrar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Obtener las relaciones de usuarios con empresas
  const { data: userCompanies = [] } = useQuery<any[]>({
    queryKey: ["/api/user-companies"],
    enabled: !!user,
  });

  // Función para verificar si el usuario tiene un rol específico en una empresa
  const hasCompanyRole = (companyId: number, role: string | string[]) => {
    if (!user) return false;
    
    // Los administradores globales siempre tienen acceso
    if (user.role === "admin") return true;
    
    // Verificar el rol específico en la empresa
    const userCompany = userCompanies?.find(uc => uc.companyId === companyId);
    
    if (!userCompany) return false;
    
    if (Array.isArray(role)) {
      return role.includes(userCompany.role);
    }
    
    return userCompany.role === role;
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        userCompanies: userCompanies ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        hasCompanyRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}