-- Simple fix for missing activity_logs table
-- Execute this SQL directly in your database

-- Create the activity_logs table
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
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- Insert sample activity logs for testing
INSERT INTO activity_logs (user_id, action, resource, resource_id, details, ip_address, timestamp) VALUES
(3, 'LOGIN', 'USER', 3, 'User logged in successfully', '127.0.0.1', NOW() - INTERVAL '1 hour'),
(3, 'VIEW', 'COMPANY', 2, 'Viewed company: Global Trading Ltd', '127.0.0.1', NOW() - INTERVAL '45 minutes'),
(3, 'EDIT', 'COMPANY', 5, 'Updated company information', '127.0.0.1', NOW() - INTERVAL '30 minutes'),
(3, 'CREATE', 'USER', 7, 'Created new user: assistant', '127.0.0.1', NOW() - INTERVAL '20 minutes'),
(3, 'VIEW', 'STATS', NULL, 'Accessed system statistics', '127.0.0.1', NOW() - INTERVAL '10 minutes')
ON CONFLICT DO NOTHING;

-- Verify the table was created
SELECT 'activity_logs table created successfully!' as status; 