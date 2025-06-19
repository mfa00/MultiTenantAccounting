#!/usr/bin/env tsx

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function testConnection() {
  console.log("🔍 Testing database connection...\n");
  
  try {
    console.log("DATABASE_URL:", process.env.DATABASE_URL ? "✅ Set" : "❌ Missing");
    
    if (!process.env.DATABASE_URL) {
      console.log("❌ Please set DATABASE_URL in your .env file");
      console.log("\n📋 Steps to get DATABASE_URL:");
      console.log("1. Go to https://neon.tech");
      console.log("2. Sign up for free");
      console.log("3. Create a new project: 'MultiTenantAccounting'");
      console.log("4. Copy the connection string");
      console.log("5. Update DATABASE_URL in .env file");
      process.exit(1);
    }
    
    // Test basic connection
    console.log("🔗 Testing connection...");
    const start = Date.now();
    const result = await db.execute(sql`SELECT 1 as test`);
    const connectionTime = Date.now() - start;
    
    console.log(`✅ Connection successful! (${connectionTime}ms)`);
    console.log(`📊 Test query result:`, result.rows[0]);
    
    // Test database info
    console.log("\n📈 Database Information:");
    const versionResult = await db.execute(sql`SELECT version()`);
    const version = versionResult.rows[0].version as string;
    console.log(`   PostgreSQL: ${version.split(' ')[1]}`);
    
    const dbName = await db.execute(sql`SELECT current_database()`);
    console.log(`   Database: ${dbName.rows[0].current_database}`);
    
    const tableCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`
    );
    console.log(`   Tables: ${tableCount.rows[0].count}`);
    
    console.log("\n🎉 Database connection test passed!");
    console.log("💡 Next step: Run 'npm run db:migrate' to set up your schema");
    
  } catch (error) {
    console.error("❌ Database connection failed!");
    console.error("Error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("ENOTFOUND")) {
        console.log("\n💡 This looks like a hostname/connection issue.");
        console.log("   Check your DATABASE_URL format:");
        console.log("   postgresql://user:password@host:port/database");
      } else if (error.message.includes("authentication")) {
        console.log("\n💡 This looks like an authentication issue.");
        console.log("   Check your username and password in DATABASE_URL");
      } else if (error.message.includes("database") && error.message.includes("does not exist")) {
        console.log("\n💡 Database doesn't exist yet.");
        console.log("   Make sure the database name in DATABASE_URL is correct");
      }
    }
    
    console.log("\n🛠️ Troubleshooting:");
    console.log("1. Verify DATABASE_URL is correct");
    console.log("2. Check your internet connection");
    console.log("3. Make sure the database server is running");
    console.log("4. Try creating a new database connection string");
    
    process.exit(1);
  }
}

testConnection(); 