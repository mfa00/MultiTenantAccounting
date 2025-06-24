import { Link, useLocation } from "wouter";
import { Calculator, BarChart3, List, Book, File, Receipt, 
         University, Edit, FileText, DollarSign, ChartBar, 
         Scale, PieChart, Users, Settings, Shield, Globe } from "lucide-react";
import CompanySwitcher from "../CompanySwitcher";
import { usePermissions } from "@/hooks/usePermissions";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  permission?: string;
}

const navigation: NavigationItem[] = [
  {
    name: "Global Administration",
    href: "/global-administration",
    icon: Globe,
    permission: "SYSTEM_VIEW_ALL_COMPANIES",
  },
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
    permission: "DASHBOARD_VIEW",
  },
];

const accountingSection: NavigationItem[] = [
  {
    name: "Chart of Accounts",
    href: "/chart-of-accounts",
    icon: List,
    permission: "ACCOUNTS_VIEW",
  },
  {
    name: "General Ledger",
    href: "/general-ledger",
    icon: Book,
    permission: "ACCOUNTS_VIEW",
  },
  {
    name: "Accounts Receivable",
    href: "/accounts-receivable",
    icon: File,
    permission: "CUSTOMERS_VIEW",
  },
  {
    name: "Accounts Payable",
    href: "/accounts-payable",
    icon: Receipt,
    permission: "VENDORS_VIEW",
  },
  {
    name: "Bank Reconciliation",
    href: "/bank-reconciliation",
    icon: University,
    permission: "JOURNAL_VIEW",
  },
];

const transactionSection: NavigationItem[] = [
  {
    name: "Journal Entries",
    href: "/journal-entries",
    icon: Edit,
    permission: "JOURNAL_VIEW",
  },
  {
    name: "Invoices",
    href: "/invoices",
    icon: File,
    permission: "INVOICES_VIEW",
  },
  {
    name: "Bills",
    href: "/bills",
    icon: FileText,
    permission: "BILLS_VIEW",
  },
  {
    name: "Payments",
    href: "/payments",
    icon: DollarSign,
    permission: "JOURNAL_VIEW",
  },
];

const reportSection: NavigationItem[] = [
  {
    name: "Financial Statements",
    href: "/financial-statements",
    icon: ChartBar,
    permission: "REPORTS_VIEW",
  },
  {
    name: "Trial Balance",
    href: "/trial-balance",
    icon: Scale,
    permission: "REPORTS_VIEW",
  },
  {
    name: "Custom Reports",
    href: "/custom-reports",
    icon: PieChart,
    permission: "REPORTS_CUSTOM",
  },
];

const adminSection: NavigationItem[] = [
  {
    name: "User Management",
    href: "/user-management",
    icon: Users,
    permission: "USER_VIEW",
  },
  {
    name: "Role Management",
    href: "/role-management",
    icon: Shield,
    permission: "USER_VIEW",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "SETTINGS_VIEW",
  },
];

// Additional test section to demonstrate scrolling
const testSection: NavigationItem[] = [
  {
    name: "Test Item 1",
    href: "/test-1",
    icon: File,
  },
  {
    name: "Test Item 2",
    href: "/test-2",
    icon: FileText,
  },
  {
    name: "Test Item 3",
    href: "/test-3",
    icon: Receipt,
  },
  {
    name: "Test Item 4",
    href: "/test-4",
    icon: DollarSign,
  },
  {
    name: "Test Item 5",
    href: "/test-5",
    icon: ChartBar,
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { can } = usePermissions();

  const isActive = (href: string) => {
    return location === href || (href !== "/dashboard" && location.startsWith(href));
  };

  const NavItem = ({ item }: { item: NavigationItem }) => {
    const Icon = item.icon;
    
    // Check permissions if permission is specified
    if (item.permission && !can(item.permission as any)) {
      return null;
    }

    return (
      <Link href={item.href}>
        <div className={`accounting-nav-item ${isActive(item.href) ? 'active' : ''}`}>
          <Icon className="w-5 h-5 mr-3" />
          {item.name}
        </div>
      </Link>
    );
  };

  // Filter sections based on permissions
  const getVisibleItems = (items: NavigationItem[]) => {
    return items.filter(item => !item.permission || can(item.permission as any));
  };

  return (
    <div className="flex flex-col h-full w-64 accounting-sidebar">
      {/* Logo & Company Switcher - Fixed Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
            <Calculator className="text-primary-foreground text-sm" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">AccountFlow Pro</h1>
        </div>
        
        <CompanySwitcher />
      </div>

      {/* Scrollable Navigation Menu */}
      <ScrollArea className="flex-1">
        <nav className="px-4 py-4 space-y-2 pb-6">
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
            
            {/* Accounting Section */}
            {getVisibleItems(accountingSection).length > 0 && (
              <div className="mt-6">
                <p className="accounting-nav-section">Accounting</p>
                {getVisibleItems(accountingSection).map((item) => (
                  <NavItem key={item.name} item={item} />
                ))}
              </div>
            )}

            {/* Transactions Section */}
            {getVisibleItems(transactionSection).length > 0 && (
              <div className="mt-6">
                <p className="accounting-nav-section">Transactions</p>
                {getVisibleItems(transactionSection).map((item) => (
                  <NavItem key={item.name} item={item} />
                ))}
              </div>
            )}

            {/* Reports Section */}
            {getVisibleItems(reportSection).length > 0 && (
              <div className="mt-6">
                <p className="accounting-nav-section">Reports</p>
                {getVisibleItems(reportSection).map((item) => (
                  <NavItem key={item.name} item={item} />
                ))}
              </div>
            )}

            {/* Administration Section */}
            {getVisibleItems(adminSection).length > 0 && (
              <div className="mt-6">
                <p className="accounting-nav-section">Administration</p>
                {getVisibleItems(adminSection).map((item) => (
                  <NavItem key={item.name} item={item} />
                ))}
              </div>
            )}

            {/* Test Section - For Scrolling Demo */}
            <div className="mt-6">
              <p className="accounting-nav-section">Test Scrolling</p>
              {testSection.map((item) => (
                <NavItem key={item.name} item={item} />
              ))}
            </div>
          </div>
        </nav>
      </ScrollArea>
    </div>
  );
}
