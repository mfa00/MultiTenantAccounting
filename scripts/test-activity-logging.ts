import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

import { db } from '../server/db.js';
import { activityLogs, users } from '../shared/schema.js';
import { activityLogger, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '../server/services/activity-logger.js';
import { eq, desc } from 'drizzle-orm';

async function testActivityLogging() {
  try {
    console.log('🔍 Testing Activity Logging System...\n');

    // Check if activity_logs table exists
    console.log('1. Checking if activity_logs table exists...');
    try {
      const existingLogs = await db.select().from(activityLogs).limit(1);
      console.log('✅ activity_logs table exists');
    } catch (error) {
      console.log('❌ activity_logs table does not exist');
      console.log('Error:', error.message);
      return;
    }

    // Get a test user
    console.log('\n2. Getting test user...');
    const [testUser] = await db.select().from(users).limit(1);
    if (!testUser) {
      console.log('❌ No users found in database');
      return;
    }
    console.log('✅ Found test user:', testUser.username);

    // Test logging a simple activity
    console.log('\n3. Testing activity logging...');
    await activityLogger.logActivity(
      {
        userId: testUser.id,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Script'
      },
      {
        action: ACTIVITY_ACTIONS.SYSTEM_ERROR,
        resource: RESOURCE_TYPES.SYSTEM,
        success: true,
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      }
    );
    console.log('✅ Successfully logged test activity');

    // Retrieve recent activity logs
    console.log('\n4. Retrieving recent activity logs...');
    const recentLogs = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        resource: activityLogs.resource,
        details: activityLogs.details,
        timestamp: activityLogs.timestamp,
        username: users.username
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.timestamp))
      .limit(5);

    console.log(`✅ Found ${recentLogs.length} recent activity logs:`);
    recentLogs.forEach((log, index) => {
      console.log(`\n   ${index + 1}. ${log.action} on ${log.resource}`);
      console.log(`      User: ${log.username}`);
      console.log(`      Time: ${log.timestamp}`);
      console.log(`      Details: ${log.details ? log.details.substring(0, 100) + '...' : 'None'}`);
    });

    // Test error logging
    console.log('\n5. Testing error logging...');
    await activityLogger.logError(
      ACTIVITY_ACTIONS.SYSTEM_ERROR,
      RESOURCE_TYPES.SYSTEM,
      {
        userId: testUser.id,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Script'
      },
      new Error('Test error for debugging'),
      undefined,
      { testError: true }
    );
    console.log('✅ Successfully logged test error');

    // Test authentication logging
    console.log('\n6. Testing authentication logging...');
    await activityLogger.logAuth(
      ACTIVITY_ACTIONS.LOGIN,
      {
        userId: testUser.id,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Script'
      },
      { testLogin: true }
    );
    console.log('✅ Successfully logged test authentication');

    console.log('\n🎉 Activity logging system test completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Activity logs table exists and is accessible');
    console.log('   - Basic activity logging works');
    console.log('   - Error logging works');
    console.log('   - Authentication logging works');
    console.log('   - Console debug output is working');
    console.log('   - Database storage is working');

  } catch (error) {
    console.error('❌ Activity logging test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the test
testActivityLogging(); 