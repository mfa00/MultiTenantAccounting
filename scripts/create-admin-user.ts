#!/usr/bin/env tsx

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";

async function createAdminUser() {
  console.log("👤 Creating Admin User with Proper Password Hashing...\n");

  try {
    // Check if admin user already exists
    console.log("🔍 Checking for existing admin user...");
    const existingAdmin = await db.execute(sql`
      SELECT username, global_role FROM users WHERE username = 'admin'
    `);

    if (existingAdmin.rows.length > 0) {
      console.log("   ⚠️  Admin user already exists!");
      console.log(`   👤 Username: ${existingAdmin.rows[0].username}`);
      console.log(`   🔑 Role: ${existingAdmin.rows[0].global_role}`);
      
      // Test the password
      console.log("\n🧪 Testing current admin password...");
      const userResult = await db.execute(sql`
        SELECT password FROM users WHERE username = 'admin'
      `);
      
      if (userResult.rows.length > 0) {
        const storedHash = userResult.rows[0].password as string;
        const isValid = await bcrypt.compare('admin123', storedHash);
        
        if (isValid) {
          console.log("   ✅ Password 'admin123' works correctly!");
          return;
        } else {
          console.log("   ❌ Password 'admin123' doesn't work!");
          console.log("   🔄 Updating password hash...");
          
          const newHash = await bcrypt.hash('admin123', 10);
          await db.execute(sql`
            UPDATE users SET password = ${newHash} WHERE username = 'admin'
          `);
          console.log("   ✅ Password updated successfully!");
        }
      }
      return;
    }

    // Create proper password hash
    console.log("🔐 Generating secure password hash...");
    const passwordHash = await bcrypt.hash('admin123', 10);
    console.log(`   Generated hash: ${passwordHash.substring(0, 20)}...`);

    // Create admin user
    console.log("\n👤 Creating admin user...");
    await db.execute(sql`
      INSERT INTO users (username, email, password, first_name, last_name, global_role, is_active)
      VALUES (
        'admin',
        'admin@multitenant.com',
        ${passwordHash},
        'Global',
        'Administrator', 
        'global_administrator',
        true
      )
    `);
    console.log("   ✅ Admin user created successfully!");

    // Verify the user was created
    console.log("\n🔍 Verifying admin user...");
    const verifyResult = await db.execute(sql`
      SELECT id, username, email, first_name, last_name, global_role, is_active
      FROM users WHERE username = 'admin'
    `);

    if (verifyResult.rows.length > 0) {
      const admin = verifyResult.rows[0];
      console.log("   ✅ Admin user verified:");
      console.log(`      ID: ${admin.id}`);
      console.log(`      Username: ${admin.username}`);
      console.log(`      Email: ${admin.email}`);
      console.log(`      Name: ${admin.first_name} ${admin.last_name}`);
      console.log(`      Role: ${admin.global_role}`);
      console.log(`      Active: ${admin.is_active}`);

      // Test login
      console.log("\n🧪 Testing login credentials...");
      const loginTest = await db.execute(sql`
        SELECT password FROM users WHERE username = 'admin'
      `);
      
      if (loginTest.rows.length > 0) {
        const isValid = await bcrypt.compare('admin123', loginTest.rows[0].password as string);
        if (isValid) {
          console.log("   ✅ Login test successful!");
          console.log("   🎯 Credentials: admin / admin123");
        } else {
          console.log("   ❌ Login test failed!");
        }
      }
    }

  } catch (error) {
    console.error("❌ Failed to create admin user:", error);
    throw error;
  }
}

// Also create other users with correct hashes
async function createAllUsers() {
  console.log("\n👥 Creating All Sample Users...\n");

  const users = [
    {
      username: 'manager',
      email: 'manager@acme.com',
      password: 'manager123',
      firstName: 'John',
      lastName: 'Manager',
      globalRole: 'user'
    },
    {
      username: 'accountant', 
      email: 'accountant@techstart.com',
      password: 'accountant123',
      firstName: 'Sarah',
      lastName: 'Accountant',
      globalRole: 'user'
    },
    {
      username: 'assistant',
      email: 'assistant@globalconsulting.com',
      password: 'assistant123',
      firstName: 'Mike',
      lastName: 'Assistant',
      globalRole: 'user'
    }
  ];

  for (const user of users) {
    try {
      // Check if user exists
      const existing = await db.execute(sql`
        SELECT username FROM users WHERE username = ${user.username}
      `);

      if (existing.rows.length > 0) {
        console.log(`   ⚠️  User ${user.username} already exists, skipping...`);
        continue;
      }

      // Create password hash
      const passwordHash = await bcrypt.hash(user.password, 10);

      // Create user
      await db.execute(sql`
        INSERT INTO users (username, email, password, first_name, last_name, global_role, is_active)
        VALUES (
          ${user.username},
          ${user.email},
          ${passwordHash},
          ${user.firstName},
          ${user.lastName},
          ${user.globalRole},
          true
        )
      `);

      console.log(`   ✅ Created user: ${user.username} / ${user.password}`);

    } catch (error) {
      console.log(`   ❌ Failed to create user ${user.username}:`, error);
    }
  }
}

// Run the script
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  Promise.resolve()
    .then(createAdminUser)
    .then(createAllUsers)
    .then(() => {
      console.log("\n🎉 All users created successfully!");
      console.log("\n📋 Login Credentials:");
      console.log("==================");
      console.log("• Global Admin: admin / admin123");
      console.log("• Manager: manager / manager123"); 
      console.log("• Accountant: accountant / accountant123");
      console.log("• Assistant: assistant / assistant123");
      console.log("\n✨ Ready to login!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to create users:", error);
      process.exit(1);
    });
}

export { createAdminUser, createAllUsers }; 