-- Seed data for testing delta ingestion

-- Insert Countries
INSERT INTO countries (code, name) VALUES 
    ('US', 'United States'),
    ('IN', 'India'),
    ('UK', 'United Kingdom'),
    ('CA', 'Canada'),
    ('AU', 'Australia')
ON CONFLICT (code) DO NOTHING;

-- Insert Customer Statuses
INSERT INTO customer_status (code, name) VALUES 
    ('ACTIVE', 'Active Customer'),
    ('INACTIVE', 'Inactive Customer'),
    ('PENDING', 'Pending Verification'),
    ('SUSPENDED', 'Suspended Account')
ON CONFLICT (code) DO NOTHING;

-- Insert some existing customers for delta testing
INSERT INTO customers (external_id, name, email, country_id, status_id) VALUES 
    ('cust_001', 'Alice Johnson', 'alice@example.com', 
     (SELECT id FROM countries WHERE code = 'US'), 
     (SELECT id FROM customer_status WHERE code = 'ACTIVE')),
    ('cust_002', 'Bob Smith', 'bob@example.com', 
     (SELECT id FROM countries WHERE code = 'IN'), 
     (SELECT id FROM customer_status WHERE code = 'ACTIVE')),
    ('cust_003', 'Charlie Brown', 'charlie@example.com', 
     (SELECT id FROM countries WHERE code = 'UK'), 
     (SELECT id FROM customer_status WHERE code = 'INACTIVE'))
ON CONFLICT (external_id) DO NOTHING;