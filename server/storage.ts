import { 
  users, companies, userCompanies, accounts, journalEntries, journalEntryLines,
  customers, vendors, invoices, bills, activityLogs,
  type User, type InsertUser, type Company, type InsertCompany,
  type UserCompany, type InsertUserCompany, type Account, type InsertAccount,
  type JournalEntry, type InsertJournalEntry, type JournalEntryLine, type InsertJournalEntryLine,
  type Customer, type InsertCustomer, type Vendor, type InsertVendor,
  type Invoice, type InsertInvoice, type Bill, type InsertBill
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;

  // Company methods
  getCompany(id: number): Promise<Company | undefined>;
  getCompaniesByUser(userId: number): Promise<Company[]>;
  getAllCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<void>;

  // User-Company methods
  getUserCompany(userId: number, companyId: number): Promise<UserCompany | undefined>;
  getUserCompanies(userId: number): Promise<UserCompany[]>;
  createUserCompany(userCompany: InsertUserCompany): Promise<UserCompany>;
  updateUserCompany(id: number, userCompany: Partial<InsertUserCompany>): Promise<UserCompany | undefined>;

  // Account methods
  getAccount(id: number): Promise<Account | undefined>;
  getAccountsByCompany(companyId: number): Promise<Account[]>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: number, account: Partial<InsertAccount>): Promise<Account | undefined>;

  // Journal Entry methods
  getJournalEntry(id: number): Promise<JournalEntry | undefined>;
  getJournalEntriesByCompany(companyId: number): Promise<JournalEntry[]>;
  createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: number, entry: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined>;

  // Journal Entry Line methods
  getJournalEntryLinesByEntry(entryId: number): Promise<JournalEntryLine[]>;
  createJournalEntryLine(line: InsertJournalEntryLine): Promise<JournalEntryLine>;

  // Customer methods
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomersByCompany(companyId: number): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;

  // Vendor methods
  getVendor(id: number): Promise<Vendor | undefined>;
  getVendorsByCompany(companyId: number): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;

  // Invoice methods
  getInvoice(id: number): Promise<Invoice | undefined>;
  getInvoicesByCompany(companyId: number): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;

  // Bill methods
  getBill(id: number): Promise<Bill | undefined>;
  getBillsByCompany(companyId: number): Promise<Bill[]>;
  createBill(bill: InsertBill): Promise<Bill>;
  updateBill(id: number, bill: Partial<InsertBill>): Promise<Bill | undefined>;

  // Global admin methods
  getAllCompanies(): Promise<Company[]>;
  getAllCompaniesWithStats(): Promise<Company[]>;
  getAllUsers(): Promise<User[]>;
  getAllUsersWithStats(): Promise<GlobalUser[]>;
  getTransactionCount(): Promise<number>;
  companyHasData(companyId: number): Promise<boolean>;
  getActivityLogs(limit: number): Promise<ActivityLog[]>;
  logActivity(userId: number, action: string, resource: string, details?: string, ipAddress?: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updateUser: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updateUser).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  // Company methods
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompaniesByUser(userId: number): Promise<Company[]> {
    // First check if user is a global administrator
    const user = await this.getUser(userId);
    if (user?.globalRole === 'global_administrator') {
      // Global admins see ALL companies
      return await this.getAllCompanies();
    }

    // Regular users see only assigned companies
    const userCompaniesData = await db
      .select({ company: companies })
      .from(userCompanies)
      .innerJoin(companies, eq(userCompanies.companyId, companies.id))
      .where(and(eq(userCompanies.userId, userId), eq(userCompanies.isActive, true)));
    
    return userCompaniesData.map(uc => uc.company);
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db
      .select()
      .from(companies)
      .where(eq(companies.isActive, true))
      .orderBy(asc(companies.name));
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(insertCompany).returning();
    return company;
  }

  async updateCompany(id: number, updateCompany: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db.update(companies).set(updateCompany).where(eq(companies.id, id)).returning();
    return company || undefined;
  }

  // User-Company methods
  async getUserCompany(userId: number, companyId: number): Promise<UserCompany | undefined> {
    const [userCompany] = await db
      .select()
      .from(userCompanies)
      .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)));
    return userCompany || undefined;
  }

  async getUserCompanies(userId: number): Promise<UserCompany[]> {
    return await db
      .select()
      .from(userCompanies)
      .where(and(eq(userCompanies.userId, userId), eq(userCompanies.isActive, true)));
  }

  async createUserCompany(insertUserCompany: InsertUserCompany): Promise<UserCompany> {
    const [userCompany] = await db.insert(userCompanies).values(insertUserCompany).returning();
    return userCompany;
  }

  async updateUserCompany(id: number, updateUserCompany: Partial<InsertUserCompany>): Promise<UserCompany | undefined> {
    const [userCompany] = await db.update(userCompanies).set(updateUserCompany).where(eq(userCompanies.id, id)).returning();
    return userCompany || undefined;
  }

  // Account methods
  async getAccount(id: number): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account || undefined;
  }

  async getAccountsByCompany(companyId: number): Promise<Account[]> {
    return await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.companyId, companyId), eq(accounts.isActive, true)))
      .orderBy(asc(accounts.code));
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const [account] = await db.insert(accounts).values(insertAccount).returning();
    return account;
  }

  async updateAccount(id: number, updateAccount: Partial<InsertAccount>): Promise<Account | undefined> {
    const [account] = await db.update(accounts).set(updateAccount).where(eq(accounts.id, id)).returning();
    return account || undefined;
  }

  // Journal Entry methods
  async getJournalEntry(id: number): Promise<JournalEntry | undefined> {
    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
    return entry || undefined;
  }

  async getJournalEntriesByCompany(companyId: number): Promise<JournalEntry[]> {
    return await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.companyId, companyId))
      .orderBy(desc(journalEntries.date));
  }

  async createJournalEntry(insertEntry: InsertJournalEntry): Promise<JournalEntry> {
    const [entry] = await db.insert(journalEntries).values(insertEntry).returning();
    return entry;
  }

  async updateJournalEntry(id: number, updateEntry: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined> {
    const [entry] = await db.update(journalEntries).set(updateEntry).where(eq(journalEntries.id, id)).returning();
    return entry || undefined;
  }

  // Journal Entry Line methods
  async getJournalEntryLinesByEntry(entryId: number): Promise<JournalEntryLine[]> {
    return await db
      .select()
      .from(journalEntryLines)
      .where(eq(journalEntryLines.journalEntryId, entryId));
  }

  async createJournalEntryLine(insertLine: InsertJournalEntryLine): Promise<JournalEntryLine> {
    const [line] = await db.insert(journalEntryLines).values(insertLine).returning();
    return line;
  }

  // Customer methods
  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomersByCompany(companyId: number): Promise<Customer[]> {
    return await db
      .select()
      .from(customers)
      .where(and(eq(customers.companyId, companyId), eq(customers.isActive, true)))
      .orderBy(asc(customers.name));
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: number, updateCustomer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set(updateCustomer).where(eq(customers.id, id)).returning();
    return customer || undefined;
  }

  // Vendor methods
  async getVendor(id: number): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor || undefined;
  }

  async getVendorsByCompany(companyId: number): Promise<Vendor[]> {
    return await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.companyId, companyId), eq(vendors.isActive, true)))
      .orderBy(asc(vendors.name));
  }

  async createVendor(insertVendor: InsertVendor): Promise<Vendor> {
    const [vendor] = await db.insert(vendors).values(insertVendor).returning();
    return vendor;
  }

  async updateVendor(id: number, updateVendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const [vendor] = await db.update(vendors).set(updateVendor).where(eq(vendors.id, id)).returning();
    return vendor || undefined;
  }

  // Invoice methods
  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async getInvoicesByCompany(companyId: number): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.companyId, companyId))
      .orderBy(desc(invoices.date));
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
    return invoice;
  }

  async updateInvoice(id: number, updateInvoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(updateInvoice).where(eq(invoices.id, id)).returning();
    return invoice || undefined;
  }

  // Bill methods
  async getBill(id: number): Promise<Bill | undefined> {
    const [bill] = await db.select().from(bills).where(eq(bills.id, id));
    return bill || undefined;
  }

  async getBillsByCompany(companyId: number): Promise<Bill[]> {
    return await db
      .select()
      .from(bills)
      .where(eq(bills.companyId, companyId))
      .orderBy(desc(bills.date));
  }

  async createBill(insertBill: InsertBill): Promise<Bill> {
    const [bill] = await db.insert(bills).values(insertBill).returning();
    return bill;
  }

  async updateBill(id: number, updateBill: Partial<InsertBill>): Promise<Bill | undefined> {
    const [bill] = await db.update(bills).set(updateBill).where(eq(bills.id, id)).returning();
    return bill || undefined;
  }

  // Global admin methods
  async getAllCompanies(): Promise<Company[]> {
    return await db
      .select()
      .from(companies)
      .where(eq(companies.isActive, true))
      .orderBy(asc(companies.name));
  }

  async getAllCompaniesWithStats(): Promise<Company[]> {
    const companies = await this.getAllCompanies();
    
    // Add user count and last activity for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const userCount = await db
          .select({ count: sql`COUNT(*)` })
          .from(userCompanies)
          .where(eq(userCompanies.companyId, company.id));
        
        // Get last activity (this would be from a real activity log table)
        const lastActivity = null; // Implement based on your activity tracking
        
        return {
          ...company,
          userCount: userCount[0]?.count || 0,
          lastActivity,
        };
      })
    );
    
    return companiesWithStats;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllUsersWithStats(): Promise<GlobalUser[]> {
    const users = await this.getAllUsers();
    
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const companiesCount = await db
          .select({ count: sql`COUNT(*)` })
          .from(userCompanies)
          .where(eq(userCompanies.userId, user.id));
        
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          globalRole: user.globalRole,
          isActive: user.isActive,
          createdAt: user.createdAt?.toISOString() || '',
          lastLogin: null, // Would come from session tracking
          companiesCount: companiesCount[0]?.count || 0,
        };
      })
    );
    
    return usersWithStats;
  }

  async getTransactionCount(): Promise<number> {
    const result = await db
      .select({ count: sql`COUNT(*)` })
      .from(journalEntries);
    
    return result[0]?.count || 0;
  }

  async companyHasData(companyId: number): Promise<boolean> {
    // Check if company has any accounts, transactions, etc.
    const [accounts, journalEntries] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.companyId, companyId)).limit(1),
      db.select().from(journalEntries).where(eq(journalEntries.companyId, companyId)).limit(1),
    ]);
    
    return accounts.length > 0 || journalEntries.length > 0;
  }

  async getActivityLogs(limit: number): Promise<ActivityLog[]> {
    // This would come from a dedicated activity_logs table
    // For now, return mock data
    return [
      {
        id: 1,
        userId: 1,
        userName: "admin",
        action: "CREATE",
        resource: "COMPANY",
        details: "Created company: Acme Corporation",
        timestamp: new Date().toISOString(),
        ipAddress: "192.168.1.100",
      },
    ];
  }

  async logActivity(
    userId: number, 
    action: string, 
    resource: string, 
    details?: string, 
    ipAddress?: string
  ): Promise<void> {
    // This would insert into an activity_logs table
    // Implementation depends on your activity logging requirements
    console.log('Activity:', { userId, action, resource, details, ipAddress });
  }
}

export const storage = new DatabaseStorage();
