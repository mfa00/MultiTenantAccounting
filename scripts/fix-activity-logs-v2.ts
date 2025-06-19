#!/usr/bin/env tsx --env-file=.env

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function fixActivityLogs() {
  try {
    console.log('🔧 Creating activity_logs table...');
    
    // Create table
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
    console.log('✅ Table created');
    
    // Create indexes one by one
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)`);
    console.log('✅ Index 1 created');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp)`);
    console.log('✅ Index 2 created');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource)`);
    console.log('✅ Index 3 created');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)`);
    console.log('✅ Index 4 created');
    
    // Insert sample data
    await db.execute(sql`
      INSERT INTO activity_logs (user_id, action, resource, resource_id, details, ip_address, timestamp) VALUES
      (3, 'LOGIN', 'USER', 3, 'User logged in successfully', '127.0.0.1', NOW() - INTERVAL '1 hour')
      ON CONFLICT DO NOTHING
    `);
    
    await db.execute(sql`
      INSERT INTO activity_logs (user_id, action, resource, resource_id, details, ip_address, timestamp) VALUES
      (3, 'VIEW', 'COMPANY', 2, 'Viewed company: Global Trading Ltd', '127.0.0.1', NOW() - INTERVAL '45 minutes')
      ON CONFLICT DO NOTHING
    `);
    
    await db.execute(sql`
      INSERT INTO activity_logs (user_id, action, resource, resource_id, details, ip_address, timestamp) VALUES
      (3, 'EDIT', 'COMPANY', 5, 'Updated company information', '127.0.0.1', NOW() - INTERVAL '30 minutes')
      ON CONFLICT DO NOTHING
    `);
    
    console.log('✅ Sample data inserted');
    
    // Verify
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM activity_logs`);
    console.log(`📊 Activity logs table now has ${(result.rows?.[0] as any)?.count || 0} records`);
    
    console.log('🎉 activity_logs table fixed successfully!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  fixActivityLogs()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 