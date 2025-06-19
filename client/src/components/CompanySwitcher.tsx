import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";

export default function CompanySwitcher() {
  const { switchCompany, isSwitchPending } = useAuth();
  const { currentCompany, companies, switchToCompany } = useCompany();

  const handleSwitchCompany = (companyId: number) => {
    // Update local state immediately for UI responsiveness
    switchToCompany(companyId);
    // Also call the backend API
    switchCompany(companyId);
  };

  const getCompanyInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!currentCompany) {
    return (
      <div className="company-switcher opacity-50">
        <div className="flex items-center">
          <div className="company-avatar bg-muted text-muted-foreground">
            ?
          </div>
          <span className="text-sm font-medium text-muted-foreground">No Company</span>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="company-switcher" disabled={isSwitchPending}>
          <div className="flex items-center">
            <div className="company-avatar bg-primary text-primary-foreground">
              {getCompanyInitials(currentCompany.name)}
            </div>
            <span className="text-sm font-medium text-foreground">{currentCompany.name}</span>
          </div>
          <ChevronDown className="text-muted-foreground w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => handleSwitchCompany(company.id)}
            className="flex items-center"
          >
            <div className="company-avatar bg-primary text-primary-foreground">
              {getCompanyInitials(company.name)}
            </div>
            <div className="flex-1">
              <div className="font-medium">{company.name}</div>
              <div className="text-xs text-muted-foreground">{company.role}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
