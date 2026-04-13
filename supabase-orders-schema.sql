-- CRM Orders Table
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
ALTER TABLE erp_orders ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON erp_orders
  FOR ALL USING (auth.role() = 'authenticated');

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_erp_orders_created_at ON erp_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_orders_client_id ON erp_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_erp_orders_status ON erp_orders(status);
CREATE INDEX IF NOT EXISTS idx_erp_orders_order_number ON erp_orders(order_number);
