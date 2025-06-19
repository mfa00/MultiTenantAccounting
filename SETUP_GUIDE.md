# Multi-Tenant Accounting System - Setup Guide

## 🚀 Getting Started with Global Administration

This guide will help you set up the complete multi-tenant accounting system, starting with global administration functionality.

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (recommended: Neon.tech for cloud)
- Git repository cloned

### Step 1: Environment Setup

1. **Create your `.env` file:**
```bash
# Database Configuration
DATABASE_URL=postgresql://your_user:your_password@your_host:5432/multitenant_accounting

# Application Configuration
NODE_ENV=development
PORT=5000
SESSION_SECRET=change-this-to-a-random-secret-key-for-production
```

2. **Install dependencies:**
```bash
npm install
```

### Step 2: Database Setup

1. **Run database migration:**
```bash
npm run db:migrate
```

2. **Initialize with sample data:**
```bash
npm run db:init
```

3. **Verify setup:**
```bash
npm run db:quick-check
```

### Step 3: Test Database Queries

Run comprehensive test queries to verify everything is working:

```bash
# Run all test queries
npm run db:test-queries

# Quick status check
npm run db:quick-check

# Health check
npm run db:health

# Validate schema
npm run db:validate
```

### Step 4: Start the Application

```bash
npm run dev
```

The application will start on `http://localhost:5000`

### Default Login Credentials

After running `npm run db:init`, you'll have these test accounts:

#### Global Administrator
- **Username:** `admin`
- **Password:** `admin123`
- **Access:** All companies, full system access

#### Company Manager (ACME Corp)
- **Username:** `manager`
- **Password:** `manager123`
- **Access:** ACME Corporation management

#### Accountant (TechStart Inc)
- **Username:** `accountant`
- **Password:** `accountant123`
- **Access:** TechStart Inc accounting

#### Assistant (Global Consulting)
- **Username:** `assistant`
- **Password:** `assistant123`
- **Access:** Global Consulting LLC

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run db:migrate` | Run database migrations |
| `npm run db:init` | Initialize database with sample data |
| `npm run db:health` | Check database health |
| `npm run db:status` | Show complete database status |
| `npm run db:validate` | Validate database schema |
| `npm run db:test` | Test database connection |
| `npm run db:test-queries` | Run comprehensive test queries |
| `npm run db:quick-check` | Quick status check |

### Sample Companies Created

1. **ACME Corporation** (`ACME`)
   - Business sector company
   - Standard fiscal year (January)
   - Complete chart of accounts

2. **TechStart Inc** (`TECH`)
   - Technology startup
   - Standard fiscal year (January)
   - Complete chart of accounts

3. **Global Consulting LLC** (`GCLLC`)
   - Consulting firm
   - Fiscal year starts in April
   - Complete chart of accounts

### API Endpoints for Global Administration

The system includes comprehensive API endpoints at `/api/global-admin`:

#### User Management
- `GET /api/global-admin/users` - Get all users with company assignments
- `GET /api/global-admin/user-assignments` - Get detailed user-company assignments

#### Company Management
- `GET /api/global-admin/companies` - Get all companies with statistics
- `POST /api/global-admin/companies` - Create new company
- `POST /api/global-admin/assign-user` - Assign user to company

#### System Statistics
- `GET /api/global-admin/stats` - Get system statistics
- `GET /api/global-admin/activity` - Get recent activity logs

### Database Schema Overview

The system uses these main tables:

1. **users** - User accounts with global roles
2. **companies** - Multi-tenant company records
3. **user_companies** - User-company role assignments
4. **accounts** - Chart of accounts per company
5. **activity_logs** - System activity tracking

### Chart of Accounts

Each company gets a standard chart of accounts:

#### Assets (1000-1999)
- 1000: Cash
- 1100: Accounts Receivable
- 1200: Inventory
- 1500: Equipment
- 1600: Accumulated Depreciation

#### Liabilities (2000-2999)
- 2000: Accounts Payable
- 2100: Accrued Expenses
- 2500: Long-term Debt

#### Equity (3000-3999)
- 3000: Owner's Equity
- 3100: Retained Earnings

#### Revenue (4000-4999)
- 4000: Sales Revenue
- 4100: Service Revenue

#### Expenses (5000-6999)
- 5000: Cost of Goods Sold
- 6000: Office Expenses
- 6100: Rent Expense
- 6200: Utilities Expense
- 6300: Insurance Expense
- 6400: Depreciation Expense

### Troubleshooting

#### Database Connection Issues
1. Verify your `DATABASE_URL` in `.env`
2. Run `npm run db:test` to test connection
3. Check database server is running

#### Migration Issues
1. Run `npm run db:status` to check current state
2. Ensure database exists and is accessible
3. Check migration files in `/migrations`

#### Data Issues
1. Run test queries: `npm run db:test-queries`
2. Check data integrity: `npm run db:validate`
3. Re-initialize if needed: `npm run db:init`

### Next Steps

1. **Explore Global Administration:**
   - Login as admin user
   - Navigate to Global Administration
   - Manage users and companies

2. **Test Multi-Tenancy:**
   - Login as different users
   - Switch between companies
   - Verify data isolation

3. **Develop Features:**
   - Add journal entries
   - Generate reports
   - Manage invoices

### Development Notes

- All SQL queries are in `/scripts` directory
- API routes are in `/server/api`
- Frontend components are in `/client/src`
- Database schema is in `/shared/schema.ts`
- Validation logic is in `/server/db-validation.ts`

### Security Considerations

⚠️ **Important for Production:**
- Change default passwords
- Use strong SESSION_SECRET
- Enable SSL for database
- Implement proper authentication middleware
- Add rate limiting
- Validate all inputs

---

## 🎯 You're Ready!

Your multi-tenant accounting system is now set up and ready for development. Start with the global administration features and expand from there.

For questions or issues, check the troubleshooting section above or examine the comprehensive test queries and validation scripts. 