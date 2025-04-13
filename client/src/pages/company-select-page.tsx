import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCompany } from "@/hooks/use-company";
import { Redirect } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CalendarClock, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function CompanySelectPage() {
  const { userCompanies, setSelectedCompany, companyLoading } = useCompany();
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (companyLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (userCompanies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No tienes empresas asignadas</CardTitle>
            <CardDescription>
              No tienes ninguna empresa asignada a tu usuario. Ponte en contacto con el administrador del sistema.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={handleLogout} className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Selecciona una empresa</CardTitle>
          <CardDescription>
            Selecciona la empresa con la que deseas trabajar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userCompanies.map((company) => (
            <Button
              key={company.id}
              variant="outline"
              className="w-full justify-start h-auto py-6 px-4"
              onClick={() => setSelectedCompany(company)}
            >
              <div className="flex items-center w-full">
                <div className="bg-primary/10 p-3 rounded-full mr-4">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{company.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {company.description || "Sin descripción"}
                  </div>
                  <div className="text-xs mt-1 text-muted-foreground">
                    Rol: {company.role || "Usuario"}
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}