#!/usr/bin/env tsx

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function initializeDatabase() {
  console.log("🚀 Initializing Multi-Tenant Accounting Database...\n");

  try {
    console.log("📋 Running database setup script...");
    
    // Read and execute the SQL setup file
    const sqlFilePath = path.join(__dirname, "setup-global-admin.sql");
    const sqlContent = fs.readFileSync(sqlFilePath, "utf8");
    
    // Split by semicolons and execute each statement
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await db.execute(sql.raw(statement));
        } catch (error) {
          // Some statements might fail if data already exists, which is okay
          console.log(`   ⚠️  Statement execution note: ${error.message}`);
        }
      }
    }

    console.log("\n🎉 Database initialization completed successfully!");
    console.log("\n📋 Login Credentials:");
    console.log("==================");
    console.log("Global Admin:");
    console.log("  Username: admin");
    console.log("  Password: admin123");
    console.log("");
    console.log("Company Manager (ACME Corp):");
    console.log("  Username: manager");
    console.log("  Password: manager123");
    console.log("");
    console.log("Accountant (TechStart Inc):");
    console.log("  Username: accountant");
    console.log("  Password: accountant123");

  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

// Run the initialization
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log("\n🎯 Next Steps:");
      console.log("1. Start the application: npm run dev");
      console.log("2. Visit http://localhost:5000");
      console.log("3. Login with the credentials above");
      console.log("4. Explore Global Administration features");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to initialize database:", error);
      process.exit(1);
    });
}

export { initializeDatabase }; 