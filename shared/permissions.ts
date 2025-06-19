// Role-based permissions system
export type Role = 'assistant' | 'accountant' | 'manager' | 'administrator';

export interface Permission {
  module: string;
  action: string;
  description: string;
}

// Define all available permissions
export const PERMISSIONS = {
  // User Management
  USER_VIEW: { module: 'users', action: 'view', description: 'View user list' },
  USER_CREATE: { module: 'users', action: 'create', description: 'Create new users' },
  USER_EDIT: { module: 'users', action: 'edit', description: 'Edit user details' },
  USER_DELETE: { module: 'users', action: 'delete', description: 'Delete users' },
  USER_ASSIGN_ROLES: { module: 'users', action: 'assign_roles', description: 'Assign roles to users' },
  
  // Company Management
  COMPANY_VIEW: { module: 'companies', action: 'view', description: 'View company list' },
  COMPANY_CREATE: { module: 'companies', action: 'create', description: 'Create new companies' },
  COMPANY_EDIT: { module: 'companies', action: 'edit', description: 'Edit company details' },
  COMPANY_DELETE: { module: 'companies', action: 'delete', description: 'Delete companies' },
  
  // Chart of Accounts
  ACCOUNTS_VIEW: { module: 'accounts', action: 'view', description: 'View chart of accounts' },
  ACCOUNTS_CREATE: { module: 'accounts', action: 'create', description: 'Create new accounts' },
  ACCOUNTS_EDIT: { module: 'accounts', action: 'edit', description: 'Edit account details' },
  ACCOUNTS_DELETE: { module: 'accounts', action: 'delete', description: 'Delete accounts' },
  
  // Journal Entries
  JOURNAL_VIEW: { module: 'journal', action: 'view', description: 'View journal entries' },
  JOURNAL_CREATE: { module: 'journal', action: 'create', description: 'Create journal entries' },
  JOURNAL_EDIT: { module: 'journal', action: 'edit', description: 'Edit journal entries' },
  JOURNAL_DELETE: { module: 'journal', action: 'delete', description: 'Delete journal entries' },
  JOURNAL_POST: { module: 'journal', action: 'post', description: 'Post journal entries' },
  JOURNAL_UNPOST: { module: 'journal', action: 'unpost', description: 'Unpost journal entries' },
  
  // Customers & Vendors
  CUSTOMERS_VIEW: { module: 'customers', action: 'view', description: 'View customers' },
  CUSTOMERS_CREATE: { module: 'customers', action: 'create', description: 'Create customers' },
  CUSTOMERS_EDIT: { module: 'customers', action: 'edit', description: 'Edit customers' },
  CUSTOMERS_DELETE: { module: 'customers', action: 'delete', description: 'Delete customers' },
  
  VENDORS_VIEW: { module: 'vendors', action: 'view', description: 'View vendors' },
  VENDORS_CREATE: { module: 'vendors', action: 'create', description: 'Create vendors' },
  VENDORS_EDIT: { module: 'vendors', action: 'edit', description: 'Edit vendors' },
  VENDORS_DELETE: { module: 'vendors', action: 'delete', description: 'Delete vendors' },
  
  // Invoices & Bills
  INVOICES_VIEW: { module: 'invoices', action: 'view', description: 'View invoices' },
  INVOICES_CREATE: { module: 'invoices', action: 'create', description: 'Create invoices' },
  INVOICES_EDIT: { module: 'invoices', action: 'edit', description: 'Edit invoices' },
  INVOICES_DELETE: { module: 'invoices', action: 'delete', description: 'Delete invoices' },
  INVOICES_SEND: { module: 'invoices', action: 'send', description: 'Send invoices to customers' },
  
  BILLS_VIEW: { module: 'bills', action: 'view', description: 'View bills' },
  BILLS_CREATE: { module: 'bills', action: 'create', description: 'Create bills' },
  BILLS_EDIT: { module: 'bills', action: 'edit', description: 'Edit bills' },
  BILLS_DELETE: { module: 'bills', action: 'delete', description: 'Delete bills' },
  BILLS_PAY: { module: 'bills', action: 'pay', description: 'Mark bills as paid' },
  
  // Reports
  REPORTS_VIEW: { module: 'reports', action: 'view', description: 'View financial reports' },
  REPORTS_EXPORT: { module: 'reports', action: 'export', description: 'Export reports' },
  REPORTS_CUSTOM: { module: 'reports', action: 'custom', description: 'Create custom reports' },
  
  // Settings
  SETTINGS_VIEW: { module: 'settings', action: 'view', description: 'View company settings' },
  SETTINGS_EDIT: { module: 'settings', action: 'edit', description: 'Edit company settings' },
  
  // Dashboard
  DASHBOARD_VIEW: { module: 'dashboard', action: 'view', description: 'View dashboard' },
} as const;

// Role permissions mapping
export const ROLE_PERMISSIONS: Record<Role, (keyof typeof PERMISSIONS)[]> = {
  // Assistant Accountant - Limited data entry and basic reporting
  assistant: [
    'DASHBOARD_VIEW',
    'ACCOUNTS_VIEW',
    'CUSTOMERS_VIEW',
    'CUSTOMERS_CREATE',
    'CUSTOMERS_EDIT',
    'VENDORS_VIEW',
    'VENDORS_CREATE',
    'VENDORS_EDIT',
    'JOURNAL_VIEW',
    'JOURNAL_CREATE',
    'INVOICES_VIEW',
    'INVOICES_CREATE',
    'BILLS_VIEW',
    'BILLS_CREATE',
    'REPORTS_VIEW',
  ],
  
  // Accountant - Full accounting operations except user/company management
  accountant: [
    'DASHBOARD_VIEW',
    'ACCOUNTS_VIEW',
    'ACCOUNTS_CREATE',
    'ACCOUNTS_EDIT',
    'CUSTOMERS_VIEW',
    'CUSTOMERS_CREATE',
    'CUSTOMERS_EDIT',
    'CUSTOMERS_DELETE',
    'VENDORS_VIEW',
    'VENDORS_CREATE',
    'VENDORS_EDIT',
    'VENDORS_DELETE',
    'JOURNAL_VIEW',
    'JOURNAL_CREATE',
    'JOURNAL_EDIT',
    'JOURNAL_POST',
    'JOURNAL_UNPOST',
    'INVOICES_VIEW',
    'INVOICES_CREATE',
    'INVOICES_EDIT',
    'INVOICES_SEND',
    'BILLS_VIEW',
    'BILLS_CREATE',
    'BILLS_EDIT',
    'BILLS_PAY',
    'REPORTS_VIEW',
    'REPORTS_EXPORT',
    'SETTINGS_VIEW',
  ],
  
  // Manager - Full accounting + company management
  manager: [
    'DASHBOARD_VIEW',
    'ACCOUNTS_VIEW',
    'ACCOUNTS_CREATE',
    'ACCOUNTS_EDIT',
    'ACCOUNTS_DELETE',
    'CUSTOMERS_VIEW',
    'CUSTOMERS_CREATE',
    'CUSTOMERS_EDIT',
    'CUSTOMERS_DELETE',
    'VENDORS_VIEW',
    'VENDORS_CREATE',
    'VENDORS_EDIT',
    'VENDORS_DELETE',
    'JOURNAL_VIEW',
    'JOURNAL_CREATE',
    'JOURNAL_EDIT',
    'JOURNAL_DELETE',
    'JOURNAL_POST',
    'JOURNAL_UNPOST',
    'INVOICES_VIEW',
    'INVOICES_CREATE',
    'INVOICES_EDIT',
    'INVOICES_DELETE',
    'INVOICES_SEND',
    'BILLS_VIEW',
    'BILLS_CREATE',
    'BILLS_EDIT',
    'BILLS_DELETE',
    'BILLS_PAY',
    'REPORTS_VIEW',
    'REPORTS_EXPORT',
    'REPORTS_CUSTOM',
    'SETTINGS_VIEW',
    'SETTINGS_EDIT',
    'USER_VIEW',
    'USER_CREATE',
    'USER_EDIT',
    'USER_ASSIGN_ROLES',
    'COMPANY_VIEW',
    'COMPANY_EDIT',
  ],
  
  // Administrator - Full system access
  administrator: [
    'DASHBOARD_VIEW',
    'ACCOUNTS_VIEW',
    'ACCOUNTS_CREATE',
    'ACCOUNTS_EDIT',
    'ACCOUNTS_DELETE',
    'CUSTOMERS_VIEW',
    'CUSTOMERS_CREATE',
    'CUSTOMERS_EDIT',
    'CUSTOMERS_DELETE',
    'VENDORS_VIEW',
    'VENDORS_CREATE',
    'VENDORS_EDIT',
    'VENDORS_DELETE',
    'JOURNAL_VIEW',
    'JOURNAL_CREATE',
    'JOURNAL_EDIT',
    'JOURNAL_DELETE',
    'JOURNAL_POST',
    'JOURNAL_UNPOST',
    'INVOICES_VIEW',
    'INVOICES_CREATE',
    'INVOICES_EDIT',
    'INVOICES_DELETE',
    'INVOICES_SEND',
    'BILLS_VIEW',
    'BILLS_CREATE',
    'BILLS_EDIT',
    'BILLS_DELETE',
    'BILLS_PAY',
    'REPORTS_VIEW',
    'REPORTS_EXPORT',
    'REPORTS_CUSTOM',
    'SETTINGS_VIEW',
    'SETTINGS_EDIT',
    'USER_VIEW',
    'USER_CREATE',
    'USER_EDIT',
    'USER_DELETE',
    'USER_ASSIGN_ROLES',
    'COMPANY_VIEW',
    'COMPANY_CREATE',
    'COMPANY_EDIT',
    'COMPANY_DELETE',
  ],
};

// Helper functions
export function hasPermission(userRole: Role, permission: keyof typeof PERMISSIONS): boolean {
  return ROLE_PERMISSIONS[userRole].includes(permission);
}

export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role].map(permissionKey => PERMISSIONS[permissionKey]);
}

export function getAllPermissions(): Permission[] {
  return Object.values(PERMISSIONS);
}

export function getRoleDescription(role: Role): string {
  switch (role) {
    case 'assistant':
      return 'Limited data entry and basic reporting access. Can create customers, vendors, and basic transactions but cannot modify system settings or manage users.';
    case 'accountant':
      return 'Full accounting operations including journal entries, invoices, bills, and financial reporting. Cannot manage users or companies.';
    case 'manager':
      return 'Complete accounting access plus company management. Can manage users within their company and modify company settings.';
    case 'administrator':
      return 'Full system access including user management, company creation, and all accounting operations across all companies.';
    default:
      return 'Unknown role';
  }
}

export function getRoleHierarchy(): Role[] {
  return ['assistant', 'accountant', 'manager', 'administrator'];
}

export function canAssignRole(assignerRole: Role, targetRole: Role): boolean {
  const hierarchy = getRoleHierarchy();
  const assignerLevel = hierarchy.indexOf(assignerRole);
  const targetLevel = hierarchy.indexOf(targetRole);
  
  // Administrators can assign any role
  if (assignerRole === 'administrator') return true;
  
  // Managers can assign assistant and accountant roles
  if (assignerRole === 'manager') return ['assistant', 'accountant'].includes(targetRole);
  
  // Others cannot assign roles
  return false;
}