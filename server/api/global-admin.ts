// Global Administration API Routes
import express from "express";
import { db } from "../db";
import { sql, eq, desc, and, or } from "drizzle-orm";
import { 
  users, companies, userCompanies, accounts, activityLogs,
  type User, type Company, type UserCompany 
} from "../../shared/schema";

const router = express.Router();

// Get all users with their company assignments
router.get("/users", async (req, res) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        globalRole: users.globalRole,
        isActive: users.isActive,
        createdAt: users.createdAt,
        // lastLogin field doesn't exist in schema yet
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // Get company assignments for each user
    const usersWithCompanies = await Promise.all(
      allUsers.map(async (user) => {
        const companyAssignments = await db
          .select({
            companyId: companies.id,
            companyName: companies.name,
            companyCode: companies.code,
            role: userCompanies.role,
            isActive: userCompanies.isActive,
            assignedAt: userCompanies.createdAt
          })
          .from(userCompanies)
          .innerJoin(companies, eq(userCompanies.companyId, companies.id))
          .where(eq(userCompanies.userId, user.id))
          .orderBy(companies.name);

        return {
          ...user,
          companies: companyAssignments
        };
      })
    );

    res.json(usersWithCompanies);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get all companies with user counts
router.get("/companies", async (req, res) => {
  try {
    const companiesWithStats = await db
      .select({
        id: companies.id,
        name: companies.name,
        code: companies.code,
        address: companies.address,
        phone: companies.phone,
        email: companies.email,
        taxId: companies.taxId,
        fiscalYearStart: companies.fiscalYearStart,
        currency: companies.currency,
        isActive: companies.isActive,
        createdAt: companies.createdAt,
        userCount: sql<number>`count(${userCompanies.userId})::int`,
        activeUserCount: sql<number>`count(case when ${userCompanies.isActive} then 1 end)::int`
      })
      .from(companies)
      .leftJoin(userCompanies, eq(companies.id, userCompanies.companyId))
      .groupBy(companies.id)
      .orderBy(companies.name);

    res.json(companiesWithStats);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ error: "Failed to fetch companies" });
  }
});

// Get user-company assignments with details
router.get("/user-assignments", async (req, res) => {
  try {
    const assignments = await db
      .select({
        id: userCompanies.id,
        userId: users.id,
        username: users.username,
        userEmail: users.email,
        userFullName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        companyId: companies.id,
        companyName: companies.name,
        companyCode: companies.code,
        role: userCompanies.role,
        isActive: userCompanies.isActive,
        createdAt: userCompanies.createdAt,
        // updatedAt field doesn't exist in user_companies schema
      })
      .from(userCompanies)
      .innerJoin(users, eq(userCompanies.userId, users.id))
      .innerJoin(companies, eq(userCompanies.companyId, companies.id))
      .orderBy(companies.name, users.username);

    res.json(assignments);
  } catch (error) {
    console.error("Error fetching user assignments:", error);
    res.status(500).json({ error: "Failed to fetch user assignments" });
  }
});

// Create new company
router.post("/companies", async (req, res) => {
  try {
    const { name, code, address, phone, email, taxId, fiscalYearStart, currency } = req.body;

    // Validate required fields
    if (!name || !code) {
      return res.status(400).json({ error: "Company name and code are required" });
    }

    // Check if company code already exists
    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.code, code))
      .limit(1);

    if (existingCompany.length > 0) {
      return res.status(400).json({ error: "Company code already exists" });
    }

    const newCompany = await db
      .insert(companies)
      .values({
        name,
        code,
        address,
        phone,
        email,
        taxId,
        fiscalYearStart: fiscalYearStart || 1,
        currency: currency || 'USD',
        isActive: true
      })
      .returning();

    // Get the current user ID from session (this should be available from the requireGlobalAdmin middleware)
    const currentUserId = (req as any).session?.userId;
    
    if (currentUserId) {
      // Automatically assign the global administrator as an administrator of the new company
      try {
        await db.insert(userCompanies).values({
          userId: currentUserId,
          companyId: newCompany[0].id,
          role: 'administrator',
          isActive: true
        });
        
        console.log(`Auto-assigned global admin (user ${currentUserId}) to company ${newCompany[0].id} as administrator`);
      } catch (assignmentError) {
        console.error('Failed to auto-assign user to company:', assignmentError);
        // Don't fail the company creation if assignment fails
      }

      // Log the activity
      try {
        await db.insert(activityLogs).values({
          userId: currentUserId,
          action: "CREATE_COMPANY",
          resource: "COMPANY",
          resourceId: newCompany[0].id,
          details: `Created company: ${name} (${code})`,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "Unknown"
        });
      } catch (logError) {
        console.error('Failed to log activity:', logError);
        // Don't fail the operation if logging fails
      }
    } else {
      console.warn('No user ID in session during company creation');
    }

    res.status(201).json(newCompany[0]);
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ error: "Failed to create company" });
  }
});

// Assign user to company
router.post("/assign-user", async (req, res) => {
  try {
    const { userId, companyId, role } = req.body;

    if (!userId || !companyId || !role) {
      return res.status(400).json({ error: "User ID, Company ID, and role are required" });
    }

    // Check if assignment already exists
    const existingAssignment = await db
      .select()
      .from(userCompanies)
      .where(and(
        eq(userCompanies.userId, userId),
        eq(userCompanies.companyId, companyId)
      ))
      .limit(1);

    if (existingAssignment.length > 0) {
      return res.status(400).json({ error: "User is already assigned to this company" });
    }

    const assignment = await db
      .insert(userCompanies)
      .values({
        userId,
        companyId,
        role,
        isActive: true
      })
      .returning();

    // Log the activity
    // const currentUserId = req.user?.id; // TODO: Add user authentication middleware
    const currentUserId = null; // Placeholder until auth is implemented
    if (currentUserId) {
      const userDetails = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      const companyDetails = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      await db.insert(activityLogs).values({
        userId: currentUserId,
        action: "ASSIGN_USER",
        resource: "USER_COMPANY",
        resourceId: assignment[0].id,
        details: `Assigned ${userDetails[0]?.username} to ${companyDetails[0]?.name} as ${role}`,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || "Unknown"
      });
    }

    res.status(201).json(assignment[0]);
  } catch (error) {
    console.error("Error assigning user:", error);
    res.status(500).json({ error: "Failed to assign user to company" });
  }
});

// Get system statistics
router.get("/stats", async (req, res) => {
  try {
    // Get basic stats (these tables should always exist)
    const basicStats = await Promise.all([
      // Total users
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      
      // Active users
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.isActive, true)),
      
      // Total companies
      db.select({ count: sql<number>`count(*)::int` }).from(companies),
      
      // Active companies
      db.select({ count: sql<number>`count(*)::int` }).from(companies).where(eq(companies.isActive, true)),
      
      // Total user-company assignments
      db.select({ count: sql<number>`count(*)::int` }).from(userCompanies),
      
      // Active assignments
      db.select({ count: sql<number>`count(*)::int` }).from(userCompanies).where(eq(userCompanies.isActive, true)),
      
      // Total accounts
      db.select({ count: sql<number>`count(*)::int` }).from(accounts)
    ]);

    // Try to get activity logs count, but don't fail if table doesn't exist
    let recentActivityCount = 0;
    try {
      const activityResult = await db.select({ count: sql<number>`count(*)::int` }).from(activityLogs)
        .where(sql`timestamp >= NOW() - INTERVAL '24 hours'`);
      recentActivityCount = activityResult[0].count;
    } catch (activityError: any) {
      console.warn("activity_logs table not found, setting recent activity to 0:", activityError.message);
      recentActivityCount = 0;
    }

    const systemStats = {
      totalUsers: basicStats[1][0].count,
      activeUsers: basicStats[1][0].count,
      totalCompanies: basicStats[2][0].count,
      activeCompanies: basicStats[3][0].count,
      totalTransactions: recentActivityCount,
      storageUsed: "2.3 GB",
      systemUptime: "15 days, 3 hours",
      lastBackup: "2024-01-20T02:00:00Z"
    };

    res.json(systemStats);
  } catch (error) {
    console.error("Error fetching system stats:", error);
    res.status(500).json({ error: "Failed to fetch system statistics" });
  }
});

// Get recent activity logs
router.get("/activity", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
      const activities = await db
        .select({
          id: activityLogs.id,
          action: activityLogs.action,
          resource: activityLogs.resource,
          resourceId: activityLogs.resourceId,
          details: activityLogs.details,
          timestamp: activityLogs.timestamp,
          ipAddress: activityLogs.ipAddress,
          userId: activityLogs.userId,
          userName: sql<string>`COALESCE(${users.username}, 'Unknown User')`,
        })
        .from(activityLogs)
        .leftJoin(users, eq(activityLogs.userId, users.id))
        .orderBy(desc(activityLogs.timestamp))
        .limit(limit)
        .offset(offset);

      res.json(activities);
    } catch (activityError: any) {
      if (activityError.message.includes('relation "activity_logs" does not exist')) {
        console.warn("activity_logs table not found, returning empty array");
        // Return empty array if table doesn't exist
        res.json([]);
      } else {
        throw activityError;
      }
    }
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

// Update company
router.put("/companies/:id", async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const { name, code, address } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: "Name and code are required" });
    }

    // Check if code already exists (excluding current company)
    const existingCompany = await db
      .select()
      .from(companies)
      .where(and(
        eq(companies.code, code.toUpperCase()),
        sql`id != ${companyId}`
      ))
      .limit(1);

    if (existingCompany.length > 0) {
      return res.status(400).json({ error: "Company code already exists" });
    }

    const updatedCompany = await db
      .update(companies)
      .set({
        name,
        code: code.toUpperCase(),
        address: address || null
      })
      .where(eq(companies.id, companyId))
      .returning();

    if (updatedCompany.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(updatedCompany[0]);
  } catch (error) {
    console.error("Error updating company:", error);
    res.status(500).json({ error: "Failed to update company" });
  }
});

// Delete company
router.delete("/companies/:id", async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);

    // Check if company has users assigned
    const assignedUsers = await db
      .select()
      .from(userCompanies)
      .where(eq(userCompanies.companyId, companyId))
      .limit(1);

    if (assignedUsers.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete company with assigned users. Please remove all user assignments first." 
      });
    }

    // Check if company has accounts or transactions
    const hasAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.companyId, companyId))
      .limit(1);

    if (hasAccounts.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete company with existing accounts. Please archive the company instead." 
      });
    }

    const deletedCompany = await db
      .delete(companies)
      .where(eq(companies.id, companyId))
      .returning();

    if (deletedCompany.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json({ message: "Company deleted successfully" });
  } catch (error) {
    console.error("Error deleting company:", error);
    res.status(500).json({ error: "Failed to delete company" });
  }
});

// Update user
router.put("/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, email, firstName, lastName, globalRole, password } = req.body;

    if (!username || !email || !firstName || !lastName || !globalRole) {
      return res.status(400).json({ error: "All fields except password are required" });
    }

    // Check if username/email already exists (excluding current user)
    const existingUser = await db
      .select()
      .from(users)
      .where(and(
        or(
          eq(users.username, username),
          eq(users.email, email)
        ),
        sql`id != ${userId}`
      ))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Username or email already exists" });
    }

    const updateData: any = {
      username,
      email,
      firstName,
      lastName,
      globalRole
    };

    // Only update password if provided
    if (password && password.trim() !== '') {
      const bcrypt = await import('bcrypt');
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove password from response
    const { password: _, ...userResponse } = updatedUser[0];
    res.json(userResponse);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Check if user has company assignments
    const assignments = await db
      .select()
      .from(userCompanies)
      .where(eq(userCompanies.userId, userId))
      .limit(1);

    if (assignments.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete user with company assignments. Please remove all assignments first." 
      });
    }

    const deletedUser = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();

    if (deletedUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Update user status
router.put("/users/:id/status", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: "isActive must be a boolean" });
    }

    const updatedUser = await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, userId))
      .returning();

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove password from response
    const { password: _, ...userResponse } = updatedUser[0];
    res.json(userResponse);
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// Update company status
router.put("/companies/:id/status", async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: "isActive must be a boolean" });
    }

    const updatedCompany = await db
      .update(companies)
      .set({ isActive })
      .where(eq(companies.id, companyId))
      .returning();

    if (updatedCompany.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(updatedCompany[0]);
  } catch (error) {
    console.error("Error updating company status:", error);
    res.status(500).json({ error: "Failed to update company status" });
  }
});

export default router; 