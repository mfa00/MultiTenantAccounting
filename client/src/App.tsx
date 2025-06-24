import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import AppLayout from "@/components/layout/AppLayout";
import ChartOfAccounts from "@/pages/accounting/ChartOfAccounts";
import GeneralLedger from "@/pages/accounting/GeneralLedger";
import AccountsReceivable from "@/pages/accounting/AccountsReceivable";
import AccountsPayable from "@/pages/accounting/AccountsPayable";
import BankReconciliation from "@/pages/accounting/BankReconciliation";
import JournalEntries from "@/pages/transactions/JournalEntries";
import Invoices from "@/pages/transactions/Invoices";
import FinancialStatements from "@/pages/reports/FinancialStatements";
import UserManagement from "@/pages/admin/UserManagement";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import RoleManagement from "@/pages/admin/RoleManagement";
import GlobalAdministration from "@/pages/admin/GlobalAdministration";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/chart-of-accounts" component={() => <ProtectedRoute component={ChartOfAccounts} />} />
      <Route path="/general-ledger" component={() => <ProtectedRoute component={GeneralLedger} />} />
      <Route path="/accounts-receivable" component={() => <ProtectedRoute component={AccountsReceivable} />} />
      <Route path="/accounts-payable" component={() => <ProtectedRoute component={AccountsPayable} />} />
      <Route path="/bank-reconciliation" component={() => <ProtectedRoute component={BankReconciliation} />} />
      <Route path="/journal-entries" component={() => <ProtectedRoute component={JournalEntries} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/financial-statements" component={() => <ProtectedRoute component={FinancialStatements} />} />
      <Route path="/user-management" component={() => <ProtectedRoute component={UserManagement} />} />
      <Route path="/role-management" component={() => <ProtectedRoute component={RoleManagement} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/global-administration" component={() => <ProtectedRoute component={GlobalAdministration} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
