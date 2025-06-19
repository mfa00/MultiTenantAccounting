import { Link, useLocation } from "wouter";
import { Calculator, BarChart3, List, Book, File, Receipt, 
         University, Edit, FileText, DollarSign, ChartBar, 
         Scale, PieChart, Users, Settings } from "lucide-react";
import CompanySwitcher from "../CompanySwitcher";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
  },
];

const accountingSection = [
  {
    name: "Chart of Accounts",
    href: "/chart-of-accounts",
    icon: List,
  },
  {
    name: "General Ledger",
    href: "/general-ledger",
    icon: Book,
  },
  {
    name: "Accounts Receivable",
    href: "/accounts-receivable",
    icon: File,
  },
  {
    name: "Accounts Payable",
    href: "/accounts-payable",
    icon: Receipt,
  },
  {
    name: "Bank Reconciliation",
    href: "/bank-reconciliation",
    icon: University,
  },
];

const transactionSection = [
  {
    name: "Journal Entries",
    href: "/journal-entries",
    icon: Edit,
  },
  {
    name: "Invoices",
    href: "/invoices",
    icon: File,
  },
  {
    name: "Bills",
    href: "/bills",
    icon: FileText,
  },
  {
    name: "Payments",
    href: "/payments",
    icon: DollarSign,
  },
];

const reportSection = [
  {
    name: "Financial Statements",
    href: "/financial-statements",
    icon: ChartBar,
  },
  {
    name: "Trial Balance",
    href: "/trial-balance",
    icon: Scale,
  },
  {
    name: "Custom Reports",
    href: "/custom-reports",
    icon: PieChart,
  },
];

const adminSection = [
  {
    name: "User Management",
    href: "/user-management",
    icon: Users,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const [location] = useLocation();

  const isActive = (href: string) => {
    return location === href || (href !== "/dashboard" && location.startsWith(href));
  };

  const NavItem = ({ item }: { item: { name: string; href: string; icon: any } }) => {
    const Icon = item.icon;
    return (
      <Link href={item.href}>
        <a className={`accounting-nav-item ${isActive(item.href) ? 'active' : ''}`}>
          <Icon className="w-5 h-5 mr-3" />
          {item.name}
        </a>
      </Link>
    );
  };

  return (
    <div className="flex-shrink-0 w-64 accounting-sidebar">
      {/* Logo & Company Switcher */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
            <Calculator className="text-primary-foreground text-sm" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">AccountFlow Pro</h1>
        </div>
        
        <CompanySwitcher />
      </div>

      {/* Navigation Menu */}
      <nav className="p-4 space-y-2">
        <div className="space-y-1">
          {navigation.map((item) => (
            <NavItem key={item.name} item={item} />
          ))}
          
          {/* Accounting Section */}
          <div className="mt-6">
            <p className="accounting-nav-section">Accounting</p>
            {accountingSection.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </div>

          {/* Transactions Section */}
          <div className="mt-6">
            <p className="accounting-nav-section">Transactions</p>
            {transactionSection.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </div>

          {/* Reports Section */}
          <div className="mt-6">
            <p className="accounting-nav-section">Reports</p>
            {reportSection.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </div>

          {/* Administration Section */}
          <div className="mt-6">
            <p className="accounting-nav-section">Administration</p>
            {adminSection.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
