import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";

export function useCompany() {
  const { companies } = useAuth();
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null);
  
  // Initialize with first company if available
  useEffect(() => {
    if (companies.length > 0 && !currentCompanyId) {
      setCurrentCompanyId(companies[0].id);
    }
  }, [companies, currentCompanyId]);
  
  // Find the current company based on stored ID
  const currentCompany = companies.find(company => company.id === currentCompanyId) || 
    (companies.length > 0 ? companies[0] : null);
  
  const switchToCompany = (companyId: number) => {
    setCurrentCompanyId(companyId);
  };
  
  return {
    currentCompany,
    companies,
    hasCompanies: companies.length > 0,
    switchToCompany,
    currentCompanyId,
  };
}
