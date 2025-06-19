#!/usr/bin/env tsx

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function startSystem() {
  console.log("🚀 Starting Multi-Tenant Accounting System...\n");

  try {
    // Step 1: Test database connection
    console.log("📡 Testing database connection...");
    await db.execute(sql`SELECT 1`);
    console.log("   ✅ Database connection successful\n");

    // Step 2: Check if tables exist
    console.log("📋 Checking database schema...");
    try {
      const tableCheck = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'companies', 'user_companies', 'accounts')
      `);
      
      if (tableCheck.rows.length < 4) {
        console.log("   ⚠️  Some tables missing, running migration...");
        
        // Read and execute migration
        const migrationPath = path.join(import.meta.dirname || __dirname, "../migrations/001_initial_schema.sql");
        const migrationContent = fs.readFileSync(migrationPath, "utf8");
        
        // Execute UP section only
        const upSection = migrationContent.split("-- UP")[1]?.split("-- DOWN")[0];
        if (upSection) {
          const statements = upSection
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

          for (const statement of statements) {
            if (statement.trim()) {
              await db.execute(sql.raw(statement));
            }
          }
          console.log("   ✅ Migration completed");
        }
      } else {
        console.log("   ✅ All required tables exist");
      }
    } catch (error) {
      console.log("   ⚠️  Schema check failed:", error);
    }

    // Step 3: Check if sample data exists
    console.log("\n👤 Checking for sample data...");
    try {
      const userCheck = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      const userCount = userCheck.rows[0]?.count || 0;
      
      if (userCount === 0) {
        console.log("   ⚠️  No users found, initializing sample data...");
        
        // Read and execute setup script
        const setupPath = path.join(import.meta.dirname || __dirname, "setup-global-admin.sql");
        const setupContent = fs.readFileSync(setupPath, "utf8");
        
        const statements = setupContent
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await db.execute(sql.raw(statement));
            } catch (error) {
              // Some statements might fail if data already exists
              console.log(`     ⚠️  Note: ${error.message}`);
            }
          }
        }
        console.log("   ✅ Sample data initialized");
      } else {
        console.log(`   ✅ Found ${userCount} users in database`);
      }
    } catch (error) {
      console.log("   ⚠️  Data check failed:", error);
    }

    // Step 4: Verify setup with quick queries
    console.log("\n🔍 Verifying system setup...");
    
    const verificationQueries = [
      { name: "Users", query: "SELECT COUNT(*) as count FROM users" },
      { name: "Companies", query: "SELECT COUNT(*) as count FROM companies" },
      { name: "User-Company assignments", query: "SELECT COUNT(*) as count FROM user_companies" },
      { name: "Accounts", query: "SELECT COUNT(*) as count FROM accounts" },
      { name: "Global Admin", query: "SELECT username FROM users WHERE global_role = 'global_administrator'" }
    ];

    for (const check of verificationQueries) {
      try {
        const result = await db.execute(sql.raw(check.query));
        if (check.name === "Global Admin") {
          const admin = result.rows[0]?.username;
          console.log(`   📊 ${check.name}: ${admin || 'Not found'}`);
        } else {
          const count = result.rows[0]?.count || 0;
          console.log(`   📊 ${check.name}: ${count}`);
        }
      } catch (error) {
        console.log(`   ❌ ${check.name}: Error - ${error.message}`);
      }
    }

    // Step 5: Show login credentials
    console.log("\n🎯 System Ready!");
    console.log("================");
    console.log("Default Login Credentials:");
    console.log("• Global Admin: admin / admin123");
    console.log("• Manager: manager / manager123");
    console.log("• Accountant: accountant / accountant123");
    console.log("• Assistant: assistant / assistant123");
    
    console.log("\nAPI Endpoints Available:");
    console.log("• GET /api/global-admin/users");
    console.log("• GET /api/global-admin/companies");
    console.log("• GET /api/global-admin/stats");
    console.log("• GET /api/global-admin/activity");
    
    console.log("\nNext Steps:");
    console.log("1. Start the application: npm run dev");
    console.log("2. Visit: http://localhost:5000");
    console.log("3. Login with admin credentials");
    console.log("4. Navigate to Global Administration");

  } catch (error) {
    console.error("❌ System startup failed:", error);
    throw error;
  }
}

// Run the startup
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  startSystem()
    .then(() => {
      console.log("\n✨ Ready to start the application!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to start system:", error);
      process.exit(1);
    });
}

export { startSystem }; 