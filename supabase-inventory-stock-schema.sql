  -- Create inventory stock table to track current available quantities
  -- This is separate from POs which show what was received
  CREATE TABLE IF NOT EXISTS erp_inventory_stock (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL,
    po_number TEXT NOT NULL,
    item_id TEXT NOT NULL,
    description TEXT NOT NULL,
    unit TEXT NOT NULL,
    received_qty NUMERIC(12,2) NOT NULL DEFAULT 0, -- Original quantity received
    available_qty NUMERIC(12,2) NOT NULL DEFAULT 0, -- Current available quantity
    allocated_qty NUMERIC(12,2) NOT NULL DEFAULT 0, -- Quantity allocated to orders
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    supplier_name TEXT DEFAULT '',
    po_type TEXT DEFAULT 'local', -- local or imported
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Enable Row Level Security
  ALTER TABLE erp_inventory_stock ENABLE ROW LEVEL SECURITY;

  -- Create policy to allow all operations
  DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON erp_inventory_stock;
  CREATE POLICY "Allow all operations for authenticated users" ON erp_inventory_stock
  FOR ALL USING (true);

  -- Create indexes for faster queries
  CREATE INDEX IF NOT EXISTS idx_inventory_stock_po_id ON erp_inventory_stock(po_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_stock_item_id ON erp_inventory_stock(item_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_stock_available_qty ON erp_inventory_stock(available_qty);
  CREATE INDEX IF NOT EXISTS idx_inventory_stock_created_at ON erp_inventory_stock(created_at DESC);
          pleasaa   