-- Multi-Tenant Accounting System - Global Administration Setup
-- This script creates initial data for global administration functionality

-- 1. Create Global Administrator User
INSERT INTO users (username, email, password, first_name, last_name, global_role, is_active)
VALUES (
  'admin',
  'admin@multitenant.com',
  '$2b$10$rOsJzgfQNdhpn2x9zcGH5uQn3.qW5vZhXUmKf2.0VePtLXbC9qHLO', -- password: admin123
  'Global',
  'Administrator',
  'global_administrator',
  true
) ON CONFLICT (username) DO NOTHING;

-- 2. Create Sample Companies
INSERT INTO companies (name, code, address, phone, email, tax_id, fiscal_year_start, currency, is_active)
VALUES 
  (
    'ACME Corporation',
    'ACME',
    '123 Business St, New York, NY 10001',
    '+1-555-0123',
    'contact@acme.com',
    '12-3456789',
    1,
    'USD',
    true
  ),
  (
    'TechStart Inc',
    'TECH',
    '456 Innovation Ave, San Francisco, CA 94105',
    '+1-555-0456',
    'hello@techstart.com',
    '98-7654321',
    1,
    'USD',
    true
  ),
  (
    'Global Consulting LLC',
    'GCLLC',
    '789 Consulting Blvd, Chicago, IL 60601',
    '+1-555-0789',
    'info@globalconsulting.com',
    '11-2233445',
    4,
    'USD',
    true
  )
ON CONFLICT (code) DO NOTHING;

-- 3. Create Additional Users
INSERT INTO users (username, email, password, first_name, last_name, global_role, is_active)
VALUES 
  (
    'manager',
    'manager@acme.com',
    '$2b$10$rOsJzgfQNdhpn2x9zcGH5uQn3.qW5vZhXUmKf2.0VePtLXbC9qHLO', -- password: manager123
    'John',
    'Manager',
    'user',
    true
  ),
  (
    'accountant',
    'accountant@techstart.com',
    '$2b$10$rOsJzgfQNdhpn2x9zcGH5uQn3.qW5vZhXUmKf2.0VePtLXbC9qHLO', -- password: accountant123
    'Sarah',
    'Accountant',
    'user',
    true
  ),
  (
    'assistant',
    'assistant@globalconsulting.com',
    '$2b$10$rOsJzgfQNdhpn2x9zcGH5uQn3.qW5vZhXUmKf2.0VePtLXbC9qHLO', -- password: assistant123
    'Mike',
    'Assistant',
    'user',
    true
  )
ON CONFLICT (username) DO NOTHING;

-- 4. Assign Admin to All Companies
INSERT INTO user_companies (user_id, company_id, role, is_active)
SELECT u.id, c.id, 'administrator', true
FROM users u, companies c
WHERE u.username = 'admin'
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 5. Assign Users to Specific Companies
INSERT INTO user_companies (user_id, company_id, role, is_active)
SELECT u.id, c.id, 'manager', true
FROM users u, companies c
WHERE u.username = 'manager' AND c.code = 'ACME'
ON CONFLICT (user_id, company_id) DO NOTHING;

INSERT INTO user_companies (user_id, company_id, role, is_active)
SELECT u.id, c.id, 'accountant', true
FROM users u, companies c
WHERE u.username = 'accountant' AND c.code = 'TECH'
ON CONFLICT (user_id, company_id) DO NOTHING;

INSERT INTO user_companies (user_id, company_id, role, is_active)
SELECT u.id, c.id, 'assistant', true
FROM users u, companies c
WHERE u.username = 'assistant' AND c.code = 'GCLLC'
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 6. Create Chart of Accounts for All Companies
-- Assets
INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '1000', 'Cash', 'asset', 'current_asset', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '1100', 'Accounts Receivable', 'asset', 'current_asset', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '1200', 'Inventory', 'asset', 'current_asset', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '1500', 'Equipment', 'asset', 'fixed_asset', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '1600', 'Accumulated Depreciation - Equipment', 'asset', 'fixed_asset', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

-- Liabilities
INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '2000', 'Accounts Payable', 'liability', 'current_liability', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '2100', 'Accrued Expenses', 'liability', 'current_liability', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '2500', 'Long-term Debt', 'liability', 'long_term_liability', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

-- Equity
INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '3000', 'Owner''s Equity', 'equity', 'capital', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '3100', 'Retained Earnings', 'equity', 'retained_earnings', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

-- Revenue
INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '4000', 'Sales Revenue', 'revenue', 'operating_revenue', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '4100', 'Service Revenue', 'revenue', 'operating_revenue', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

-- Expenses
INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '5000', 'Cost of Goods Sold', 'expense', 'cost_of_sales', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '6000', 'Office Expenses', 'expense', 'operating_expense', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '6100', 'Rent Expense', 'expense', 'operating_expense', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '6200', 'Utilities Expense', 'expense', 'operating_expense', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '6300', 'Insurance Expense', 'expense', 'operating_expense', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, sub_type, is_active)
SELECT id, '6400', 'Depreciation Expense', 'expense', 'operating_expense', true FROM companies
ON CONFLICT (company_id, code) DO NOTHING;

-- 7. Log Initial Setup Activity
INSERT INTO activity_logs (user_id, action, resource, details, ip_address, user_agent, timestamp)
SELECT u.id, 'SYSTEM_SETUP', 'DATABASE', 'Initial database setup with sample data', '127.0.0.1', 'Setup Script', NOW()
FROM users u
WHERE u.username = 'admin'
ON CONFLICT DO NOTHING;

-- 8. Display Setup Summary
SELECT 
    'SETUP COMPLETE' as status,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM companies) as total_companies,
    (SELECT COUNT(*) FROM user_companies) as user_company_assignments,
    (SELECT COUNT(*) FROM accounts) as total_accounts; 