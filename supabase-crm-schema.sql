-- CRM Clients Table
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

-- Enable Row Level Security
ALTER TABLE erp_clients ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON erp_clients
  FOR ALL USING (auth.role() = 'authenticated');

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_erp_clients_created_at ON erp_clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_clients_name ON erp_clients(name);
