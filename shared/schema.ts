import { pgTable, text, serial, integer, boolean, timestamp, decimal, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  globalRole: text("global_role").default("user"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  taxId: text("tax_id"),
  fiscalYearStart: integer("fiscal_year_start").default(1), // Month 1-12
  currency: text("currency").default("USD"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User-Company relationships with roles
export const userCompanies = pgTable("user_companies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  role: text("role").notNull(), // "administrator", "manager", "accountant", "assistant"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chart of Accounts
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "asset", "liability", "equity", "revenue", "expense"
  subType: text("sub_type"), // "current_asset", "fixed_asset", etc.
  parentId: integer("parent_id").references(() => accounts.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Journal Entries
export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  entryNumber: text("entry_number").notNull(),
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  reference: text("reference"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  isPosted: boolean("is_posted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Journal Entry Lines
export const journalEntryLines = pgTable("journal_entry_lines", {
  id: serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id").references(() => journalEntries.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  description: text("description"),
  debitAmount: decimal("debit_amount", { precision: 15, scale: 2 }).default("0"),
  creditAmount: decimal("credit_amount", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendors
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  date: timestamp("date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  status: text("status").default("draft"), // "draft", "sent", "paid", "overdue"
  createdAt: timestamp("created_at").defaultNow(),
});

// Bills
export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  vendorId: integer("vendor_id").references(() => vendors.id).notNull(),
  billNumber: text("bill_number").notNull(),
  date: timestamp("date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  status: text("status").default("draft"), // "draft", "approved", "paid"
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity Logs
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // CREATE, UPDATE, DELETE, LOGIN, etc.
  resource: text("resource").notNull(), // COMPANY, USER, TRANSACTION, etc.
  resourceId: integer("resource_id"), // ID of the affected resource
  details: text("details"), // Additional details about the action
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Company Settings
export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull().unique(),
  // Notification settings
  emailNotifications: boolean("email_notifications").default(true),
  invoiceReminders: boolean("invoice_reminders").default(true),
  paymentAlerts: boolean("payment_alerts").default(true),
  reportReminders: boolean("report_reminders").default(false),
  systemUpdates: boolean("system_updates").default(true),
  // Financial settings
  autoNumbering: boolean("auto_numbering").default(true),
  invoicePrefix: text("invoice_prefix").default("INV"),
  billPrefix: text("bill_prefix").default("BILL"),
  journalPrefix: text("journal_prefix").default("JE"),
  decimalPlaces: integer("decimal_places").default(2),
  negativeFormat: text("negative_format").default("minus"), // "minus", "parentheses", "color"
  dateFormat: text("date_format").default("MM/DD/YYYY"), // "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"
  timeZone: text("time_zone").default("America/New_York"),
  // Security settings
  requirePasswordChange: boolean("require_password_change").default(false),
  passwordExpireDays: integer("password_expire_days").default(90),
  sessionTimeout: integer("session_timeout").default(30), // minutes
  enableTwoFactor: boolean("enable_two_factor").default(false),
  allowMultipleSessions: boolean("allow_multiple_sessions").default(true),
  // Integration settings
  bankConnection: boolean("bank_connection").default(false),
  paymentGateway: boolean("payment_gateway").default(false),
  taxService: boolean("tax_service").default(false),
  reportingTools: boolean("reporting_tools").default(false),
  // Backup settings
  autoBackup: boolean("auto_backup").default(false),
  backupFrequency: text("backup_frequency").default("weekly"), // "daily", "weekly", "monthly"
  retentionDays: integer("retention_days").default(30),
  backupLocation: text("backup_location").default("cloud"), // "local", "cloud"
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userCompanies: many(userCompanies),
  journalEntries: many(journalEntries),
}));

export const companiesRelations = relations(companies, ({ many, one }) => ({
  userCompanies: many(userCompanies),
  accounts: many(accounts),
  journalEntries: many(journalEntries),
  customers: many(customers),
  vendors: many(vendors),
  invoices: many(invoices),
  bills: many(bills),
  settings: one(companySettings),
}));

export const userCompaniesRelations = relations(userCompanies, ({ one }) => ({
  user: one(users, { fields: [userCompanies.userId], references: [users.id] }),
  company: one(companies, { fields: [userCompanies.companyId], references: [companies.id] }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  company: one(companies, { fields: [accounts.companyId], references: [companies.id] }),
  parent: one(accounts, { fields: [accounts.parentId], references: [accounts.id] }),
  children: many(accounts, { relationName: "account_children" }),
  journalEntryLines: many(journalEntryLines),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  company: one(companies, { fields: [journalEntries.companyId], references: [companies.id] }),
  user: one(users, { fields: [journalEntries.userId], references: [users.id] }),
  lines: many(journalEntryLines),
}));

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, { fields: [journalEntryLines.journalEntryId], references: [journalEntries.id] }),
  account: one(accounts, { fields: [journalEntryLines.accountId], references: [accounts.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  company: one(companies, { fields: [customers.companyId], references: [companies.id] }),
  invoices: many(invoices),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  company: one(companies, { fields: [vendors.companyId], references: [companies.id] }),
  bills: many(bills),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  company: one(companies, { fields: [invoices.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
}));

export const billsRelations = relations(bills, ({ one }) => ({
  company: one(companies, { fields: [bills.companyId], references: [companies.id] }),
  vendor: one(vendors, { fields: [bills.vendorId], references: [vendors.id] }),
}));

export const companySettingsRelations = relations(companySettings, ({ one }) => ({
  company: one(companies, { fields: [companySettings.companyId], references: [companies.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export const insertUserCompanySchema = createInsertSchema(userCompanies).omit({ id: true, createdAt: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true });
export const insertJournalEntryLineSchema = createInsertSchema(journalEntryLines).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertBillSchema = createInsertSchema(bills).omit({ id: true, createdAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true, createdAt: true, updatedAt: true });

// Enhanced validation schemas with business rules
export const insertUserSchemaEnhanced = insertUserSchema.extend({
  email: z.string().email("Invalid email format"),
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username too long"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  globalRole: z.enum(["user", "global_administrator"]).default("user")
});

export const insertCompanySchemaEnhanced = insertCompanySchema.extend({
  name: z.string().min(1, "Company name is required").max(100, "Company name too long"),
  code: z.string().min(2, "Company code must be at least 2 characters").max(10, "Company code too long").regex(/^[A-Z0-9]+$/, "Company code must contain only uppercase letters and numbers"),
  email: z.string().email("Invalid email format").optional(),
  currency: z.string().length(3, "Currency must be 3 characters (ISO 4217)").default("USD"),
  fiscalYearStart: z.number().min(1).max(12, "Fiscal year start must be between 1-12")
});

export const insertAccountSchemaEnhanced = insertAccountSchema.extend({
  code: z.string().min(1, "Account code is required").max(20, "Account code too long"),
  name: z.string().min(1, "Account name is required").max(100, "Account name too long"),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"], {
    errorMap: () => ({ message: "Account type must be one of: asset, liability, equity, revenue, expense" })
  }),
  subType: z.string().optional()
});

export const insertJournalEntrySchemaEnhanced = insertJournalEntrySchema.extend({
  entryNumber: z.string().min(1, "Entry number is required"),
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
  totalAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Total amount must be a positive number"),
  date: z.date().max(new Date(), "Entry date cannot be in the future")
});

export const insertJournalEntryLineSchemaEnhanced = insertJournalEntryLineSchema.extend({
  debitAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, "Debit amount must be a non-negative number"),
  creditAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, "Credit amount must be a non-negative number")
}).refine((data) => {
  const debit = parseFloat(data.debitAmount || "0");
  const credit = parseFloat(data.creditAmount || "0");
  return (debit > 0 && credit === 0) || (credit > 0 && debit === 0);
}, {
  message: "Either debit or credit amount must be specified, but not both",
  path: ["debitAmount"]
});

// Business validation for complete journal entries
export const journalEntryWithLinesSchema = z.object({
  entry: insertJournalEntrySchemaEnhanced,
  lines: z.array(insertJournalEntryLineSchemaEnhanced).min(2, "Journal entry must have at least 2 lines")
}).refine((data) => {
  const totalDebits = data.lines.reduce((sum, line) => sum + parseFloat(line.debitAmount || "0"), 0);
  const totalCredits = data.lines.reduce((sum, line) => sum + parseFloat(line.creditAmount || "0"), 0);
  return Math.abs(totalDebits - totalCredits) < 0.01; // Allow for rounding differences
}, {
  message: "Total debits must equal total credits",
  path: ["lines"]
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type UserCompany = typeof userCompanies.$inferSelect;
export type InsertUserCompany = z.infer<typeof insertUserCompanySchema>;
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type InsertJournalEntryLine = z.infer<typeof insertJournalEntryLineSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Bill = typeof bills.$inferSelect;
export type InsertBill = z.infer<typeof insertBillSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

// Enhanced types with validation
export type InsertUserEnhanced = z.infer<typeof insertUserSchemaEnhanced>;
export type InsertCompanyEnhanced = z.infer<typeof insertCompanySchemaEnhanced>;
export type InsertAccountEnhanced = z.infer<typeof insertAccountSchemaEnhanced>;
export type InsertJournalEntryEnhanced = z.infer<typeof insertJournalEntrySchemaEnhanced>;
export type InsertJournalEntryLineEnhanced = z.infer<typeof insertJournalEntryLineSchemaEnhanced>;
export type JournalEntryWithLines = z.infer<typeof journalEntryWithLinesSchema>;
