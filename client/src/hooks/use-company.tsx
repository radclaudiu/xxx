import { createContext, useState, ReactNode, useContext, useEffect } from "react";
import { queryClient } from "../lib/queryClient";
import { Company } from "@shared/schema";
import { useAuth } from "./use-auth";

type CompanyContextType = {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companyLoading: boolean;
  userCompanies: (Company & { role: string })[];
  refetchCompanies: () => void;
};

export const CompanyContext = createContext<CompanyContextType | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [userCompanies, setUserCompanies] = useState<(Company & { role: string })[]>([]);
  const [companyLoading, setCompanyLoading] = useState(true);

  const fetchUserCompanies = async () => {
    if (!user) {
      setUserCompanies([]);
      setSelectedCompany(null);
      setCompanyLoading(false);
      return;
    }

    try {
      setCompanyLoading(true);
      const response = await fetch("/api/user/companies");
      if (!response.ok) {
        throw new Error("Error al obtener empresas del usuario");
      }

      const companies = await response.json();
      console.log("Empresas del usuario:", companies);
      setUserCompanies(companies);

      // Si no hay una empresa seleccionada o la empresa seleccionada ya no está en la lista,
      // seleccionar la primera empresa de la lista
      if (companies.length > 0 && (!selectedCompany || !companies.some(c => c.id === selectedCompany.id))) {
        setSelectedCompany(companies[0]);
      }
    } catch (error) {
      console.error("Error al obtener empresas:", error);
    } finally {
      setCompanyLoading(false);
    }
  };

  // Cargar empresas del usuario al iniciar sesión
  useEffect(() => {
    fetchUserCompanies();
  }, [user]);

  // Guardar la empresa seleccionada en localStorage
  useEffect(() => {
    if (selectedCompany) {
      localStorage.setItem("selectedCompany", JSON.stringify(selectedCompany));
    } else {
      localStorage.removeItem("selectedCompany");
    }
  }, [selectedCompany]);

  // Cargar la empresa seleccionada desde localStorage al inicio
  useEffect(() => {
    const storedCompany = localStorage.getItem("selectedCompany");
    if (storedCompany) {
      try {
        const company = JSON.parse(storedCompany);
        if (company && company.id) {
          setSelectedCompany(company);
        }
      } catch (error) {
        console.error("Error al cargar empresa desde localStorage:", error);
        localStorage.removeItem("selectedCompany");
      }
    }
  }, []);

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany,
        setSelectedCompany,
        companyLoading,
        userCompanies,
        refetchCompanies: fetchUserCompanies
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany debe usarse dentro de un CompanyProvider");
  }
  return context;
}