import { db } from '../server/db';
import { users, companies, userCompanies } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testCompanyUsers() {
  try {
    console.log('🔍 Testing Company Users Data...\n');

    // 1. Check all companies
    console.log('📊 Companies:');
    const allCompanies = await db.select().from(companies);
    allCompanies.forEach(company => {
      console.log(`  ${company.id}: ${company.name} (${company.code})`);
    });

    // 2. Check all users
    console.log('\n👥 Users:');
    const allUsers = await db.select().from(users);
    allUsers.forEach(user => {
      console.log(`  ${user.id}: ${user.username} (${user.firstName} ${user.lastName})`);
    });

    // 3. Check user-company assignments
    console.log('\n🔗 User-Company Assignments:');
    const assignments = await db
      .select({
        userId: userCompanies.userId,
        companyId: userCompanies.companyId,
        role: userCompanies.role,
        isActive: userCompanies.isActive,
        userName: users.username,
        companyName: companies.name,
      })
      .from(userCompanies)
      .innerJoin(users, eq(userCompanies.userId, users.id))
      .innerJoin(companies, eq(userCompanies.companyId, companies.id));

    assignments.forEach(assignment => {
      console.log(`  User: ${assignment.userName} → Company: ${assignment.companyName} (Role: ${assignment.role}, Active: ${assignment.isActive})`);
    });

    // 4. Test the new API logic for company ID 1
    console.log('\n🧪 Testing API Logic for Company ID 1:');
    const companyId = 1;
    
    const companyUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: userCompanies.role,
        isActive: userCompanies.isActive,
        joinedAt: userCompanies.createdAt,
      })
      .from(userCompanies)
      .innerJoin(users, eq(userCompanies.userId, users.id))
      .where(eq(userCompanies.companyId, companyId));

    console.log(`Found ${companyUsers.length} users for company ID ${companyId}:`);
    companyUsers.forEach(user => {
      console.log(`  - ${user.firstName} ${user.lastName} (@${user.username}) - Role: ${user.role}`);
    });

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testCompanyUsers(); 