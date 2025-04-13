import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, RouteComponentProps } from "wouter";

type AllowedRoles = "admin" | "manager" | "employee" | "user" | "*";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
  allowedRoles?: AllowedRoles[];
}

export function ProtectedRoute({ 
  path, 
  component: Component, 
  allowedRoles = ["*"] 
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  return (
    <Route path={path}>
      {(params) => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        if (!user) {
          return <Redirect to="/auth" />;
        }

        // Si se especifican roles permitidos, verificar que el usuario tenga el rol adecuado
        if (allowedRoles.length > 0 && !allowedRoles.includes("*")) {
          // Comprobar si el rol global del usuario está permitido
          const hasAllowedRole = allowedRoles.includes(user.role as AllowedRoles);
          
          if (!hasAllowedRole) {
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

// ManagerRoute que solo permite acceso a gerentes y administradores
export function ManagerRoute({
  path,
  component,
}: Omit<ProtectedRouteProps, 'allowedRoles'>) {
  return (
    <ProtectedRoute
      path={path}
      component={component}
      allowedRoles={["manager", "admin", "user"]}
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