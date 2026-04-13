-- Add CRM Clients Table
CREATE TABLE IF NOT EXISTS erp_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  country TEXT DEFAULT '',
  website TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  contact_person TEXT DEFAULT '',
  image_url TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Add CRM Orders Table
CREATE TABLE IF NOT EXISTS erp_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT DEFAULT '',
  delivery_address TEXT DEFAULT '',
  delivery_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE erp_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON erp_clients;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON erp_orders;

-- Create policies to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON erp_clients
  FOR ALL USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON erp_orders
  FOR ALL USING (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_erp_clients_created_at ON erp_clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_clients_name ON erp_clients(name);

CREATE INDEX IF NOT EXISTS idx_erp_orders_created_at ON erp_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_orders_client_id ON erp_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_erp_orders_status ON erp_orders(status);
CREATE INDEX IF NOT EXISTS idx_erp_orders_order_number ON erp_orders(order_number);
