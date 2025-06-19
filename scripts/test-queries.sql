-- Test Queries for Global Administration
-- These queries test various aspects of the multi-tenant accounting system

-- 1. Verify Global Administrator Setup
SELECT 
    'Global Admin Check' as test_name,
    u.username,
    u.email,
    u.global_role,
    u.is_active
FROM users u 
WHERE u.global_role = 'global_administrator';

-- 2. Check All Companies and Their Assignments
SELECT 
    'Company Overview' as test_name,
    c.name as company_name,
    c.code as company_code,
    c.currency,
    c.fiscal_year_start,
    COUNT(uc.user_id) as user_count
FROM companies c
LEFT JOIN user_companies uc ON c.id = uc.company_id AND uc.is_active = true
GROUP BY c.id, c.name, c.code, c.currency, c.fiscal_year_start
ORDER BY c.name;

-- 3. User-Company Role Assignments
SELECT 
    'User Assignments' as test_name,
    u.username,
    u.first_name || ' ' || u.last_name as full_name,
    c.name as company_name,
    uc.role as company_role,
    uc.is_active
FROM users u
JOIN user_companies uc ON u.id = uc.user_id
JOIN companies c ON uc.company_id = c.id
ORDER BY u.username, c.name;

-- 4. Chart of Accounts Summary by Company
SELECT 
    'Chart of Accounts' as test_name,
    c.name as company_name,
    a.type as account_type,
    COUNT(*) as account_count
FROM companies c
JOIN accounts a ON c.id = a.company_id
WHERE a.is_active = true
GROUP BY c.id, c.name, a.type
ORDER BY c.name, a.type;

-- 5. Detailed Chart of Accounts
SELECT 
    'Account Details' as test_name,
    c.name as company_name,
    a.code,
    a.name as account_name,
    a.type,
    a.sub_type,
    a.is_active
FROM companies c
JOIN accounts a ON c.id = a.company_id
ORDER BY c.name, a.type, a.code;

-- 6. Global Administrator Access Check
SELECT 
    'Admin Access Check' as test_name,
    u.username as admin_user,
    COUNT(DISTINCT uc.company_id) as accessible_companies,
    STRING_AGG(DISTINCT c.name, ', ') as company_names
FROM users u
JOIN user_companies uc ON u.id = uc.user_id
JOIN companies c ON uc.company_id = c.id
WHERE u.global_role = 'global_administrator'
GROUP BY u.id, u.username;

-- 7. User Activity Summary
SELECT 
    'User Activity' as test_name,
    u.username,
    COUNT(al.id) as activity_count,
    MAX(al.timestamp) as last_activity
FROM users u
LEFT JOIN activity_logs al ON u.id = al.user_id
GROUP BY u.id, u.username
ORDER BY activity_count DESC;

-- 8. System Health Check
SELECT 
    'System Health' as test_name,
    'Users' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count
FROM users
UNION ALL
SELECT 
    'System Health' as test_name,
    'Companies' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count
FROM companies
UNION ALL
SELECT 
    'System Health' as test_name,
    'User Companies' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count
FROM user_companies
UNION ALL
SELECT 
    'System Health' as test_name,
    'Accounts' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count
FROM accounts;

-- 9. Role Distribution Analysis
SELECT 
    'Role Distribution' as test_name,
    uc.role,
    COUNT(*) as user_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM user_companies uc
WHERE uc.is_active = true
GROUP BY uc.role
ORDER BY user_count DESC;

-- 10. Company Balance (Basic)
SELECT 
    'Company Balance Check' as test_name,
    c.name as company_name,
    COUNT(CASE WHEN a.type = 'asset' THEN 1 END) as assets,
    COUNT(CASE WHEN a.type = 'liability' THEN 1 END) as liabilities,
    COUNT(CASE WHEN a.type = 'equity' THEN 1 END) as equity,
    COUNT(CASE WHEN a.type = 'revenue' THEN 1 END) as revenue,
    COUNT(CASE WHEN a.type = 'expense' THEN 1 END) as expenses
FROM companies c
LEFT JOIN accounts a ON c.id = a.company_id AND a.is_active = true
GROUP BY c.id, c.name
ORDER BY c.name; 