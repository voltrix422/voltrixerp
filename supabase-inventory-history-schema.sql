-- Inventory History/Transaction Log
-- Tracks all inventory movements (in from POs, out from orders)

CREATE TABLE IF NOT EXISTS erp_inventory_history (
  id TEXT PRIMARY KEY,
  item_description TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_inventory_history_item ON erp_inventory_history(item_description);
CREATE INDEX IF NOT EXISTS idx_inventory_history_type ON erp_inventory_history(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_history_created ON erp_inventory_history(created_at DESC);

-- Enable RLS
ALTER TABLE erp_inventory_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read inventory history" ON erp_inventory_history;
DROP POLICY IF EXISTS "Allow authenticated users to insert inventory history" ON erp_inventory_history;

-- Policy: Allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read inventory history"
  ON erp_inventory_history FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow all authenticated users to insert
CREATE POLICY "Allow authenticated users to insert inventory history"
  ON erp_inventory_history FOR INSERT
  TO authenticated
  WITH CHECK (true);