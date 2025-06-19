import { db } from "../server/db";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log("🔄 Running company settings migration...");
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, "../migrations/002_company_settings.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");
    
    // Execute the migration
    await db.execute(migrationSQL as any);
    
    console.log("✅ Company settings migration completed successfully!");
    console.log("📝 Created company_settings table with all required columns");
    console.log("🔧 Added triggers for automatic updated_at timestamps");
    console.log("📊 Inserted default settings for existing companies");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log("🎉 All done! Company settings are now stored in the database.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }); 