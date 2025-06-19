-- Migration: Add company_settings table
-- This table stores all company-specific settings that were previously mock data

CREATE TABLE IF NOT EXISTS company_settings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Notification settings
  email_notifications BOOLEAN DEFAULT TRUE,
  invoice_reminders BOOLEAN DEFAULT TRUE,
  payment_alerts BOOLEAN DEFAULT TRUE,
  report_reminders BOOLEAN DEFAULT FALSE,
  system_updates BOOLEAN DEFAULT TRUE,
  
  -- Financial settings
  auto_numbering BOOLEAN DEFAULT TRUE,
  invoice_prefix TEXT DEFAULT 'INV',
  bill_prefix TEXT DEFAULT 'BILL',
  journal_prefix TEXT DEFAULT 'JE',
  decimal_places INTEGER DEFAULT 2,
  negative_format TEXT DEFAULT 'minus', -- 'minus', 'parentheses', 'color'
  date_format TEXT DEFAULT 'MM/DD/YYYY', -- 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'
  time_zone TEXT DEFAULT 'America/New_York',
  
  -- Security settings
  require_password_change BOOLEAN DEFAULT FALSE,
  password_expire_days INTEGER DEFAULT 90,
  session_timeout INTEGER DEFAULT 30, -- minutes
  enable_two_factor BOOLEAN DEFAULT FALSE,
  allow_multiple_sessions BOOLEAN DEFAULT TRUE,
  
  -- Integration settings
  bank_connection BOOLEAN DEFAULT FALSE,
  payment_gateway BOOLEAN DEFAULT FALSE,
  tax_service BOOLEAN DEFAULT FALSE,
  reporting_tools BOOLEAN DEFAULT FALSE,
  
  -- Backup settings
  auto_backup BOOLEAN DEFAULT FALSE,
  backup_frequency TEXT DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly'
  retention_days INTEGER DEFAULT 30,
  backup_location TEXT DEFAULT 'cloud', -- 'local', 'cloud'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS trigger_update_company_settings_updated_at ON company_settings;
DROP FUNCTION IF EXISTS update_company_settings_updated_at();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_settings_updated_at();

-- Insert default settings for existing companies
INSERT INTO company_settings (company_id)
SELECT id FROM companies
WHERE id NOT IN (SELECT company_id FROM company_settings WHERE company_id IS NOT NULL)
ON CONFLICT (company_id) DO NOTHING; 