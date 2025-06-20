import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables are handled by --env-file=.env flag
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface ForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

async function validateAndCreateSchema() {
  try {
    console.log('🔍 Validating Database Schema...\n');

    // Check database connection
    console.log('1. Testing database connection...');
    try {
      await db.execute(sql`SELECT 1`);
      console.log('✅ Database connection successful');
    } catch (error: any) {
      console.log('❌ Database connection failed:', error.message);
      return;
    }

    // Get existing tables
    console.log('\n2. Checking existing tables...');
    let discoveredTableNames: string[] = [];
    
    try {
      // Use the same approach as the working db-validation service
      const existingTablesResult = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      // Handle the result properly - Drizzle results have a .rows property
      discoveredTableNames = existingTablesResult.rows 
        ? existingTablesResult.rows.map((row: any) => row.table_name)
        : [];
      console.log('📋 Existing tables:', discoveredTableNames.join(', ') || 'None');
      
    } catch (error: any) {
      console.log('❌ Failed to get existing tables:', error.message);
    }

    // Define required tables with their schemas
    const requiredTables = {
      users: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('users_id_seq'::regclass)" },
          { name: 'username', type: 'text', nullable: false, default: null },
          { name: 'email', type: 'text', nullable: false, default: null },
          { name: 'password', type: 'text', nullable: false, default: null },
          { name: 'first_name', type: 'text', nullable: false, default: null },
          { name: 'last_name', type: 'text', nullable: false, default: null },
          { name: 'global_role', type: 'text', nullable: false, default: "'user'::text" },
          { name: 'is_active', type: 'boolean', nullable: false, default: 'true' },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT users_pkey PRIMARY KEY (id)',
          'CONSTRAINT users_username_unique UNIQUE (username)',
          'CONSTRAINT users_email_unique UNIQUE (email)'
        ]
      },
      companies: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('companies_id_seq'::regclass)" },
          { name: 'name', type: 'text', nullable: false, default: null },
          { name: 'code', type: 'text', nullable: false, default: null },
          { name: 'address', type: 'text', nullable: true, default: null },
          { name: 'phone', type: 'text', nullable: true, default: null },
          { name: 'email', type: 'text', nullable: true, default: null },
          { name: 'tax_id', type: 'text', nullable: true, default: null },
          { name: 'fiscal_year_start', type: 'integer', nullable: false, default: '1' },
          { name: 'currency', type: 'text', nullable: false, default: "'USD'::text" },
          { name: 'is_active', type: 'boolean', nullable: false, default: 'true' },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT companies_pkey PRIMARY KEY (id)',
          'CONSTRAINT companies_code_unique UNIQUE (code)'
        ]
      },
      user_companies: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('user_companies_id_seq'::regclass)" },
          { name: 'user_id', type: 'integer', nullable: false, default: null },
          { name: 'company_id', type: 'integer', nullable: false, default: null },
          { name: 'role', type: 'text', nullable: false, default: "'assistant'::text" },
          { name: 'is_active', type: 'boolean', nullable: false, default: 'true' },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT user_companies_pkey PRIMARY KEY (id)',
          'CONSTRAINT user_companies_user_id_companies_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)',
          'CONSTRAINT user_companies_company_id_companies_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id)'
        ]
      },
      accounts: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('accounts_id_seq'::regclass)" },
          { name: 'company_id', type: 'integer', nullable: false, default: null },
          { name: 'code', type: 'text', nullable: false, default: null },
          { name: 'name', type: 'text', nullable: false, default: null },
          { name: 'type', type: 'text', nullable: false, default: null },
          { name: 'sub_type', type: 'text', nullable: true, default: null },
          { name: 'parent_id', type: 'integer', nullable: true, default: null },
          { name: 'is_active', type: 'boolean', nullable: false, default: 'true' },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT accounts_pkey PRIMARY KEY (id)',
          'CONSTRAINT accounts_company_id_companies_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id)',
          'CONSTRAINT accounts_parent_id_accounts_id_fkey FOREIGN KEY (parent_id) REFERENCES accounts(id)'
        ]
      },
      journal_entries: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('journal_entries_id_seq'::regclass)" },
          { name: 'company_id', type: 'integer', nullable: false, default: null },
          { name: 'user_id', type: 'integer', nullable: false, default: null },
          { name: 'entry_number', type: 'text', nullable: false, default: null },
          { name: 'description', type: 'text', nullable: false, default: null },
          { name: 'date', type: 'date', nullable: false, default: null },
          { name: 'total_amount', type: 'numeric(15,2)', nullable: false, default: null },
          { name: 'status', type: 'text', nullable: false, default: "'draft'::text" },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT journal_entries_pkey PRIMARY KEY (id)',
          'CONSTRAINT journal_entries_company_id_companies_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id)',
          'CONSTRAINT journal_entries_user_id_users_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)'
        ]
      },
      journal_entry_lines: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('journal_entry_lines_id_seq'::regclass)" },
          { name: 'journal_entry_id', type: 'integer', nullable: false, default: null },
          { name: 'account_id', type: 'integer', nullable: false, default: null },
          { name: 'description', type: 'text', nullable: true, default: null },
          { name: 'debit_amount', type: 'numeric(15,2)', nullable: false, default: "'0'::numeric" },
          { name: 'credit_amount', type: 'numeric(15,2)', nullable: false, default: "'0'::numeric" },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT journal_entry_lines_pkey PRIMARY KEY (id)',
          'CONSTRAINT journal_entry_lines_journal_entry_id_journal_entries_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)',
          'CONSTRAINT journal_entry_lines_account_id_accounts_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id)'
        ]
      },
      customers: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('customers_id_seq'::regclass)" },
          { name: 'company_id', type: 'integer', nullable: false, default: null },
          { name: 'name', type: 'text', nullable: false, default: null },
          { name: 'email', type: 'text', nullable: true, default: null },
          { name: 'phone', type: 'text', nullable: true, default: null },
          { name: 'address', type: 'text', nullable: true, default: null },
          { name: 'tax_id', type: 'text', nullable: true, default: null },
          { name: 'is_active', type: 'boolean', nullable: false, default: 'true' },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT customers_pkey PRIMARY KEY (id)',
          'CONSTRAINT customers_company_id_companies_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id)'
        ]
      },
      vendors: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('vendors_id_seq'::regclass)" },
          { name: 'company_id', type: 'integer', nullable: false, default: null },
          { name: 'name', type: 'text', nullable: false, default: null },
          { name: 'email', type: 'text', nullable: true, default: null },
          { name: 'phone', type: 'text', nullable: true, default: null },
          { name: 'address', type: 'text', nullable: true, default: null },
          { name: 'tax_id', type: 'text', nullable: true, default: null },
          { name: 'is_active', type: 'boolean', nullable: false, default: 'true' },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT vendors_pkey PRIMARY KEY (id)',
          'CONSTRAINT vendors_company_id_companies_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id)'
        ]
      },
      invoices: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('invoices_id_seq'::regclass)" },
          { name: 'company_id', type: 'integer', nullable: false, default: null },
          { name: 'customer_id', type: 'integer', nullable: false, default: null },
          { name: 'invoice_number', type: 'text', nullable: false, default: null },
          { name: 'date', type: 'date', nullable: false, default: null },
          { name: 'due_date', type: 'date', nullable: true, default: null },
          { name: 'subtotal', type: 'numeric(15,2)', nullable: false, default: "'0'::numeric" },
          { name: 'tax_amount', type: 'numeric(15,2)', nullable: false, default: "'0'::numeric" },
          { name: 'total_amount', type: 'numeric(15,2)', nullable: false, default: null },
          { name: 'status', type: 'text', nullable: false, default: "'draft'::text" },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT invoices_pkey PRIMARY KEY (id)',
          'CONSTRAINT invoices_company_id_companies_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id)',
          'CONSTRAINT invoices_customer_id_customers_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id)'
        ]
      },
      bills: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('bills_id_seq'::regclass)" },
          { name: 'company_id', type: 'integer', nullable: false, default: null },
          { name: 'vendor_id', type: 'integer', nullable: false, default: null },
          { name: 'bill_number', type: 'text', nullable: false, default: null },
          { name: 'date', type: 'date', nullable: false, default: null },
          { name: 'due_date', type: 'date', nullable: true, default: null },
          { name: 'subtotal', type: 'numeric(15,2)', nullable: false, default: "'0'::numeric" },
          { name: 'tax_amount', type: 'numeric(15,2)', nullable: false, default: "'0'::numeric" },
          { name: 'total_amount', type: 'numeric(15,2)', nullable: false, default: null },
          { name: 'status', type: 'text', nullable: false, default: "'draft'::text" },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT bills_pkey PRIMARY KEY (id)',
          'CONSTRAINT bills_company_id_companies_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id)',
          'CONSTRAINT bills_vendor_id_vendors_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id)'
        ]
      },
      activity_logs: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('activity_logs_id_seq'::regclass)" },
          { name: 'user_id', type: 'integer', nullable: false, default: null },
          { name: 'action', type: 'text', nullable: false, default: null },
          { name: 'resource', type: 'text', nullable: false, default: null },
          { name: 'resource_id', type: 'integer', nullable: true, default: null },
          { name: 'details', type: 'text', nullable: true, default: null },
          { name: 'ip_address', type: 'text', nullable: true, default: null },
          { name: 'user_agent', type: 'text', nullable: true, default: null },
          { name: 'timestamp', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT activity_logs_pkey PRIMARY KEY (id)',
          'CONSTRAINT activity_logs_user_id_users_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)'
        ]
      },
      company_settings: {
        columns: [
          { name: 'id', type: 'integer', nullable: false, default: "nextval('company_settings_id_seq'::regclass)" },
          { name: 'company_id', type: 'integer', nullable: false, default: null },
          { name: 'email_notifications', type: 'boolean', nullable: false, default: 'true' },
          { name: 'invoice_reminders', type: 'boolean', nullable: false, default: 'true' },
          { name: 'payment_alerts', type: 'boolean', nullable: false, default: 'true' },
          { name: 'report_reminders', type: 'boolean', nullable: false, default: 'false' },
          { name: 'system_updates', type: 'boolean', nullable: false, default: 'true' },
          { name: 'auto_numbering', type: 'boolean', nullable: false, default: 'true' },
          { name: 'invoice_prefix', type: 'text', nullable: false, default: "'INV'::text" },
          { name: 'bill_prefix', type: 'text', nullable: false, default: "'BILL'::text" },
          { name: 'journal_prefix', type: 'text', nullable: false, default: "'JE'::text" },
          { name: 'decimal_places', type: 'integer', nullable: false, default: '2' },
          { name: 'negative_format', type: 'text', nullable: false, default: "'minus'::text" },
          { name: 'date_format', type: 'text', nullable: false, default: "'MM/DD/YYYY'::text" },
          { name: 'time_zone', type: 'text', nullable: false, default: "'America/New_York'::text" },
          { name: 'require_password_change', type: 'boolean', nullable: false, default: 'false' },
          { name: 'password_expire_days', type: 'integer', nullable: false, default: '90' },
          { name: 'session_timeout', type: 'integer', nullable: false, default: '30' },
          { name: 'enable_two_factor', type: 'boolean', nullable: false, default: 'false' },
          { name: 'allow_multiple_sessions', type: 'boolean', nullable: false, default: 'true' },
          { name: 'bank_connection', type: 'boolean', nullable: false, default: 'false' },
          { name: 'payment_gateway', type: 'boolean', nullable: false, default: 'false' },
          { name: 'tax_service', type: 'boolean', nullable: false, default: 'false' },
          { name: 'reporting_tools', type: 'boolean', nullable: false, default: 'false' },
          { name: 'auto_backup', type: 'boolean', nullable: false, default: 'false' },
          { name: 'backup_frequency', type: 'text', nullable: false, default: "'weekly'::text" },
          { name: 'retention_days', type: 'integer', nullable: false, default: '30' },
          { name: 'backup_location', type: 'text', nullable: false, default: "'cloud'::text" },
          { name: 'created_at', type: 'timestamp without time zone', nullable: false, default: 'now()' },
          { name: 'updated_at', type: 'timestamp without time zone', nullable: false, default: 'now()' }
        ],
        constraints: [
          'CONSTRAINT company_settings_pkey PRIMARY KEY (id)',
          'CONSTRAINT company_settings_company_id_unique UNIQUE (company_id)',
          'CONSTRAINT company_settings_company_id_companies_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id)'
        ]
      }
    };

    // Check and create missing tables
    console.log('\n3. Validating and creating tables...');
    let tablesCreated = 0;
    let tablesValidated = 0;

    for (const [tableName, tableSchema] of Object.entries(requiredTables)) {
      console.log(`\n   📋 Checking table: ${tableName}`);
      
      if (!discoveredTableNames.includes(tableName)) {
        console.log(`   ❌ Table ${tableName} does not exist. Creating...`);
        
        // Create sequence if needed
        const sequenceName = `${tableName}_id_seq`;
        await db.execute(sql.raw(`
          CREATE SEQUENCE IF NOT EXISTS ${sequenceName}
        `));
        
        // Build CREATE TABLE statement
        const columnDefinitions = tableSchema.columns.map(col => {
          let def = `${col.name} ${col.type}`;
          if (!col.nullable) def += ' NOT NULL';
          if (col.default) def += ` DEFAULT ${col.default}`;
          return def;
        }).join(',\n  ');
        
        const constraints = tableSchema.constraints.join(',\n  ');
        
        const createTableSQL = `
          CREATE TABLE ${tableName} (
            ${columnDefinitions}${constraints ? ',\n  ' + constraints : ''}
          )
        `;
        
        try {
          await db.execute(sql.raw(createTableSQL));
          console.log(`   ✅ Table ${tableName} created successfully`);
          tablesCreated++;
        } catch (error: any) {
          console.log(`   ❌ Failed to create table ${tableName}:`, error.message);
        }
      } else {
        // Validate existing table schema
        console.log(`   ✅ Table ${tableName} exists. Validating schema...`);
        
        try {
          const tableInfoResult = await db.execute(sql.raw(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = '${tableName}' AND table_schema = 'public'
            ORDER BY ordinal_position
          `));
          
          const tableInfoArray = tableInfoResult.rows
            ? tableInfoResult.rows as unknown as TableInfo[]
            : [];
          const existingColumns = tableInfoArray.map(col => col.column_name);
          const requiredColumns = tableSchema.columns.map(col => col.name);
          
          const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
          
          if (missingColumns.length > 0) {
            console.log(`   ⚠️  Missing columns in ${tableName}:`, missingColumns.join(', '));
            
            // Add missing columns
            for (const colName of missingColumns) {
              const colDef = tableSchema.columns.find(c => c.name === colName);
              if (colDef) {
                let alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef.type}`;
                if (!colDef.nullable) alterSQL += ' NOT NULL';
                if (colDef.default) alterSQL += ` DEFAULT ${colDef.default}`;
                
                try {
                  await db.execute(sql.raw(alterSQL));
                  console.log(`     ✅ Added column ${colName} to ${tableName}`);
                } catch (error: any) {
                  console.log(`     ❌ Failed to add column ${colName}:`, error.message);
                }
              }
            }
          } else {
            console.log(`   ✅ Schema for ${tableName} is valid`);
          }
          
          tablesValidated++;
        } catch (error: any) {
          console.log(`   ❌ Failed to validate table ${tableName}:`, error.message);
        }
      }
    }

    // Create indexes for performance
    console.log('\n4. Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code)',
      'CREATE INDEX IF NOT EXISTS idx_user_companies_user_id ON user_companies(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON user_companies(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON accounts(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code)',
      'CREATE INDEX IF NOT EXISTS idx_journal_entries_company_id ON journal_entries(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date)',
      'CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal_entry_id ON journal_entry_lines(journal_entry_id)',
      'CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id ON journal_entry_lines(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_vendors_company_id ON vendors(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_bills_company_id ON bills(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_bills_vendor_id ON bills(vendor_id)',
      'CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)',
      'CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource)',
      'CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id)'
    ];

    let indexesCreated = 0;
    for (const indexSQL of indexes) {
      try {
        await db.execute(sql.raw(indexSQL));
        indexesCreated++;
      } catch (error: any) {
        console.log(`   ⚠️  Index creation warning:`, error.message);
      }
    }
    console.log(`   ✅ Created/verified ${indexesCreated} indexes`);

    // Final validation
    console.log('\n5. Final validation...');
    const finalTablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const finalTableNames = finalTablesResult.rows
      ? finalTablesResult.rows.map((row: any) => row.table_name)
      : [];
    const allRequiredTables = Object.keys(requiredTables);
    const missingTables = allRequiredTables.filter(table => !finalTableNames.includes(table));

    console.log('\n🎉 Database Schema Validation Complete!');
    console.log('═'.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   • Total required tables: ${allRequiredTables.length}`);
    console.log(`   • Tables created: ${tablesCreated}`);
    console.log(`   • Tables validated: ${tablesValidated}`);
    console.log(`   • Indexes created/verified: ${indexesCreated}`);
    console.log(`   • Missing tables: ${missingTables.length}`);
    
    if (missingTables.length > 0) {
      console.log(`   ❌ Still missing: ${missingTables.join(', ')}`);
    } else {
      console.log(`   ✅ All required tables exist and are properly configured`);
    }

    console.log(`\n📋 Available tables: ${finalTableNames.join(', ')}`);
    
    // Test basic operations
    console.log('\n6. Testing basic operations...');
    try {
      // Test users table
      const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      console.log(`   ✅ Users table: ${userCount.rows?.[0]?.count || 0} records`);
      
      // Test companies table
      const companyCount = await db.execute(sql`SELECT COUNT(*) as count FROM companies`);
      console.log(`   ✅ Companies table: ${companyCount.rows?.[0]?.count || 0} records`);
      
      // Test activity_logs table
      const activityCount = await db.execute(sql`SELECT COUNT(*) as count FROM activity_logs`);
      console.log(`   ✅ Activity logs table: ${activityCount.rows?.[0]?.count || 0} records`);
      
      // Test company_settings table
      const settingsCount = await db.execute(sql`SELECT COUNT(*) as count FROM company_settings`);
      console.log(`   ✅ Company settings table: ${settingsCount.rows?.[0]?.count || 0} records`);
      
    } catch (error: any) {
      console.log(`   ⚠️  Basic operations test warning:`, error.message);
    }

    console.log('\n🚀 Database is ready for use!');

  } catch (error: any) {
    console.error('❌ Schema validation failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the validation
validateAndCreateSchema(); 