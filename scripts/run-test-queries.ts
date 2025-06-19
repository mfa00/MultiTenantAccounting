#!/usr/bin/env tsx

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function runTestQueries() {
  console.log("🧪 Running Global Administration Test Queries...\n");

  try {
    // Read the test queries file
    const queriesFilePath = path.join(import.meta.dirname || __dirname, "test-queries.sql");
    const queriesContent = fs.readFileSync(queriesFilePath, "utf8");
    
    // Split queries by comments that start with numbers (1., 2., etc.)
    const queryBlocks = queriesContent.split(/-- \d+\./).filter(block => block.trim());
    
    for (let i = 0; i < queryBlocks.length; i++) {
      const block = queryBlocks[i].trim();
      if (!block) continue;
      
      // Extract the query name from the first line
      const lines = block.split('\n');
      const nameMatch = lines[0].match(/(.+)/);
      const queryName = nameMatch ? nameMatch[1].trim() : `Query ${i + 1}`;
      
      console.log(`📊 ${queryName}`);
      console.log("=" + "=".repeat(queryName.length + 2));
      
      try {
        // Find the actual SELECT statement
        const selectMatch = block.match(/SELECT[\s\S]*?(?=;|$)/);
        if (selectMatch) {
          const query = selectMatch[0].trim();
          const results = await db.execute(sql.raw(query));
          
          if (results.rows && results.rows.length > 0) {
            // Display results in a table format
            console.table(results.rows);
          } else {
            console.log("   ℹ️  No results found");
          }
        }
      } catch (error: any) {
        console.log(`   ⚠️  Query error: ${error.message}`);
      }
      
      console.log("\n");
    }

    console.log("🎉 Test queries completed!");
    
  } catch (error) {
    console.error("❌ Test queries failed:", error);
    throw error;
  }
}

// Quick status check
async function quickStatusCheck() {
  console.log("⚡ Quick Status Check");
  console.log("==================\n");

  try {
    // Check if tables exist and have data
    const tables = [
      { name: 'users', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'companies', query: 'SELECT COUNT(*) as count FROM companies' },
      { name: 'user_companies', query: 'SELECT COUNT(*) as count FROM user_companies' },
      { name: 'accounts', query: 'SELECT COUNT(*) as count FROM accounts' },
      { name: 'activity_logs', query: 'SELECT COUNT(*) as count FROM activity_logs' }
    ];

    for (const table of tables) {
      try {
        const result = await db.execute(sql.raw(table.query));
        const count = result.rows[0]?.count || 0;
        console.log(`📋 ${table.name.padEnd(15)}: ${count} records`);
      } catch (error: any) {
        console.log(`❌ ${table.name.padEnd(15)}: Table not found or error - ${error.message}`);
      }
    }

    // Check admin user
    try {
      const adminCheck = await db.execute(sql.raw(
        "SELECT username, global_role FROM users WHERE global_role = 'global_administrator'"
      ));
      
      if (adminCheck.rows && adminCheck.rows.length > 0) {
        console.log(`\n👑 Global Admin: ${adminCheck.rows[0].username}`);
      } else {
        console.log("\n❌ No global administrator found!");
      }
    } catch (error: any) {
      console.log(`\n❌ Admin check failed: ${error.message}`);
    }

  } catch (error) {
    console.error("Status check failed:", error);
  }
}

// Main execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    quickStatusCheck()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    runTestQueries()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

export { runTestQueries, quickStatusCheck }; 