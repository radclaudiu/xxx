import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

type AllowedRoles = "admin" | "manager" | "employee" | "user" | "*";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
  allowedRoles?: AllowedRoles[];
  requireCompanyRole?: { companyParam?: string; roles: string[] };
}

export function ProtectedRoute({ 
  path, 
  component: Component, 
  allowedRoles = ["*"],
  requireCompanyRole
}: ProtectedRouteProps) {
  const { user, userCompanies, isLoading } = useAuth();

  return (
    <Route path={path}>
      {(params) => {
        // Mostrar loading mientras se cargan los datos
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        // Redireccionar a la página de autenticación si no hay usuario
        if (!user) {
          return <Redirect to="/auth" />;
        }

        // Verificar rol global si se especifica
        if (allowedRoles.length > 0 && !allowedRoles.includes("*")) {
          // El administrador global siempre tiene acceso
          if (user.role === "admin") {
            return <Component {...params} />;
          }
          
          // Comprobar si el rol global del usuario está permitido
          const hasAllowedRole = allowedRoles.includes(user.role as AllowedRoles);
          
          if (!hasAllowedRole && !requireCompanyRole) {
            return <Redirect to="/" />;
          }
        }

        // Verificar rol específico por compañía si se requiere
        if (requireCompanyRole) {
          // Admin global siempre tiene acceso
          if (user.role === "admin") {
            return <Component {...params} />;
          }
          
          // Si no hay compañías asignadas al usuario, denegar acceso
          if (!userCompanies || userCompanies.length === 0) {
            return <Redirect to="/" />;
          }
          
          // Si hay al menos una compañía donde el usuario tiene el rol requerido
          const hasRequiredRole = userCompanies.some((uc: any) => 
            requireCompanyRole.roles.includes(uc.role)
          );
          
          if (!hasRequiredRole) {
            return <Redirect to="/" />;
          }
        }

        return <Component {...params} />;
      }}
    </Route>
  );
}

// EmployeeRoute que solo permite acceso a empleados (solo lectura)
export function EmployeeRoute({
  path,
  component,
}: Omit<ProtectedRouteProps, 'allowedRoles'>) {
  return (
    <ProtectedRoute
      path={path}
      component={component}
      allowedRoles={["employee", "manager", "admin"]}
    />
  );
}

// ManagerRoute que permite acceso a gerentes de empresas y administradores
export function ManagerRoute({
  path,
  component,
}: Omit<ProtectedRouteProps, 'allowedRoles' | 'requireCompanyRole'>) {
  return (
    <ProtectedRoute
      path={path}
      component={component}
      allowedRoles={["admin"]} // Admin global siempre tiene acceso
      requireCompanyRole={{ roles: ["manager"] }} // O usuarios con rol "manager" en alguna empresa
    />
  );
}

// AdminRoute que solo permite acceso a administradores
export function AdminRoute({
  path,
  component,
}: Omit<ProtectedRouteProps, 'allowedRoles'>) {
  return (
    <ProtectedRoute
      path={path}
      component={component}
      allowedRoles={["admin"]}
    />
  );
}