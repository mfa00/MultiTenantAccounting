import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { hasPermission, type Role, PERMISSIONS, getRolePermissions, canAssignRole } from '@shared/permissions';

export function usePermissions() {
  const { companies } = useAuth();
  const { currentCompany } = useCompany();

  // Get current user's role for the selected company
  const getCurrentRole = (): Role | null => {
    if (!currentCompany || !companies) return null;
    
    const userCompany = companies.find(uc => uc.id === currentCompany.id);
    return userCompany?.role as Role || null;
  };

  const currentRole = getCurrentRole();

  // Check if user has a specific permission
  const can = (permission: keyof typeof PERMISSIONS): boolean => {
    if (!currentRole) return false;
    return hasPermission(currentRole, permission);
  };

  // Check if user can perform multiple permissions (OR logic)
  const canAny = (permissions: (keyof typeof PERMISSIONS)[]): boolean => {
    return permissions.some(permission => can(permission));
  };

  // Check if user can perform all permissions (AND logic)
  const canAll = (permissions: (keyof typeof PERMISSIONS)[]): boolean => {
    return permissions.every(permission => can(permission));
  };

  // Check if user can assign a specific role
  const canAssign = (targetRole: Role): boolean => {
    if (!currentRole) return false;
    return canAssignRole(currentRole, targetRole);
  };

  // Get all permissions for current role
  const getPermissions = () => {
    if (!currentRole) return [];
    return getRolePermissions(currentRole);
  };

  // Helper functions for common permission checks
  const permissions = {
    // User Management
    canViewUsers: () => can('USER_VIEW'),
    canCreateUsers: () => can('USER_CREATE'),
    canEditUsers: () => can('USER_EDIT'),
    canDeleteUsers: () => can('USER_DELETE'),
    canAssignRoles: () => can('USER_ASSIGN_ROLES'),

    // Company Management
    canViewCompanies: () => can('COMPANY_VIEW'),
    canCreateCompanies: () => can('COMPANY_CREATE'),
    canEditCompanies: () => can('COMPANY_EDIT'),
    canDeleteCompanies: () => can('COMPANY_DELETE'),

    // Chart of Accounts
    canViewAccounts: () => can('ACCOUNTS_VIEW'),
    canCreateAccounts: () => can('ACCOUNTS_CREATE'),
    canEditAccounts: () => can('ACCOUNTS_EDIT'),
    canDeleteAccounts: () => can('ACCOUNTS_DELETE'),

    // Journal Entries
    canViewJournal: () => can('JOURNAL_VIEW'),
    canCreateJournal: () => can('JOURNAL_CREATE'),
    canEditJournal: () => can('JOURNAL_EDIT'),
    canDeleteJournal: () => can('JOURNAL_DELETE'),
    canPostJournal: () => can('JOURNAL_POST'),
    canUnpostJournal: () => can('JOURNAL_UNPOST'),

    // Customers & Vendors
    canViewCustomers: () => can('CUSTOMERS_VIEW'),
    canCreateCustomers: () => can('CUSTOMERS_CREATE'),
    canEditCustomers: () => can('CUSTOMERS_EDIT'),
    canDeleteCustomers: () => can('CUSTOMERS_DELETE'),

    canViewVendors: () => can('VENDORS_VIEW'),
    canCreateVendors: () => can('VENDORS_CREATE'),
    canEditVendors: () => can('VENDORS_EDIT'),
    canDeleteVendors: () => can('VENDORS_DELETE'),

    // Invoices & Bills
    canViewInvoices: () => can('INVOICES_VIEW'),
    canCreateInvoices: () => can('INVOICES_CREATE'),
    canEditInvoices: () => can('INVOICES_EDIT'),
    canDeleteInvoices: () => can('INVOICES_DELETE'),
    canSendInvoices: () => can('INVOICES_SEND'),

    canViewBills: () => can('BILLS_VIEW'),
    canCreateBills: () => can('BILLS_CREATE'),
    canEditBills: () => can('BILLS_EDIT'),
    canDeleteBills: () => can('BILLS_DELETE'),
    canPayBills: () => can('BILLS_PAY'),

    // Reports
    canViewReports: () => can('REPORTS_VIEW'),
    canExportReports: () => can('REPORTS_EXPORT'),
    canCreateCustomReports: () => can('REPORTS_CUSTOM'),

    // Settings
    canViewSettings: () => can('SETTINGS_VIEW'),
    canEditSettings: () => can('SETTINGS_EDIT'),

    // Dashboard
    canViewDashboard: () => can('DASHBOARD_VIEW'),
  };

  return {
    currentRole,
    can,
    canAny,
    canAll,
    canAssign,
    getPermissions,
    ...permissions,
  };
}