#!/usr/bin/env tsx --env-file=.env

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function fixActivityLogs() {
  try {
    console.log('🔧 Fixing missing activity_logs table...');
    
    // Read the SQL file
    const sqlPath = resolve(import.meta.dirname, 'fix-activity-logs.sql');
    const sqlContent = readFileSync(sqlPath, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Executing ${statements.length} SQL statements...`);
    
    for (const statement of statements) {
      try {
        console.log(`▶️  Executing: ${statement.substring(0, 50)}...`);
        await db.execute(sql.raw(statement));
        console.log('✅ Statement executed successfully');
      } catch (error: any) {
        if (error.message.includes('already exists') || error.message.includes('relation exists')) {
          console.log('ℹ️  Table/index already exists, skipping...');
        } else {
          console.error(`❌ Error executing statement: ${error.message}`);
        }
      }
    }
    
    // Verify the table exists
    console.log('\n🔍 Verifying activity_logs table...');
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'activity_logs'
    `);
    
    if (result.rows && result.rows.length > 0) {
      console.log('✅ activity_logs table exists and is accessible');
      
      // Check if we have any data
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM activity_logs`);
      const count = (countResult.rows && countResult.rows[0] as any)?.count || 0;
      console.log(`📊 activity_logs table contains ${count} records`);
      
      console.log('\n🎉 Activity logs table fix completed successfully!');
      console.log('The Global Administration page should now work without errors.');
    } else {
      console.log('❌ activity_logs table still does not exist');
    }
    
  } catch (error: any) {
    console.error('❌ Error fixing activity_logs table:', error.message);
    console.error('💡 Full error details:', error);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  fixActivityLogs()
    .then(() => {
      console.log('\n✨ Activity logs fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
} 