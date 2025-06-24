// Global Administration API Routes
import express from "express";
import { db } from "../db";
import { sql, eq, desc, and, or } from "drizzle-orm";
import { 
  users, companies, userCompanies, accounts, activityLogs,
  type User, type Company, type UserCompany 
} from "../../shared/schema";
import { activityLogger, ACTIVITY_ACTIONS, RESOURCE_TYPES } from "../services/activity-logger";

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

// Get users for a specific company
router.get("/companies/:companyId/users", async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    
    if (isNaN(companyId)) {
      return res.status(400).json({ error: "Invalid company ID" });
    }

    // Check if company exists
    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (company.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Get all users assigned to this company
    const companyUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: userCompanies.role,
        isActive: userCompanies.isActive,
        lastLogin: sql<string>`NULL`, // TODO: Add lastLogin field to users table
        joinedAt: userCompanies.createdAt,
        assignmentId: userCompanies.id, // Include assignment ID for editing/deleting
      })
      .from(userCompanies)
      .innerJoin(users, eq(userCompanies.userId, users.id))
      .where(eq(userCompanies.companyId, companyId))
      .orderBy(users.firstName, users.lastName);

    res.json(companyUsers);
  } catch (error) {
    console.error("Error fetching company users:", error);
    res.status(500).json({ error: "Failed to fetch company users" });
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
        
        // Log the assignment activity
        await activityLogger.logCRUD(
          ACTIVITY_ACTIONS.USER_ASSIGN,
          RESOURCE_TYPES.USER_COMPANY,
          {
            userId: currentUserId,
            companyId: newCompany[0].id,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent")
          },
          undefined,
          undefined,
          {
            userId: currentUserId,
            companyId: newCompany[0].id,
            role: 'administrator',
            autoAssigned: true
          }
        );
      } catch (assignmentError) {
        console.error('Failed to auto-assign user to company:', assignmentError);
        await activityLogger.logError(
          ACTIVITY_ACTIONS.USER_ASSIGN,
          RESOURCE_TYPES.USER_COMPANY,
          {
            userId: currentUserId,
            companyId: newCompany[0].id,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent")
          },
          assignmentError as Error,
          newCompany[0].id,
          { autoAssignment: true }
        );
      }

      // Log the company creation activity
      await activityLogger.logCRUD(
        ACTIVITY_ACTIONS.COMPANY_CREATE,
        RESOURCE_TYPES.COMPANY,
        {
          userId: currentUserId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        newCompany[0].id,
        undefined,
        {
          name,
          code,
          address,
          phone,
          email,
          taxId,
          fiscalYearStart,
          currency
        }
      );
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
  const companyId = parseInt(req.params.id);
  
  try {
    console.log("Delete company request received for ID:", req.params.id);

    if (isNaN(companyId)) {
      console.log("Invalid company ID:", req.params.id);
      return res.status(400).json({ error: "Invalid company ID" });
    }

    console.log("Checking for assigned users...");
    // Check if company has users assigned
    const assignedUsers = await db
      .select()
      .from(userCompanies)
      .where(eq(userCompanies.companyId, companyId))
      .limit(1);

    if (assignedUsers.length > 0) {
      console.log("Company has assigned users, cannot delete");
      return res.status(400).json({ 
        error: "Cannot delete company with assigned users. Please remove all user assignments first." 
      });
    }

    console.log("Checking for existing accounts...");
    // Check if company has accounts or transactions
    const hasAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.companyId, companyId))
      .limit(1);

    if (hasAccounts.length > 0) {
      console.log("Company has existing accounts, cannot delete");
      return res.status(400).json({ 
        error: "Cannot delete company with existing accounts. Please archive the company instead." 
      });
    }

    console.log("Proceeding with company deletion...");
    const deletedCompany = await db
      .delete(companies)
      .where(eq(companies.id, companyId))
      .returning();

    if (deletedCompany.length === 0) {
      console.log("Company not found for deletion");
      return res.status(404).json({ error: "Company not found" });
    }

    console.log("Company deleted successfully:", deletedCompany[0]);

    // Log the deletion activity
    try {
      await activityLogger.logCRUD(
        ACTIVITY_ACTIONS.COMPANY_DELETE,
        RESOURCE_TYPES.COMPANY,
        {
          userId: (req as any).session?.userId || 0,
          companyId: undefined, // Company is deleted, so no current company context
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          additionalData: { deletedCompanyName: deletedCompany[0].name }
        },
        companyId,
        deletedCompany[0],
        undefined
      );
    } catch (logError) {
      console.error("Failed to log company deletion:", logError);
      // Don't fail the request if logging fails
    }

    res.json({ message: "Company deleted successfully" });
  } catch (error) {
    console.error("Error deleting company:", error);
    
    // Log company deletion error
    try {
      await activityLogger.logError(
        ACTIVITY_ACTIONS.COMPANY_DELETE,
        RESOURCE_TYPES.COMPANY,
        {
          userId: (req as any).session?.userId || 0,
          companyId: undefined,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        },
        error as Error,
        companyId,
        { attemptedCompanyId: companyId }
      );
    } catch (logError) {
      console.error("Failed to log company deletion error:", logError);
    }
    
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

// Assign user to company
router.post("/assign-user", async (req, res) => {
  try {
    const { userId, companyId, role } = req.body;

    if (!userId || !companyId || !role) {
      return res.status(400).json({ error: "User ID, Company ID, and Role are required" });
    }

    // Verify user exists
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify company exists
    const company = await db.select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (company.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Check if user is already assigned to this company
    const existingAssignment = await db.select()
      .from(userCompanies)
      .where(and(
        eq(userCompanies.userId, userId),
        eq(userCompanies.companyId, companyId)
      ))
      .limit(1);

    if (existingAssignment.length > 0) {
      return res.status(400).json({ error: "User is already assigned to this company" });
    }

    // Create assignment
    const assignment = await db.insert(userCompanies)
      .values({
        userId,
        companyId,
        role,
        isActive: true,
      })
      .returning();

    // Log activity
    await activityLogger.logCRUD(
      ACTIVITY_ACTIONS.USER_ASSIGN,
      RESOURCE_TYPES.USER_COMPANY,
      { userId, companyId },
      assignment[0].id,
      undefined,
      { userId, companyId, role }
    );

    res.json({ message: "User assigned successfully", assignment: assignment[0] });
  } catch (error) {
    console.error("Error assigning user:", error);
    res.status(500).json({ error: "Failed to assign user" });
  }
});

// Update user role in company
router.put("/user-assignments/:assignmentId", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);
    const { role } = req.body;

    if (isNaN(assignmentId)) {
      return res.status(400).json({ error: "Invalid assignment ID" });
    }

    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }

    // Verify assignment exists
    const assignment = await db.select()
      .from(userCompanies)
      .where(eq(userCompanies.id, assignmentId))
      .limit(1);

    if (assignment.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Update role
    const updatedAssignment = await db.update(userCompanies)
      .set({
        role,
      })
      .where(eq(userCompanies.id, assignmentId))
      .returning();

    // Log activity
    await activityLogger.logCRUD(
      ACTIVITY_ACTIONS.ROLE_CHANGE,
      RESOURCE_TYPES.USER_COMPANY,
      { userId: assignment[0].userId },
      assignmentId,
      { role: assignment[0].role },
      { role }
    );

    res.json({ message: "Role updated successfully", assignment: updatedAssignment[0] });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// Remove user from company
router.delete("/user-assignments/:assignmentId", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);

    if (isNaN(assignmentId)) {
      return res.status(400).json({ error: "Invalid assignment ID" });
    }

    // Verify assignment exists and get details for logging
    const assignment = await db.select({
      id: userCompanies.id,
      userId: userCompanies.userId,
      companyId: userCompanies.companyId,
      role: userCompanies.role,
      companyName: companies.name,
      userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`
    })
      .from(userCompanies)
      .innerJoin(companies, eq(userCompanies.companyId, companies.id))
      .innerJoin(users, eq(userCompanies.userId, users.id))
      .where(eq(userCompanies.id, assignmentId))
      .limit(1);

    if (assignment.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Delete assignment
    await db.delete(userCompanies)
      .where(eq(userCompanies.id, assignmentId));

    // Log activity
    await activityLogger.logCRUD(
      ACTIVITY_ACTIONS.USER_UNASSIGN,
      RESOURCE_TYPES.USER_COMPANY,
      { userId: assignment[0].userId, companyId: assignment[0].companyId },
      assignmentId,
      { userId: assignment[0].userId, companyId: assignment[0].companyId, role: assignment[0].role },
      undefined
    );

    res.json({ message: "User removed from company successfully" });
  } catch (error) {
    console.error("Error removing user:", error);
    res.status(500).json({ error: "Failed to remove user" });
  }
});

export default router; 