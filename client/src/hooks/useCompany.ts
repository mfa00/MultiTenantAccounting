import { useAuth } from "./useAuth";

export function useCompany() {
  const { companies } = useAuth();
  
  // For now, return the first company as current
  // In a full implementation, this would track the currently selected company
  const currentCompany = companies.length > 0 ? companies[0] : null;
  
  return {
    currentCompany,
    companies,
    hasCompanies: companies.length > 0,
  };
}
