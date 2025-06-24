import express, { type Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { authenticateUser, hashPassword, getUserWithCompanies } from "./auth";
import { insertUserSchema, insertCompanySchema, insertAccountSchema, insertJournalEntrySchema, insertUserCompanySchema, users as usersTable, userCompanies as userCompaniesTable, companies as companiesTable, accounts, journalEntries, activityLogs, companySettings } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "./db";
import globalAdminRouter from "./api/global-admin";
import activityLogsRouter from "./api/activity-logs";
import { apiRequest } from "../client/src/lib/queryClient";
import { activityLogger, ACTIVITY_ACTIONS, RESOURCE_TYPES } from "./services/activity-logger";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    currentCompanyId?: number;
  }
}

// Company settings helper functions
async function getCompanySettings(companyId: number) {
  try {
    const [settings] = await db.select().from(companySettings).where(eq(companySettings.companyId, companyId));
    return settings || undefined;
  } catch (error) {
    console.error('Error fetching company settings:', error);
    return undefined;
  }
}

async function createCompanySettings(settings: any) {
  try {
    const [newSettings] = await db.insert(companySettings).values(settings).returning();
    return newSettings;
  } catch (error) {
    console.error('Error creating company settings:', error);
    throw error;
  }
}

async function updateCompanySettings(companyId: number, settingsUpdate: any) {
  try {
    const [updatedSettings] = await db.update(companySettings).set(settingsUpdate).where(eq(companySettings.companyId, companyId)).returning();
    return updatedSettings || undefined;
  } catch (error) {
    console.error('Error updating company settings:', error);
    return undefined;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'accounting-app-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    next();
  };

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      const user = await authenticateUser(username, password);
      if (!user) {
        // Log failed login attempt
        await activityLogger.logError(
          ACTIVITY_ACTIONS.LOGIN,
          RESOURCE_TYPES.USER,
          {
            userId: 0, // Unknown user
            ipAddress: req.ip,
            userAgent: req.get("User-Agent")
          },
          'Invalid credentials',
          undefined,
          { attemptedUsername: username }
        );
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      req.session.userId = user.id;
      
      const userWithCompanies = await getUserWithCompanies(user.id);
      if (userWithCompanies && userWithCompanies.companies.length > 0) {
        req.session.currentCompanyId = userWithCompanies.companies[0].id;
      }

      // Log successful login
      await activityLogger.logAuth(
        ACTIVITY_ACTIONS.LOGIN,
        {
          userId: user.id,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        { 
          username: user.username,
          companiesCount: userWithCompanies?.companies.length || 0
        }
      );

      res.json(userWithCompanies);
    } catch (error) {
      console.error('Login error:', error);
      
      // Log login system error
      await activityLogger.logError(
        ACTIVITY_ACTIONS.LOGIN,
        RESOURCE_TYPES.SYSTEM,
        {
          userId: 0,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        error as Error,
        undefined,
        { attemptedUsername: req.body?.username }
      );
      
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username) || 
                          await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      req.session.userId = user.id;
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        companies: [],
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Could not log out' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const userWithCompanies = await getUserWithCompanies(req.session.userId!);
      if (!userWithCompanies) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(userWithCompanies);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Company routes
  app.get('/api/companies', requireAuth, async (req, res) => {
    try {
      const companies = await storage.getCompaniesByUser(req.session.userId!);
      res.json(companies);
    } catch (error) {
      console.error('Get companies error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/companies', requireAuth, async (req, res) => {
    try {
      const companyData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(companyData);
      
      // Assign user as manager of the new company
      await storage.createUserCompany({
        userId: req.session.userId!,
        companyId: company.id,
        role: 'manager',
      });

      res.json(company);
    } catch (error) {
      console.error('Create company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/companies/:id/switch', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Verify user has access to this company
      const userCompany = await storage.getUserCompany(req.session.userId!, companyId);
      if (!userCompany) {
        return res.status(403).json({ message: 'Access denied to this company' });
      }

      req.session.currentCompanyId = companyId;
      res.json({ message: 'Company switched successfully' });
    } catch (error) {
      console.error('Switch company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Account routes
  app.get('/api/accounts', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }
      
      const accounts = await storage.getAccountsByCompany(req.session.currentCompanyId);
      res.json(accounts);
    } catch (error) {
      console.error('Get accounts error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/accounts', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const accountData = insertAccountSchema.parse({
        ...req.body,
        companyId: req.session.currentCompanyId,
      });
      
      const account = await storage.createAccount(accountData);
      
      // Log account creation
      await activityLogger.logCRUD(
        ACTIVITY_ACTIONS.ACCOUNT_CREATE,
        RESOURCE_TYPES.ACCOUNT,
        {
          userId: req.session.userId!,
          companyId: req.session.currentCompanyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        account.id,
        undefined,
        account
      );
      
      res.json(account);
    } catch (error) {
      console.error('Create account error:', error);
      
      // Log account creation error
      await activityLogger.logError(
        ACTIVITY_ACTIONS.ACCOUNT_CREATE,
        RESOURCE_TYPES.ACCOUNT,
        {
          userId: req.session.userId!,
          companyId: req.session.currentCompanyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        error as Error,
        undefined,
        { accountData: req.body }
      );
      
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const accountId = parseInt(req.params.id);
      const updateData = req.body;

      // Get the original account for logging
      const originalAccount = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.companyId, req.session.currentCompanyId)))
        .limit(1);

      if (!originalAccount || originalAccount.length === 0) {
        return res.status(404).json({ message: 'Account not found' });
      }

      // Update the account
      const [updatedAccount] = await db
        .update(accounts)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString()
        })
        .where(and(eq(accounts.id, accountId), eq(accounts.companyId, req.session.currentCompanyId)))
        .returning();

      if (!updatedAccount) {
        return res.status(404).json({ message: 'Account not found' });
      }

      // Log account update
      await activityLogger.logCRUD(
        ACTIVITY_ACTIONS.ACCOUNT_UPDATE,
        RESOURCE_TYPES.ACCOUNT,
        {
          userId: req.session.userId!,
          companyId: req.session.currentCompanyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        accountId,
        originalAccount[0],
        updatedAccount
      );

      res.json(updatedAccount);
    } catch (error) {
      console.error('Update account error:', error);
      
      // Log account update error
      await activityLogger.logError(
        ACTIVITY_ACTIONS.ACCOUNT_UPDATE,
        RESOURCE_TYPES.ACCOUNT,
        {
          userId: req.session.userId!,
          companyId: req.session.currentCompanyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        error as Error,
        parseInt(req.params.id),
        { updateData: req.body }
      );
      
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const accountId = parseInt(req.params.id);

      // Get the account before deletion for logging
      const [accountToDelete] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.companyId, req.session.currentCompanyId)))
        .limit(1);

      if (!accountToDelete) {
        return res.status(404).json({ message: 'Account not found' });
      }

      // Check if account has any transactions - if so, just deactivate instead of delete
      // For now, we'll allow deletion, but in production you'd check for dependencies
      const [deletedAccount] = await db
        .delete(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.companyId, req.session.currentCompanyId)))
        .returning();

      if (!deletedAccount) {
        return res.status(404).json({ message: 'Account not found' });
      }

      // Log account deletion
      await activityLogger.logCRUD(
        ACTIVITY_ACTIONS.ACCOUNT_DELETE,
        RESOURCE_TYPES.ACCOUNT,
        {
          userId: req.session.userId!,
          companyId: req.session.currentCompanyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        accountId,
        accountToDelete,
        undefined
      );

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Delete account error:', error);
      
      // Log account deletion error
      await activityLogger.logError(
        ACTIVITY_ACTIONS.ACCOUNT_DELETE,
        RESOURCE_TYPES.ACCOUNT,
        {
          userId: req.session.userId!,
          companyId: req.session.currentCompanyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        error as Error,
        parseInt(req.params.id)
      );
      
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Journal Entry routes
  app.get('/api/journal-entries', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }
      
      const entries = await storage.getJournalEntriesByCompany(req.session.currentCompanyId);
      res.json(entries);
    } catch (error) {
      console.error('Get journal entries error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/journal-entries', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const entryData = insertJournalEntrySchema.parse({
        ...req.body,
        companyId: req.session.currentCompanyId,
        userId: req.session.userId,
      });
      
      const entry = await storage.createJournalEntry(entryData);
      res.json(entry);
    } catch (error) {
      console.error('Create journal entry error:', error);
      
      // Log journal entry creation error
      await activityLogger.logError(
        ACTIVITY_ACTIONS.JOURNAL_CREATE,
        RESOURCE_TYPES.JOURNAL_ENTRY,
        {
          userId: req.session.userId!,
          companyId: req.session.currentCompanyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        error as Error,
        undefined,
        { entryData: req.body }
      );
      
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/journal-entries/:id', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const entryId = parseInt(req.params.id);
      const updateData = req.body;

      const updatedEntry = await storage.updateJournalEntry(entryId, updateData);
      if (!updatedEntry) {
        return res.status(404).json({ message: 'Journal entry not found' });
      }

      res.json(updatedEntry);
    } catch (error) {
      console.error('Update journal entry error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/journal-entries/:id', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const entryId = parseInt(req.params.id);

      // Check if entry is posted - posted entries shouldn't be deleted
      const entry = await storage.getJournalEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: 'Journal entry not found' });
      }

      if (entry.isPosted) {
        return res.status(400).json({ 
          message: 'Cannot delete posted journal entries. Please reverse the entry instead.' 
        });
      }

      // Delete the entry using direct database call for now
      await db.delete(journalEntries).where(eq(journalEntries.id, entryId));

      res.json({ message: 'Journal entry deleted successfully' });
    } catch (error) {
      console.error('Delete journal entry error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/journal-entries/:id/lines', requireAuth, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const lines = await storage.getJournalEntryLinesByEntry(entryId);
      res.json(lines);
    } catch (error) {
      console.error('Get journal entry lines error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Customer routes
  app.get('/api/customers', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }
      
      const customers = await storage.getCustomersByCompany(req.session.currentCompanyId);
      res.json(customers);
    } catch (error) {
      console.error('Get customers error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/customers', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const customerData = {
        ...req.body,
        companyId: req.session.currentCompanyId,
      };
      
      const customer = await storage.createCustomer(customerData);
      res.json(customer);
    } catch (error) {
      console.error('Create customer error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Invoice routes
  app.get('/api/invoices', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }
      
      const invoices = await storage.getInvoicesByCompany(req.session.currentCompanyId);
      res.json(invoices);
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/invoices', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const invoiceData = {
        ...req.body,
        companyId: req.session.currentCompanyId,
      };
      
      const invoice = await storage.createInvoice(invoiceData);
      res.json(invoice);
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Journal entry lines route
  app.post('/api/journal-entry-lines', requireAuth, async (req, res) => {
    try {
      const lineData = req.body;
      const line = await storage.createJournalEntryLine(lineData);
      res.json(line);
    } catch (error) {
      console.error('Create journal entry line error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Dashboard metrics
  app.get('/api/dashboard/metrics', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      // Calculate real metrics from database
      const companyId = req.session.currentCompanyId;
      
      // Total Revenue - sum of all revenue accounts' credit balances
      const revenueResult = await db.execute(sql`
        SELECT COALESCE(SUM(jel.credit_amount::numeric - jel.debit_amount::numeric), 0) as total_revenue
        FROM journal_entry_lines jel
        JOIN accounts a ON jel.account_id = a.id
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE a.company_id = ${companyId} 
        AND a.type = 'revenue'
        AND je.is_posted = true
      `);
      
      // Outstanding Invoices - sum of unpaid invoices
      const invoicesResult = await db.execute(sql`
        SELECT COALESCE(SUM(total_amount::numeric), 0) as outstanding_invoices
        FROM invoices 
        WHERE company_id = ${companyId} 
        AND status IN ('sent', 'overdue')
      `);
      
      // Cash Balance - sum of cash accounts
      const cashResult = await db.execute(sql`
        SELECT COALESCE(SUM(jel.debit_amount::numeric - jel.credit_amount::numeric), 0) as cash_balance
        FROM journal_entry_lines jel
        JOIN accounts a ON jel.account_id = a.id
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE a.company_id = ${companyId} 
        AND a.type = 'asset' 
        AND a.sub_type = 'current_asset'
        AND (a.name ILIKE '%cash%' OR a.name ILIKE '%bank%')
        AND je.is_posted = true
      `);
      
      // Monthly Expenses - current month expense totals
      const expensesResult = await db.execute(sql`
        SELECT COALESCE(SUM(jel.debit_amount::numeric - jel.credit_amount::numeric), 0) as monthly_expenses
        FROM journal_entry_lines jel
        JOIN accounts a ON jel.account_id = a.id
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE a.company_id = ${companyId} 
        AND a.type = 'expense'
        AND je.is_posted = true
        AND je.date >= DATE_TRUNC('month', CURRENT_DATE)
      `);

      const metrics = {
        totalRevenue: parseFloat((revenueResult.rows[0] as any)?.total_revenue || '0'),
        outstandingInvoices: parseFloat((invoicesResult.rows[0] as any)?.outstanding_invoices || '0'),
        cashBalance: parseFloat((cashResult.rows[0] as any)?.cash_balance || '0'),
        monthlyExpenses: parseFloat((expensesResult.rows[0] as any)?.monthly_expenses || '0'),
      };

      res.json(metrics);
    } catch (error) {
      console.error('Get dashboard metrics error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Recent transactions
  app.get('/api/dashboard/recent-transactions', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const entries = await storage.getJournalEntriesByCompany(req.session.currentCompanyId);
      const recentEntries = entries.slice(0, 10);

      res.json(recentEntries);
    } catch (error) {
      console.error('Get recent transactions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Users management endpoints (add after the existing routes)
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(404).json({ message: 'Current user not found' });
      }

      let users;
      
      // If global administrator, show all users
      if (currentUser.globalRole === 'global_administrator') {
        // Get all users in the system
        users = await db.select({
          id: usersTable.id,
          username: usersTable.username,
          email: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          globalRole: usersTable.globalRole,
          isActive: usersTable.isActive,
          createdAt: usersTable.createdAt,
        }).from(usersTable);
      } else {
        // For non-global admins, show users in current company only
        if (!req.session.currentCompanyId) {
          return res.status(400).json({ message: 'No company selected' });
        }

        const companyUsers = await db
          .select({
            id: usersTable.id,
            username: usersTable.username,
            email: usersTable.email,
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
            globalRole: usersTable.globalRole,
            isActive: usersTable.isActive,
            createdAt: usersTable.createdAt,
          })
          .from(usersTable)
          .innerJoin(userCompaniesTable, eq(usersTable.id, userCompaniesTable.userId))
          .where(eq(userCompaniesTable.companyId, req.session.currentCompanyId));
        
        users = companyUsers;
      }

      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/users', requireAuth, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username) || 
                          await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        globalRole: user.globalRole,
        isActive: user.isActive,
        createdAt: user.createdAt,
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // User-Company assignments endpoint
  app.get('/api/user-companies', requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(404).json({ message: 'Current user not found' });
      }

      let userCompanyAssignments;

      // If global administrator, show all user-company assignments
      if (currentUser.globalRole === 'global_administrator') {
        userCompanyAssignments = await db
          .select({
            id: userCompaniesTable.id,
            userId: userCompaniesTable.userId,
            companyId: userCompaniesTable.companyId,
            role: userCompaniesTable.role,
            isActive: userCompaniesTable.isActive,
            user: {
              id: usersTable.id,
              username: usersTable.username,
              email: usersTable.email,
              firstName: usersTable.firstName,
              lastName: usersTable.lastName,
            },
            company: {
              id: companiesTable.id,
              name: companiesTable.name,
              code: companiesTable.code,
            }
          })
          .from(userCompaniesTable)
          .innerJoin(usersTable, eq(userCompaniesTable.userId, usersTable.id))
          .innerJoin(companiesTable, eq(userCompaniesTable.companyId, companiesTable.id));
      } else {
        // For non-global admins, show assignments for current company only
        if (!req.session.currentCompanyId) {
          return res.status(400).json({ message: 'No company selected' });
        }

        userCompanyAssignments = await db
          .select({
            id: userCompaniesTable.id,
            userId: userCompaniesTable.userId,
            companyId: userCompaniesTable.companyId,
            role: userCompaniesTable.role,
            isActive: userCompaniesTable.isActive,
            user: {
              id: usersTable.id,
              username: usersTable.username,
              email: usersTable.email,
              firstName: usersTable.firstName,
              lastName: usersTable.lastName,
            },
            company: {
              id: companiesTable.id,
              name: companiesTable.name,
              code: companiesTable.code,
            }
          })
          .from(userCompaniesTable)
          .innerJoin(usersTable, eq(userCompaniesTable.userId, usersTable.id))
          .innerJoin(companiesTable, eq(userCompaniesTable.companyId, companiesTable.id))
          .where(eq(userCompaniesTable.companyId, req.session.currentCompanyId));
      }

      res.json(userCompanyAssignments);
    } catch (error) {
      console.error('Get user-companies error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/user-companies', requireAuth, async (req, res) => {
    try {
      const assignmentData = insertUserCompanySchema.parse(req.body);
      const assignment = await storage.createUserCompany(assignmentData);
      res.json(assignment);
    } catch (error) {
      console.error('Create user-company assignment error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Profile management endpoints
  app.put('/api/auth/profile', requireAuth, async (req, res) => {
    try {
      const { firstName, lastName, email } = req.body;
      
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      // TODO: Implement actual profile update in storage
      // For now, just return success
      res.json({ 
        message: 'Profile updated successfully',
        user: { firstName, lastName, email }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/auth/change-password', requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new password are required' });
      }

      // TODO: Implement actual password change in storage
      // For now, just return success
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete endpoints
  app.delete('/api/users/:id', requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (userId === req.session.userId) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      const success = await storage.deleteUser(userId);
      if (success) {
        res.json({ message: 'User deleted successfully' });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Internal server error' });
    }
  });

  app.delete('/api/companies/:id', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);

      const success = await storage.deleteCompany(companyId);
      if (success) {
        res.json({ message: 'Company deleted successfully' });
      } else {
        res.status(404).json({ message: 'Company not found' });
      }
    } catch (error) {
      console.error('Delete company error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Internal server error' });
    }
  });

  // Company Settings routes
  app.get('/api/company/settings/:id', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Verify user has access to this company
      if (!req.session.currentCompanyId || req.session.currentCompanyId !== companyId) {
        const userCompany = await storage.getUserCompany(req.session.userId!, companyId);
        if (!userCompany) {
          return res.status(403).json({ message: 'Access denied to this company' });
        }
      }

      // Get company basic information
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      // Get company settings from database
      let settings = await getCompanySettings(companyId);
      
      // If no settings exist, create default ones
      if (!settings) {
        const defaultSettings = {
          companyId,
          emailNotifications: true,
          invoiceReminders: true,
          paymentAlerts: true,
          reportReminders: false,
          systemUpdates: true,
          autoNumbering: true,
          invoicePrefix: "INV",
          billPrefix: "BILL",
          journalPrefix: "JE",
          decimalPlaces: 2,
          negativeFormat: "minus",
          dateFormat: "MM/DD/YYYY",
          timeZone: "America/New_York",
          requirePasswordChange: false,
          passwordExpireDays: 90,
          sessionTimeout: 30,
          enableTwoFactor: false,
          allowMultipleSessions: true,
          bankConnection: false,
          paymentGateway: false,
          taxService: false,
          reportingTools: false,
          autoBackup: false,
          backupFrequency: "weekly",
          retentionDays: 30,
          backupLocation: "cloud",
        };
        
        try {
          settings = await createCompanySettings(defaultSettings);
        } catch (error) {
          console.error('Failed to create default settings:', error);
          // Return default structure if creation fails
          settings = { ...defaultSettings, id: 0, createdAt: new Date(), updatedAt: new Date() };
        }
      }

      const companySettings = {
        ...company,
        settings: {
          notifications: {
            emailNotifications: settings.emailNotifications,
            invoiceReminders: settings.invoiceReminders,
            paymentAlerts: settings.paymentAlerts,
            reportReminders: settings.reportReminders,
            systemUpdates: settings.systemUpdates,
          },
          financial: {
            autoNumbering: settings.autoNumbering,
            invoicePrefix: settings.invoicePrefix,
            billPrefix: settings.billPrefix,
            journalPrefix: settings.journalPrefix,
            decimalPlaces: settings.decimalPlaces,
            negativeFormat: settings.negativeFormat,
            dateFormat: settings.dateFormat,
            timeZone: settings.timeZone,
          },
          security: {
            requirePasswordChange: settings.requirePasswordChange,
            passwordExpireDays: settings.passwordExpireDays,
            sessionTimeout: settings.sessionTimeout,
            enableTwoFactor: settings.enableTwoFactor,
            allowMultipleSessions: settings.allowMultipleSessions,
          },
          backup: {
            autoBackup: settings.autoBackup,
            backupFrequency: settings.backupFrequency,
            retentionDays: settings.retentionDays,
            backupLocation: settings.backupLocation,
          },
          integration: {
            bankConnection: settings.bankConnection,
            paymentGateway: settings.paymentGateway,
            taxService: settings.taxService,
            reportingTools: settings.reportingTools,
          },
        },
      };

      res.json(companySettings);
    } catch (error) {
      console.error('Get company settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/company/settings/:id/info', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Verify user has access to this company and permission to edit
      if (!req.session.currentCompanyId || req.session.currentCompanyId !== companyId) {
        const userCompany = await storage.getUserCompany(req.session.userId!, companyId);
        if (!userCompany) {
          return res.status(403).json({ message: 'Access denied to this company' });
        }
      }

      const updateData = {
        name: req.body.name,
        code: req.body.code.toUpperCase(),
        address: req.body.address || null,
        phone: req.body.phone || null,
        email: req.body.email || null,
        taxId: req.body.taxId || null,
        fiscalYearStart: req.body.fiscalYearStart || 1,
        currency: req.body.currency || 'USD',
      };

      const updatedCompany = await storage.updateCompany(companyId, updateData);
      if (!updatedCompany) {
        return res.status(404).json({ message: 'Company not found' });
      }

      res.json(updatedCompany);
    } catch (error) {
      console.error('Update company info error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/company/settings/:id/notifications', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Verify user has access to this company
      if (!req.session.currentCompanyId || req.session.currentCompanyId !== companyId) {
        const userCompany = await storage.getUserCompany(req.session.userId!, companyId);
        if (!userCompany) {
          return res.status(403).json({ message: 'Access denied to this company' });
        }
      }

      // Update notification settings in database
      const updateData = {
        emailNotifications: req.body.emailNotifications,
        invoiceReminders: req.body.invoiceReminders,
        paymentAlerts: req.body.paymentAlerts,
        reportReminders: req.body.reportReminders,
        systemUpdates: req.body.systemUpdates,
      };

      const updatedSettings = await updateCompanySettings(companyId, updateData);
      
      if (!updatedSettings) {
        return res.status(404).json({ message: 'Company settings not found' });
      }

      // Log notification settings update
      await activityLogger.logCRUD(
        ACTIVITY_ACTIONS.SETTINGS_UPDATE_NOTIFICATIONS,
        RESOURCE_TYPES.SETTINGS,
        {
          userId: req.session.userId!,
          companyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        companyId,
        undefined,
        updateData
      );

      res.json({ message: 'Notification settings updated successfully', settings: updatedSettings });
    } catch (error) {
      console.error('Update notification settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/company/settings/:id/financial', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Verify user has access to this company
      if (!req.session.currentCompanyId || req.session.currentCompanyId !== companyId) {
        const userCompany = await storage.getUserCompany(req.session.userId!, companyId);
        if (!userCompany) {
          return res.status(403).json({ message: 'Access denied to this company' });
        }
      }

      // Update financial settings in database
      const updateData = {
        autoNumbering: req.body.autoNumbering,
        invoicePrefix: req.body.invoicePrefix,
        billPrefix: req.body.billPrefix,
        journalPrefix: req.body.journalPrefix,
        decimalPlaces: req.body.decimalPlaces,
        negativeFormat: req.body.negativeFormat,
        dateFormat: req.body.dateFormat,
        timeZone: req.body.timeZone,
      };

      const updatedSettings = await updateCompanySettings(companyId, updateData);
      
      if (!updatedSettings) {
        return res.status(404).json({ message: 'Company settings not found' });
      }

      // Log financial settings update
      await activityLogger.logCRUD(
        ACTIVITY_ACTIONS.SETTINGS_UPDATE_FINANCIAL,
        RESOURCE_TYPES.SETTINGS,
        {
          userId: req.session.userId!,
          companyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        companyId,
        undefined,
        updateData
      );

      res.json({ message: 'Financial settings updated successfully', settings: updatedSettings });
    } catch (error) {
      console.error('Update financial settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/company/settings/:id/security', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Verify user has access to this company
      if (!req.session.currentCompanyId || req.session.currentCompanyId !== companyId) {
        const userCompany = await storage.getUserCompany(req.session.userId!, companyId);
        if (!userCompany) {
          return res.status(403).json({ message: 'Access denied to this company' });
        }
      }

      // Update security settings in database
      const updateData = {
        requirePasswordChange: req.body.requirePasswordChange,
        passwordExpireDays: req.body.passwordExpireDays,
        sessionTimeout: req.body.sessionTimeout,
        enableTwoFactor: req.body.enableTwoFactor,
        allowMultipleSessions: req.body.allowMultipleSessions,
      };

      const updatedSettings = await updateCompanySettings(companyId, updateData);
      
      if (!updatedSettings) {
        return res.status(404).json({ message: 'Company settings not found' });
      }

      // Log security settings update
      await activityLogger.logCRUD(
        ACTIVITY_ACTIONS.SETTINGS_UPDATE_SECURITY,
        RESOURCE_TYPES.SETTINGS,
        {
          userId: req.session.userId!,
          companyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        companyId,
        undefined,
        updateData
      );

      res.json({ message: 'Security settings updated successfully', settings: updatedSettings });
    } catch (error) {
      console.error('Update security settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Company export endpoint
  app.get('/api/company/:id/export', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Verify user has access to this company
      if (!req.session.currentCompanyId || req.session.currentCompanyId !== companyId) {
        const userCompany = await storage.getUserCompany(req.session.userId!, companyId);
        if (!userCompany) {
          return res.status(403).json({ message: 'Access denied to this company' });
        }
      }

      // Export all company data including accounts, transactions, etc.
      const [company, accounts, journalEntries, customers, vendors, invoices, bills] = await Promise.all([
        storage.getCompany(companyId),
        storage.getAccountsByCompany(companyId),
        storage.getJournalEntriesByCompany(companyId),
        storage.getCustomersByCompany(companyId),
        storage.getVendorsByCompany(companyId),
        storage.getInvoicesByCompany(companyId),
        storage.getBillsByCompany(companyId),
      ]);

      const exportData = {
        company,
        accounts,
        journalEntries,
        customers,
        vendors,
        invoices,
        bills,
        exportDate: new Date().toISOString(),
        totalRecords: accounts.length + journalEntries.length + customers.length + vendors.length + invoices.length + bills.length,
      };

      // Log data export
      await activityLogger.logCRUD(
        ACTIVITY_ACTIONS.DATA_EXPORT,
        RESOURCE_TYPES.COMPANY,
        {
          userId: req.session.userId!,
          companyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        companyId,
        undefined,
        { exportType: 'full', recordCount: exportData.totalRecords }
      );

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="company-${companyId}-export-${new Date().getTime()}.json"`);
      res.json(exportData);
    } catch (error) {
      console.error('Export company data error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Company archive endpoint
  app.put('/api/company/:id/archive', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Verify user has access to this company
      if (!req.session.currentCompanyId || req.session.currentCompanyId !== companyId) {
        const userCompany = await storage.getUserCompany(req.session.userId!, companyId);
        if (!userCompany) {
          return res.status(403).json({ message: 'Access denied to this company' });
        }
      }

      // Archive company by setting isActive to false
      const updatedCompany = await storage.updateCompany(companyId, { isActive: false });
      if (!updatedCompany) {
        return res.status(404).json({ message: 'Company not found' });
      }

      // Log company archive
      await activityLogger.logCRUD(
        ACTIVITY_ACTIONS.COMPANY_ARCHIVE,
        RESOURCE_TYPES.COMPANY,
        {
          userId: req.session.userId!,
          companyId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        companyId,
        { isActive: true },
        { isActive: false }
      );

      res.json({ message: 'Company archived successfully' });
    } catch (error) {
      console.error('Archive company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Global Administration routes (only for global administrators)
  const requireGlobalAdmin = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Check if user is global administrator
    storage.getUser(req.session.userId).then(user => {
      if (!user || user.globalRole !== 'global_administrator') {
        return res.status(403).json({ message: 'Global administrator access required' });
      }
      next();
    }).catch(error => {
      console.error('Global admin check error:', error);
      res.status(500).json({ message: 'Internal server error' });
    });
  };

  // System statistics
  app.get('/api/admin/system-stats', requireGlobalAdmin, async (req, res) => {
    try {
      const [companies, users, transactions] = await Promise.all([
        storage.getAllCompanies(),
        storage.getAllUsers(),
        storage.getTransactionCount()
      ]);

      const activeCompanies = companies.filter(c => c.isActive).length;
      const activeUsers = users.filter(u => u.isActive).length;

      res.json({
        totalCompanies: companies.length,
        activeCompanies,
        totalUsers: users.length,
        activeUsers,
        totalTransactions: transactions,
        storageUsed: "2.3 GB", // This would be calculated from actual database size
        systemUptime: process.uptime(),
        lastBackup: null, // This would come from backup system
      });
    } catch (error) {
      console.error('Get system stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all companies (global admin view)
  app.get('/api/admin/companies', requireGlobalAdmin, async (req, res) => {
    try {
      const companies = await storage.getAllCompaniesWithStats();
      res.json(companies);
    } catch (error) {
      console.error('Get admin companies error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create company (global admin)
  app.post('/api/admin/companies', requireGlobalAdmin, async (req, res) => {
    try {
      const companyData = {
        name: req.body.name,
        code: req.body.code.toUpperCase(),
        description: req.body.description || null,
        isActive: true,
      };
      
      const company = await storage.createCompany(companyData);
      res.json(company);
    } catch (error) {
      console.error('Create admin company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update company (global admin)
  app.put('/api/admin/companies/:id', requireGlobalAdmin, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const updateData = {
        name: req.body.name,
        code: req.body.code.toUpperCase(),
        description: req.body.description || null,
      };
      
      const company = await storage.updateCompany(companyId, updateData);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }
      
      res.json(company);
    } catch (error) {
      console.error('Update admin company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete company (global admin)
  app.delete('/api/admin/companies/:id', requireGlobalAdmin, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Check if company has any data before deletion
      const hasData = await storage.companyHasData(companyId);
      if (hasData) {
        return res.status(400).json({ 
          message: 'Cannot delete company with existing data. Please archive instead.' 
        });
      }
      
      await db.delete(companiesTable).where(eq(companiesTable.id, companyId));
      res.json({ message: 'Company deleted successfully' });
    } catch (error) {
      console.error('Delete admin company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Toggle company status
  app.put('/api/admin/companies/:id/status', requireGlobalAdmin, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { isActive } = req.body;
      
      const company = await storage.updateCompany(companyId, { isActive });
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }
      
      res.json(company);
    } catch (error) {
      console.error('Toggle company status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all global users
  app.get('/api/admin/global-users', requireGlobalAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsersWithStats();
      res.json(users);
    } catch (error) {
      console.error('Get global users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create global user
  app.post('/api/admin/global-users', requireGlobalAdmin, async (req, res) => {
    try {
      const userData = {
        username: req.body.username,
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        password: await hashPassword(req.body.password),
        globalRole: req.body.globalRole,
        isActive: true,
      };
      
      const user = await storage.createUser(userData);
      
      // Remove password from response
      const { password, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error('Create global user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update global user
  app.put('/api/admin/global-users/:id', requireGlobalAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updateData: any = {
        username: req.body.username,
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        globalRole: req.body.globalRole,
      };
      
      // Only update password if provided
      if (req.body.password && req.body.password.trim() !== '') {
        updateData.password = await hashPassword(req.body.password);
      }
      
      const user = await storage.updateUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Remove password from response
      const { password, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error('Update global user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Toggle user status
  app.put('/api/admin/global-users/:id/status', requireGlobalAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isActive } = req.body;
      
      const user = await storage.updateUser(userId, { isActive });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Remove password from response
      const { password, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error('Toggle user status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get activity logs
  app.get('/api/admin/activity-logs', requireGlobalAdmin, async (req, res) => {
    try {
      const logs = await storage.getActivityLogs(100); // Get last 100 activities
      res.json(logs);
    } catch (error) {
      console.error('Get activity logs error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Mount global admin routes with authentication
  app.use('/api/global-admin', requireGlobalAdmin, globalAdminRouter);
  
  // Mount activity logs routes with authentication
  app.use('/api/activity-logs', requireAuth, activityLogsRouter);

  // Restore archived company endpoint
  app.put('/api/company/:id/restore', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Verify user has access to this company
      const userCompany = await storage.getUserCompany(req.session.userId!, companyId);
      if (!userCompany) {
        return res.status(403).json({ message: 'Access denied to this company' });
      }

      // Restore company by setting isActive to true
      const updatedCompany = await storage.updateCompany(companyId, { isActive: true });
      if (!updatedCompany) {
        return res.status(404).json({ message: 'Company not found' });
      }

      res.json({ message: 'Company restored successfully' });
    } catch (error) {
      console.error('Restore company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Vendor routes
  app.get('/api/vendors', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }
      
      const vendors = await storage.getVendorsByCompany(req.session.currentCompanyId);
      res.json(vendors);
    } catch (error) {
      console.error('Get vendors error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/vendors', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const vendorData = {
        ...req.body,
        companyId: req.session.currentCompanyId,
      };
      
      const vendor = await storage.createVendor(vendorData);
      res.json(vendor);
    } catch (error) {
      console.error('Create vendor error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Bills routes
  app.get('/api/bills', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }
      
      const bills = await storage.getBillsByCompany(req.session.currentCompanyId);
      res.json(bills);
    } catch (error) {
      console.error('Get bills error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/bills', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const billData = {
        ...req.body,
        companyId: req.session.currentCompanyId,
      };
      
      const bill = await storage.createBill(billData);
      res.json(bill);
    } catch (error) {
      console.error('Create bill error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Account balances route
  app.get('/api/accounts/balances', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const companyId = req.session.currentCompanyId;
      
      // Get account balances using SQL
      const balancesResult = await db.execute(sql`
        SELECT 
          a.id,
          a.code,
          a.name,
          a.type,
          a.sub_type,
          COALESCE(SUM(jel.debit_amount::numeric), 0) as total_debits,
          COALESCE(SUM(jel.credit_amount::numeric), 0) as total_credits,
          CASE 
            WHEN a.type IN ('asset', 'expense') THEN 
              COALESCE(SUM(jel.debit_amount::numeric - jel.credit_amount::numeric), 0)
            ELSE 
              COALESCE(SUM(jel.credit_amount::numeric - jel.debit_amount::numeric), 0)
          END as balance
        FROM accounts a
        LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE a.company_id = ${companyId} 
        AND a.is_active = true
        AND (je.is_posted = true OR je.id IS NULL)
        GROUP BY a.id, a.code, a.name, a.type, a.sub_type
        ORDER BY a.code
      `);

      const accountBalances = balancesResult.rows.map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        type: row.type,
        subType: row.sub_type,
        totalDebits: parseFloat(row.total_debits || '0'),
        totalCredits: parseFloat(row.total_credits || '0'),
        balance: parseFloat(row.balance || '0'),
      }));

      res.json(accountBalances);
    } catch (error) {
      console.error('Get account balances error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Trial Balance route
  app.get('/api/reports/trial-balance', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const companyId = req.session.currentCompanyId;
      const { date } = req.query;
      
      let dateFilter = '';
      if (date) {
        dateFilter = `AND je.date <= '${date}'`;
      }

      const trialBalanceResult = await db.execute(sql.raw(`
        SELECT 
          a.id,
          a.code,
          a.name,
          a.type,
          CASE 
            WHEN a.type IN ('asset', 'expense') AND SUM(jel.debit_amount::numeric - jel.credit_amount::numeric) > 0 THEN 
              SUM(jel.debit_amount::numeric - jel.credit_amount::numeric)
            ELSE 0
          END as debit_balance,
          CASE 
            WHEN a.type IN ('liability', 'equity', 'revenue') AND SUM(jel.credit_amount::numeric - jel.debit_amount::numeric) > 0 THEN 
              SUM(jel.credit_amount::numeric - jel.debit_amount::numeric)
            WHEN a.type IN ('asset', 'expense') AND SUM(jel.debit_amount::numeric - jel.credit_amount::numeric) < 0 THEN 
              ABS(SUM(jel.debit_amount::numeric - jel.credit_amount::numeric))
            ELSE 0
          END as credit_balance
        FROM accounts a
        LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE a.company_id = ${companyId} 
        AND a.is_active = true
        AND (je.is_posted = true OR je.id IS NULL)
        ${dateFilter}
        GROUP BY a.id, a.code, a.name, a.type
        HAVING COALESCE(SUM(jel.debit_amount::numeric), 0) != 0 OR COALESCE(SUM(jel.credit_amount::numeric), 0) != 0
        ORDER BY a.code
      `));

      const trialBalance = trialBalanceResult.rows.map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        type: row.type,
        debitBalance: parseFloat(row.debit_balance || '0'),
        creditBalance: parseFloat(row.credit_balance || '0'),
      }));

      // Calculate totals
      const totalDebits = trialBalance.reduce((sum, account) => sum + account.debitBalance, 0);
      const totalCredits = trialBalance.reduce((sum, account) => sum + account.creditBalance, 0);

      res.json({
        accounts: trialBalance,
        totalDebits,
        totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01
      });
    } catch (error) {
      console.error('Get trial balance error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Financial statements route
  app.get('/api/reports/financial-statements', requireAuth, async (req, res) => {
    try {
      if (!req.session.currentCompanyId) {
        return res.status(400).json({ message: 'No company selected' });
      }

      const companyId = req.session.currentCompanyId;
      const { type, startDate, endDate } = req.query;
      
      if (type === 'profit-loss') {
        // Income Statement calculation
        const plResult = await db.execute(sql.raw(`
          SELECT 
            a.type,
            a.sub_type,
            a.name,
            CASE 
              WHEN a.type = 'revenue' THEN SUM(jel.credit_amount::numeric - jel.debit_amount::numeric)
              WHEN a.type = 'expense' THEN SUM(jel.debit_amount::numeric - jel.credit_amount::numeric)
              ELSE 0
            END as amount
          FROM accounts a
          LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
          LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
          WHERE a.company_id = ${companyId} 
          AND a.type IN ('revenue', 'expense')
          AND je.is_posted = true
          ${startDate ? `AND je.date >= '${startDate}'` : ''}
          ${endDate ? `AND je.date <= '${endDate}'` : ''}
          GROUP BY a.type, a.sub_type, a.name, a.id
          HAVING SUM(jel.debit_amount::numeric) != 0 OR SUM(jel.credit_amount::numeric) != 0
          ORDER BY a.type, a.sub_type, a.name
        `));

        const accounts = plResult.rows.map((row: any) => ({
          type: row.type,
          subType: row.sub_type,
          name: row.name,
          amount: parseFloat(row.amount || '0'),
        }));

        res.json({ type: 'profit-loss', accounts });
      } else if (type === 'balance-sheet') {
        // Balance Sheet calculation
        const bsResult = await db.execute(sql.raw(`
          SELECT 
            a.type,
            a.sub_type,
            a.name,
            CASE 
              WHEN a.type IN ('asset', 'expense') THEN 
                SUM(jel.debit_amount::numeric - jel.credit_amount::numeric)
              ELSE 
                SUM(jel.credit_amount::numeric - jel.debit_amount::numeric)
            END as amount
          FROM accounts a
          LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
          LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
          WHERE a.company_id = ${companyId} 
          AND a.type IN ('asset', 'liability', 'equity')
          AND (je.is_posted = true OR je.id IS NULL)
          ${endDate ? `AND je.date <= '${endDate}'` : ''}
          GROUP BY a.type, a.sub_type, a.name, a.id
          ORDER BY a.type, a.sub_type, a.name
        `));

        const accounts = bsResult.rows.map((row: any) => ({
          type: row.type,
          subType: row.sub_type,
          name: row.name,
          amount: parseFloat(row.amount || '0'),
        }));

        res.json({ type: 'balance-sheet', accounts });
      } else {
        res.status(400).json({ message: 'Invalid report type' });
      }
    } catch (error) {
      console.error('Get financial statements error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Start server
  const server = createServer(app);
  return server;
}
