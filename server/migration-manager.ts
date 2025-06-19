import { db } from "./db";
import { sql } from "drizzle-orm";
import { DatabaseValidationService } from "./db-validation";
import fs from "fs/promises";
import path from "path";

export interface Migration {
  id: string;
  name: string;
  version: number;
  up: string;
  down: string;
  checksum: string;
  appliedAt?: Date;
}

export interface MigrationResult {
  success: boolean;
  migrationsApplied: string[];
  errors: string[];
  rollbacksPerformed: string[];
}

/**
 * Safe migration management system
 */
export class MigrationManager {
  private static readonly MIGRATIONS_TABLE = "_migrations";

  /**
   * Initialize migration tracking table
   */
  static async initialize(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(this.MIGRATIONS_TABLE)} (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          version INTEGER NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          applied_at TIMESTAMP DEFAULT NOW(),
          execution_time_ms INTEGER,
          UNIQUE(version)
        )
      `);
    } catch (error) {
      throw new Error(`Failed to initialize migrations table: ${error}`);
    }
  }

  /**
   * Get all pending migrations
   */
  static async getPendingMigrations(): Promise<Migration[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.loadMigrationFiles();
    
    return availableMigrations.filter(
      migration => !appliedMigrations.find(applied => applied.id === migration.id)
    );
  }

  /**
   * Get all applied migrations
   */
  static async getAppliedMigrations(): Promise<Migration[]> {
    try {
      const result = await db.execute(sql`
        SELECT id, name, version, checksum, applied_at
        FROM ${sql.identifier(this.MIGRATIONS_TABLE)}
        ORDER BY version ASC
      `);

      return result.rows.map(row => ({
        id: row.id as string,
        name: row.name as string,
        version: row.version as number,
        checksum: row.checksum as string,
        appliedAt: row.applied_at as Date,
        up: "", // Not stored in DB
        down: "" // Not stored in DB
      }));
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  /**
   * Run all pending migrations
   */
  static async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migrationsApplied: [],
      errors: [],
      rollbacksPerformed: []
    };

    try {
      await this.initialize();
      
      // Perform health check before migrations
      const healthCheck = await DatabaseValidationService.performHealthCheck();
      if (!healthCheck.isHealthy) {
        result.errors.push(`Database health check failed: ${healthCheck.issues.join(', ')}`);
        result.success = false;
        return result;
      }

      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        console.log("No pending migrations");
        return result;
      }

      console.log(`Found ${pendingMigrations.length} pending migrations`);

      for (const migration of pendingMigrations) {
        try {
          await this.applyMigration(migration);
          result.migrationsApplied.push(migration.id);
          console.log(`✓ Applied migration: ${migration.name}`);
        } catch (error) {
          console.error(`✗ Failed to apply migration ${migration.name}:`, error);
          result.errors.push(`${migration.name}: ${error}`);
          result.success = false;
          
          // Attempt rollback
          try {
            await this.rollbackMigration(migration);
            result.rollbacksPerformed.push(migration.id);
            console.log(`✓ Rolled back migration: ${migration.name}`);
          } catch (rollbackError) {
            console.error(`✗ Failed to rollback ${migration.name}:`, rollbackError);
            result.errors.push(`Rollback failed for ${migration.name}: ${rollbackError}`);
          }
          
          break; // Stop on first failure
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Migration process failed: ${error}`);
    }

    return result;
  }

  /**
   * Apply a single migration
   */
  private static async applyMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();
    
    await db.transaction(async (tx) => {
      try {
        // Execute the migration SQL
        await tx.execute(sql.raw(migration.up));
        
        // Record the migration
        const executionTime = Date.now() - startTime;
        await tx.execute(sql`
          INSERT INTO ${sql.identifier(this.MIGRATIONS_TABLE)} 
          (id, name, version, checksum, execution_time_ms)
          VALUES (${migration.id}, ${migration.name}, ${migration.version}, ${migration.checksum}, ${executionTime})
        `);
        
      } catch (error) {
        throw new Error(`Migration execution failed: ${error}`);
      }
    });
  }

  /**
   * Rollback a migration
   */
  private static async rollbackMigration(migration: Migration): Promise<void> {
    await db.transaction(async (tx) => {
      try {
        // Execute rollback SQL
        await tx.execute(sql.raw(migration.down));
        
        // Remove migration record
        await tx.execute(sql`
          DELETE FROM ${sql.identifier(this.MIGRATIONS_TABLE)}
          WHERE id = ${migration.id}
        `);
        
      } catch (error) {
        throw new Error(`Migration rollback failed: ${error}`);
      }
    });
  }

  /**
   * Load migration files from filesystem
   */
  private static async loadMigrationFiles(): Promise<Migration[]> {
    const migrationsDir = path.join(process.cwd(), "migrations");
    
    try {
      await fs.access(migrationsDir);
    } catch {
      // Create migrations directory if it doesn't exist
      await fs.mkdir(migrationsDir, { recursive: true });
      return [];
    }

    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files.filter(f => f.endsWith('.sql'));
    
    const migrations: Migration[] = [];
    
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      const migration = this.parseMigrationFile(file, content);
      if (migration) {
        migrations.push(migration);
      }
    }
    
    return migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Parse migration file content
   */
  private static parseMigrationFile(filename: string, content: string): Migration | null {
    try {
      // Expected format: 001_migration_name.sql
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        console.warn(`Skipping invalid migration filename: ${filename}`);
        return null;
      }

      const version = parseInt(match[1]);
      const name = match[2].replace(/_/g, ' ');

      // Split UP and DOWN sections
      const sections = content.split('-- DOWN');
      if (sections.length !== 2) {
        throw new Error(`Migration ${filename} must have both UP and DOWN sections`);
      }

      const up = sections[0].replace('-- UP', '').trim();
      const down = sections[1].trim();

      // Generate checksum
      const checksum = this.generateChecksum(content);

      return {
        id: filename,
        name,
        version,
        up,
        down,
        checksum
      };

    } catch (error) {
      console.error(`Failed to parse migration ${filename}:`, error);
      return null;
    }
  }

  /**
   * Generate migration file
   */
  static async generateMigration(name: string, upSQL: string, downSQL: string): Promise<string> {
    const migrationsDir = path.join(process.cwd(), "migrations");
    await fs.mkdir(migrationsDir, { recursive: true });

    // Get next version number
    const existing = await this.loadMigrationFiles();
    const nextVersion = existing.length > 0 ? Math.max(...existing.map(m => m.version)) + 1 : 1;
    
    const filename = `${nextVersion.toString().padStart(3, '0')}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filePath = path.join(migrationsDir, filename);

    const content = `-- UP\n${upSQL}\n\n-- DOWN\n${downSQL}\n`;
    
    await fs.writeFile(filePath, content, 'utf-8');
    
    return filename;
  }

  /**
   * Create schema backup before migrations
   */
  static async createSchemaBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `schema_backup_${timestamp}`;
    
    try {
      // This would need to be adapted based on your database setup
      // For now, we'll create a simple table listing
      const tables = await DatabaseValidationService.getSchemaInfo();
      const backupData = {
        timestamp: new Date().toISOString(),
        tables: tables.tables,
        version: tables.version
      };
      
      const backupsDir = path.join(process.cwd(), "backups");
      await fs.mkdir(backupsDir, { recursive: true });
      
      const backupPath = path.join(backupsDir, `${backupName}.json`);
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
      
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create schema backup: ${error}`);
    }
  }

  /**
   * Generate checksum for migration content
   */
  private static generateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Get migration status
   */
  static async getStatus(): Promise<{
    applied: Migration[];
    pending: Migration[];
    healthCheck: any;
  }> {
    const [applied, pending, healthCheck] = await Promise.all([
      this.getAppliedMigrations(),
      this.getPendingMigrations(),
      DatabaseValidationService.performHealthCheck()
    ]);

    return { applied, pending, healthCheck };
  }
}

/**
 * CLI helper for migration operations
 */
export class MigrationCLI {
  static async status(): Promise<void> {
    console.log("🔍 Checking migration status...\n");
    
    const status = await MigrationManager.getStatus();
    
    console.log(`✅ Applied migrations: ${status.applied.length}`);
    status.applied.forEach(m => {
      console.log(`   ${m.version}: ${m.name} (${m.appliedAt?.toISOString()})`);
    });
    
    console.log(`\n⏳ Pending migrations: ${status.pending.length}`);
    status.pending.forEach(m => {
      console.log(`   ${m.version}: ${m.name}`);
    });
    
    console.log(`\n🏥 Database health: ${status.healthCheck.isHealthy ? '✅ Healthy' : '❌ Issues found'}`);
    if (!status.healthCheck.isHealthy) {
      status.healthCheck.issues.forEach((issue: string) => {
        console.log(`   ⚠️  ${issue}`);
      });
    }
  }

  static async migrate(): Promise<void> {
    console.log("🚀 Running migrations...\n");
    
    const result = await MigrationManager.migrate();
    
    if (result.success) {
      console.log(`✅ Successfully applied ${result.migrationsApplied.length} migrations`);
    } else {
      console.log(`❌ Migration failed with ${result.errors.length} errors`);
      result.errors.forEach(error => console.log(`   ❌ ${error}`));
    }
    
    if (result.rollbacksPerformed.length > 0) {
      console.log(`🔄 Performed ${result.rollbacksPerformed.length} rollbacks`);
    }
  }

  static async generate(name: string): Promise<void> {
    const upSQL = `-- Add your UP migration SQL here
-- Example:
-- CREATE TABLE example_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL
-- );`;

    const downSQL = `-- Add your DOWN migration SQL here
-- Example:
-- DROP TABLE IF EXISTS example_table;`;

    const filename = await MigrationManager.generateMigration(name, upSQL, downSQL);
    console.log(`✅ Generated migration: ${filename}`);
    console.log("📝 Edit the file to add your SQL statements");
  }
} 