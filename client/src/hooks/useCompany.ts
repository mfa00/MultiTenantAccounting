import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";

export function useCompany() {
  const { companies, user, currentCompanyId: backendCompanyId } = useAuth();
  
  const [localCompanyId, setLocalCompanyId] = useState<number | null>(() => {
    // Try to get the last selected company from localStorage as fallback
    const stored = localStorage.getItem('currentCompanyId');
    return stored ? parseInt(stored) : null;
  });
  
  // Determine the current company ID with priority:
  // 1. Backend session currentCompanyId (most reliable)
  // 2. Local storage (fallback)
  // 3. First available company (default)
  const currentCompanyId = backendCompanyId || localCompanyId;
  
  // Initialize with first company if no valid selection and companies are available
  useEffect(() => {
    console.log('useCompany effect:', { 
      companiesLength: companies.length, 
      currentCompanyId, 
      backendCompanyId, 
      localCompanyId 
    });
    
    if (companies.length > 0) {
      if (!currentCompanyId || !companies.find(c => c.id === currentCompanyId)) {
        // If no valid company, use the first one
        const firstCompany = companies[0];
        console.log('Setting first company:', firstCompany.name, firstCompany.id);
        setLocalCompanyId(firstCompany.id);
        localStorage.setItem('currentCompanyId', firstCompany.id.toString());
      } else {
        // Sync local state with valid selection
        console.log('Syncing with valid selection:', currentCompanyId);
        setLocalCompanyId(currentCompanyId);
        localStorage.setItem('currentCompanyId', currentCompanyId.toString());
      }
    }
  }, [companies, currentCompanyId, backendCompanyId, localCompanyId]);
  
  // Find the current company based on determined ID
  const currentCompany = companies.find(company => company.id === currentCompanyId) || 
    (companies.length > 0 ? companies[0] : null);
  
  const switchToCompany = (companyId: number) => {
    setLocalCompanyId(companyId);
    // Persist the selection
    localStorage.setItem('currentCompanyId', companyId.toString());
  };
  
  return {
    currentCompany,
    companies,
    hasCompanies: companies.length > 0,
    switchToCompany,
    currentCompanyId,
  };
}
