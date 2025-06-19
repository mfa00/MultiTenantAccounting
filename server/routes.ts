import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { authenticateUser, hashPassword, getUserWithCompanies } from "./auth";
import { insertUserSchema, insertCompanySchema, insertAccountSchema, insertJournalEntrySchema, insertUserCompanySchema, users as usersTable, userCompanies as userCompaniesTable, companies as companiesTable, accounts, activityLogs } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "./db";
import globalAdminRouter from "./api/global-admin";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    currentCompanyId?: number;
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
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      req.session.userId = user.id;
      
      const userWithCompanies = await getUserWithCompanies(user.id);
      if (userWithCompanies && userWithCompanies.companies.length > 0) {
        req.session.currentCompanyId = userWithCompanies.companies[0].id;
      }

      res.json(userWithCompanies);
    } catch (error) {
      console.error('Login error:', error);
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
      res.json(account);
    } catch (error) {
      console.error('Create account error:', error);
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

      // For now, return mock data - in production, calculate from actual transactions
      const metrics = {
        totalRevenue: 125430,
        outstandingInvoices: 28940,
        cashBalance: 45120,
        monthlyExpenses: 18560,
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

      // TODO: Implement actual user deletion in storage
      // For now, just return success
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/companies/:id', requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);

      // TODO: Implement actual company deletion in storage
      // For now, just return success
      res.json({ message: 'Company deleted successfully' });
    } catch (error) {
      console.error('Delete company error:', error);
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
      
      await storage.deleteCompany(companyId);
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

  // Mount global admin routes
  app.use('/api/global-admin', globalAdminRouter);

  const httpServer = createServer(app);
  return httpServer;
}
