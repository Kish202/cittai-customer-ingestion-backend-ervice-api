-- Database Schema for Delta Ingestion Service

-- Lookup Table: Countries
CREATE TABLE IF NOT EXISTS countries (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lookup Table: Customer Status
CREATE TABLE IF NOT EXISTS customer_status (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main Table: Customers
CREATE TABLE IF NOT EXISTS customers (
    customer_id BIGSERIAL PRIMARY KEY,
    external_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    country_id BIGINT NOT NULL REFERENCES countries(id),
    status_id BIGINT NOT NULL REFERENCES customer_status(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient delta detection and lookups
CREATE INDEX IF NOT EXISTS idx_customers_external_id ON customers(external_id);
CREATE INDEX IF NOT EXISTS idx_customers_country_id ON customers(country_id);
CREATE INDEX IF NOT EXISTS idx_customers_status_id ON customers(status_id);
CREATE INDEX IF NOT EXISTS idx_countries_code ON countries(code);
CREATE INDEX IF NOT EXISTS idx_customer_status_code ON customer_status(code);

-- Comments for documentation
COMMENT ON TABLE customers IS 'Main customer table - destination for delta ingestion';
COMMENT ON COLUMN customers.external_id IS 'Unique identifier from source system - used for delta detection';
COMMENT ON INDEX idx_customers_external_id IS 'Critical for efficient delta detection using ANY() queries';