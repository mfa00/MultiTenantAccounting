#!/usr/bin/env tsx --env-file=.env

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function fixActivityLogs() {
  try {
    console.log('🔧 Fixing missing activity_logs table...');
    
    // Step 1: Create the activity_logs table
    console.log('▶️  Creating activity_logs table...');
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          action TEXT NOT NULL,
          resource TEXT NOT NULL,
          resource_id INTEGER,
          details TEXT,
          ip_address TEXT,
          user_agent TEXT,
          timestamp TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `);
      console.log('✅ activity_logs table created successfully');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  activity_logs table already exists');
      } else {
        throw error;
      }
    }

    // Step 2: Create indexes
    console.log('▶️  Creating performance indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource)',
      'CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)'
    ];

    for (const indexSQL of indexes) {
      try {
        await db.execute(sql.raw(indexSQL));
        console.log(`✅ Index created: ${indexSQL.split(' ')[5]}`);
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  Index already exists: ${indexSQL.split(' ')[5]}`);
        } else {
          console.error(`❌ Error creating index: ${error.message}`);
        }
      }
    }

    // Step 3: Insert sample data
    console.log('▶️  Inserting sample activity data...');
    try {
      await db.execute(sql`
        INSERT INTO activity_logs (user_id, action, resource, resource_id, details, ip_address, timestamp) VALUES
        (3, 'LOGIN', 'USER', 3, 'User logged in successfully', '127.0.0.1', NOW() - INTERVAL '1 hour'),
        (3, 'VIEW', 'COMPANY', 2, 'Viewed company: Global Trading Ltd', '127.0.0.1', NOW() - INTERVAL '45 minutes'),
        (3, 'EDIT', 'COMPANY', 5, 'Updated company information', '127.0.0.1', NOW() - INTERVAL '30 minutes'),
        (3, 'CREATE', 'USER', 7, 'Created new user: assistant', '127.0.0.1', NOW() - INTERVAL '20 minutes'),
        (3, 'VIEW', 'STATS', NULL, 'Accessed system statistics', '127.0.0.1', NOW() - INTERVAL '10 minutes')
        ON CONFLICT DO NOTHING
      `);
      console.log('✅ Sample data inserted successfully');
    } catch (error: any) {
      console.warn(`⚠️  Could not insert sample data: ${error.message}`);
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