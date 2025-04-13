import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth-page";
import CompanySelectPage from "@/pages/company-select-page";
import { AuthProvider } from "@/hooks/use-auth";
import { CompanyProvider } from "@/hooks/use-company";
import { ProtectedRoute } from "@/lib/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/company-select" component={CompanySelectPage} />
      <ProtectedRoute path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider>
          <Router />
          <Toaster />
        </CompanyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
