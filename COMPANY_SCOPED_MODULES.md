# Company-Scoped Module Implementation Guide

## Overview

This document outlines the implementation strategy for ensuring that **every module in the multi-tenant accounting system is properly scoped to the currently selected company**, not global administration. The global administration features should be completely separate and only accessible to global administrators.

## Key Principles

### 1. Company Context First
- Every non-global administrative module must operate within the context of the currently selected company
- The `useCompany()` hook provides access to the current company context
- No operations should be allowed without a selected company (except global admin functions)

### 2. Clear Separation
- **Company-Scoped Modules**: All accounting, transactions, reports, settings, and user management within a company
- **Global Administration**: Only system-wide operations like creating companies, managing global users, system health

## Implementation Checklist

### ✅ Already Implemented (Company-Scoped)

1. **Dashboard** (`/pages/Dashboard.tsx`)
   - ✅ Uses `useCompany()` hook
   - ✅ Queries are enabled only when `currentCompany` exists
   - ✅ Shows "No Company Selected" when no company is available

2. **Chart of Accounts** (`/pages/accounting/ChartOfAccounts.tsx`)
   - ✅ Uses `useCompany()` hook
   - ✅ API calls include company context
   - ✅ Account creation scoped to current company

3. **General Ledger** (`/pages/accounting/GeneralLedger.tsx`)
   - ✅ Uses `useCompany()` hook
   - ✅ Filters data by current company
   - ✅ Company validation on all queries

4. **Company Settings** (`/pages/Settings.tsx`)
   - ✅ Comprehensive settings for selected company only
   - ✅ Company information, financial settings, notifications
   - ✅ Security settings, integrations, and data export
   - ✅ Proper permission checking with `usePermissions()`

5. **User Management** (`/pages/admin/UserManagement.tsx`)
   - ✅ Uses `useCompany()` hook  
   - ✅ Shows users for current company only (non-global admins)
   - ✅ Global admins see all users across companies

### 🔄 Server-Side API Validation

All API endpoints (except global admin routes) validate company access:

```typescript
// Standard pattern for company-scoped endpoints
app.get('/api/[resource]', requireAuth, async (req, res) => {
  if (!req.session.currentCompanyId) {
    return res.status(400).json({ message: 'No company selected' });
  }
  
  // Verify user has access to the company
  const userCompany = await storage.getUserCompany(req.session.userId!, req.session.currentCompanyId);
  if (!userCompany) {
    return res.status(403).json({ message: 'Access denied to this company' });
  }
  
  // Proceed with company-scoped operation
});
```

### 📋 Modules to Validate/Update

#### 1. Transactions Module
**Location**: `/pages/transactions/`
- **Journal Entries** - Verify company scoping
- **Invoices** - Ensure company-specific invoice management
- **Bills** - Validate vendor bills are company-scoped
- **Payments** - Check payment processing is within company context

#### 2. Reports Module  
**Location**: `/pages/reports/`
- **Financial Statements** - Must generate reports for current company only
- **Trial Balance** - Company-specific trial balance
- **Custom Reports** - Scoped to current company data

#### 3. Additional Accounting Modules
- **Accounts Receivable** - Customer management per company
- **Accounts Payable** - Vendor management per company  
- **Bank Reconciliation** - Company bank account reconciliation

### 🛡️ Permission System Integration

Each module should use the permission system correctly:

```typescript
import { usePermissions } from "@/hooks/usePermissions";

const { canViewAccounts, canEditAccounts, currentRole } = usePermissions();

// Check company-specific permissions
if (!canViewAccounts()) {
  return <AccessDenied />;
}
```

### 🏢 Company Switching Behavior

When users switch companies:
1. **Immediate Context Update**: `useCompany()` hook updates `currentCompany`
2. **Query Invalidation**: React Query invalidates all company-dependent queries
3. **UI Refresh**: Components re-render with new company context
4. **Permission Re-evaluation**: User permissions recalculated for new company

### 🔐 Global vs Company Administration

#### Global Administration (`/admin/GlobalAdministration.tsx`)
- **Purpose**: System-wide management
- **Access**: Global administrators only
- **Scope**: Cross-company operations
- **Features**: 
  - Create/edit/delete companies
  - Manage global users
  - System statistics and health
  - Activity logs across all companies

#### Company Administration (Various modules)
- **Purpose**: Company-specific management  
- **Access**: Company administrators, managers (role-based)
- **Scope**: Current company only
- **Features**:
  - Company settings
  - Company user management
  - Company-specific configurations
  - Company data export/backup

### 📊 Data Flow Architecture

```
User Login → Company Selection → Company-Scoped Operations
     ↓              ↓                    ↓
Set Session → Update useCompany() → Enable Queries/Mutations
     ↓              ↓                    ↓
Permissions → Role Validation → Company-Specific UI
```

### 🔍 Validation Points

Every component should validate:

1. **Company Selection**: `if (!currentCompany) return <NoCompanySelected />`
2. **Permissions**: `if (!canView) return <AccessDenied />`  
3. **API Queries**: `enabled: !!currentCompany && canView()`
4. **Mutations**: Include company ID in all create/update operations

### 🚀 Implementation Examples

#### Component Template
```typescript
export default function CompanyModule() {
  const { currentCompany } = useCompany();
  const { canView, canEdit } = usePermissions();
  
  const { data, isLoading } = useQuery({
    queryKey: ['/api/resource', currentCompany?.id],
    queryFn: () => fetchResource(),
    enabled: !!currentCompany && canView(),
  });
  
  if (!currentCompany) {
    return <NoCompanySelected />;
  }
  
  if (!canView()) {
    return <AccessDenied />;
  }
  
  return (
    // Component UI with company-scoped operations
  );
}
```

#### API Endpoint Template
```typescript
app.get('/api/resource', requireAuth, async (req, res) => {
  try {
    if (!req.session.currentCompanyId) {
      return res.status(400).json({ message: 'No company selected' });
    }
    
    const data = await storage.getResourceByCompany(req.session.currentCompanyId);
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
```

## Testing Company Scoping

### Manual Testing
1. **Multi-Company Test**: Create multiple companies, switch between them
2. **Permission Test**: Test different user roles in the same company
3. **Isolation Test**: Verify data isolation between companies
4. **Global Admin Test**: Verify global admin can see cross-company data

### Automated Testing
- Unit tests for `useCompany()` hook
- Integration tests for company switching
- API tests for company access validation
- Permission system tests

## Security Considerations

1. **Data Isolation**: No company can access another company's data
2. **Role-Based Access**: Users can only perform actions allowed by their role
3. **Session Management**: Company context persisted in secure sessions
4. **API Validation**: Every endpoint validates company access
5. **Audit Trail**: All actions logged with company context

## Migration Strategy

For modules not yet company-scoped:

1. **Audit Current State**: Identify modules lacking company context
2. **Add Company Validation**: Implement `useCompany()` and permission checks  
3. **Update API Calls**: Ensure all queries/mutations include company context
4. **Test Thoroughly**: Verify data isolation and permission enforcement
5. **Document Changes**: Update this guide with completion status

## Conclusion

By following this guide, we ensure that:
- Every module operates within proper company boundaries
- Data remains isolated between companies  
- Users can only access data and perform actions appropriate to their role
- The system maintains security and multi-tenancy integrity
- Global administration remains separate from company operations

This architecture provides a solid foundation for a secure, scalable multi-tenant accounting system where each company's data and operations remain completely isolated and properly governed. 