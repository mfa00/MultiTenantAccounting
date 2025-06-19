#!/usr/bin/env tsx

import { DatabaseValidationService } from "../server/db-validation";

async function main() {
  console.log("🔍 Testing schema validation...\n");
  
  // Test data samples
  const testData = {
    validUser: {
      username: "testuser",
      email: "test@example.com",
      password: "securepassword123",
      firstName: "Test",
      lastName: "User",
      globalRole: "user"
    },
    invalidUser: {
      username: "ab", // Too short
      email: "invalid-email",
      password: "123", // Too short
      firstName: "",
      lastName: "User"
    },
    validCompany: {
      name: "Test Company Ltd",
      code: "TESTCO",
      email: "contact@testco.com",
      currency: "USD",
      fiscalYearStart: 1
    },
    invalidCompany: {
      name: "",
      code: "invalid-code-with-special-chars!",
      email: "invalid-email",
      currency: "INVALID",
      fiscalYearStart: 15
    },
    validAccount: {
      companyId: 1,
      code: "1000",
      name: "Cash",
      type: "asset",
      subType: "current_asset"
    },
    invalidAccount: {
      companyId: 1,
      code: "",
      name: "",
      type: "invalid_type"
    }
  };

  console.log("Testing User Validation:");
  console.log("======================");
  
  // Test valid user
  const validUserResult = await DatabaseValidationService.validateUser(testData.validUser);
  console.log(`✅ Valid user: ${validUserResult.isValid ? 'PASS' : 'FAIL'}`);
  if (!validUserResult.isValid) {
    console.log("   Errors:", validUserResult.errors);
  }
  
  // Test invalid user
  const invalidUserResult = await DatabaseValidationService.validateUser(testData.invalidUser);
  console.log(`❌ Invalid user: ${!invalidUserResult.isValid ? 'PASS' : 'FAIL'}`);
  console.log("   Expected errors:", invalidUserResult.errors);
  
  console.log("\nTesting Company Validation:");
  console.log("===========================");
  
  // Test valid company
  const validCompanyResult = await DatabaseValidationService.validateCompany(testData.validCompany);
  console.log(`✅ Valid company: ${validCompanyResult.isValid ? 'PASS' : 'FAIL'}`);
  if (!validCompanyResult.isValid) {
    console.log("   Errors:", validCompanyResult.errors);
  }
  
  // Test invalid company
  const invalidCompanyResult = await DatabaseValidationService.validateCompany(testData.invalidCompany);
  console.log(`❌ Invalid company: ${!invalidCompanyResult.isValid ? 'PASS' : 'FAIL'}`);
  console.log("   Expected errors:", invalidCompanyResult.errors);
  
  console.log("\nTesting Account Validation:");
  console.log("===========================");
  
  // Test valid account
  const validAccountResult = await DatabaseValidationService.validateAccount(testData.validAccount);
  console.log(`✅ Valid account: ${validAccountResult.isValid ? 'PASS' : 'FAIL'}`);
  if (!validAccountResult.isValid) {
    console.log("   Errors:", validAccountResult.errors);
  }
  
  // Test invalid account
  const invalidAccountResult = await DatabaseValidationService.validateAccount(testData.invalidAccount);
  console.log(`❌ Invalid account: ${!invalidAccountResult.isValid ? 'PASS' : 'FAIL'}`);
  console.log("   Expected errors:", invalidAccountResult.errors);
  
  console.log("\nTesting Journal Entry Validation:");
  console.log("=================================");
  
  const validJournalEntry = {
    entry: {
      companyId: 1,
      entryNumber: "JE001",
      date: new Date(),
      description: "Test journal entry",
      totalAmount: "100.00",
      userId: 1
    },
    lines: [
      {
        journalEntryId: 1,
        accountId: 1,
        description: "Debit line",
        debitAmount: "100.00",
        creditAmount: "0.00"
      },
      {
        journalEntryId: 1,
        accountId: 2,
        description: "Credit line",
        debitAmount: "0.00",
        creditAmount: "100.00"
      }
    ]
  };
  
  const validJournalResult = await DatabaseValidationService.validateJournalEntry(validJournalEntry);
  console.log(`✅ Valid journal entry: ${validJournalResult.isValid ? 'PASS' : 'FAIL'}`);
  if (!validJournalResult.isValid) {
    console.log("   Errors:", validJournalResult.errors);
  }
  
  // Test unbalanced journal entry
  const unbalancedJournalEntry = {
    entry: {
      companyId: 1,
      entryNumber: "JE002",
      date: new Date(),
      description: "Unbalanced entry",
      totalAmount: "100.00",
      userId: 1
    },
    lines: [
      {
        journalEntryId: 1,
        accountId: 1,
        description: "Debit line",
        debitAmount: "100.00",
        creditAmount: "0.00"
      },
      {
        journalEntryId: 1,
        accountId: 2,
        description: "Credit line",
        debitAmount: "0.00",
        creditAmount: "50.00" // Unbalanced!
      }
    ]
  };
  
  const unbalancedResult = await DatabaseValidationService.validateJournalEntry(unbalancedJournalEntry);
  console.log(`❌ Unbalanced journal entry: ${!unbalancedResult.isValid ? 'PASS' : 'FAIL'}`);
  console.log("   Expected errors:", unbalancedResult.errors);
  
  console.log("\n📊 Validation Test Summary:");
  console.log("===========================");
  const allTests = [
    validUserResult.isValid,
    !invalidUserResult.isValid,
    validCompanyResult.isValid,
    !invalidCompanyResult.isValid,
    validAccountResult.isValid,
    !invalidAccountResult.isValid,
    validJournalResult.isValid,
    !unbalancedResult.isValid
  ];
  
  const passedTests = allTests.filter(Boolean).length;
  console.log(`Tests passed: ${passedTests}/${allTests.length}`);
  
  if (passedTests === allTests.length) {
    console.log("🎉 All validation tests passed!");
  } else {
    console.log("⚠️  Some validation tests failed!");
    process.exit(1);
  }
}

main().catch(error => {
  console.error("❌ Schema validation test failed:", error);
  process.exit(1);
}); 