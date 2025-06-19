#!/usr/bin/env tsx

import { DatabaseValidationService } from "../server/db-validation";

async function main() {
  console.log("🏥 Running database health check...\n");
  
  try {
    const healthCheck = await DatabaseValidationService.performHealthCheck();
    
    console.log(`Overall health: ${healthCheck.isHealthy ? '✅ Healthy' : '❌ Issues found'}`);
    console.log(`Connection time: ${healthCheck.performance.connectionTime}ms`);
    console.log(`Query time: ${healthCheck.performance.queryTime}ms`);
    
    console.log("\n📊 Schema Status:");
    console.log(`  Tables exist: ${healthCheck.schema.tablesExist ? '✅' : '❌'}`);
    console.log(`  Foreign keys valid: ${healthCheck.schema.foreignKeysValid ? '✅' : '❌'}`);
    console.log(`  Indexes optimal: ${healthCheck.schema.indexesOptimal ? '✅' : '❌'}`);
    
    if (healthCheck.issues.length > 0) {
      console.log("\n⚠️ Issues found:");
      healthCheck.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
    }
    
    // Get additional schema info
    const schemaInfo = await DatabaseValidationService.getSchemaInfo();
    console.log("\n📈 Database Info:");
    console.log(`  Database size: ${schemaInfo.size}`);
    console.log(`  PostgreSQL version: ${schemaInfo.version.split(' ')[0]} ${schemaInfo.version.split(' ')[1]}`);
    console.log(`  Tables: ${schemaInfo.tables.length}`);
    
    console.log("\n📋 Table Row Counts:");
    schemaInfo.tables.forEach(table => {
      console.log(`   ${table.name}: ${table.rowCount.toLocaleString()} rows`);
    });
    
    if (!healthCheck.isHealthy) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ Health check failed:", error);
    process.exit(1);
  }
}

main(); 