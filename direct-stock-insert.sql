-- Direct SQL to insert stock record for the item
-- This bypasses the schema cache issue

-- First, let's check if the table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'erp_inventory%';

-- Insert the stock record directly
INSERT INTO erp_inventory_stock (
  id,
  po_id,
  po_number,
  item_id,
  description,
  unit,
  received_qty,
  available_qty,
  allocated_qty,
  cost_price,
  supplier_name,
  po_type,
  created_at,
  updated_at
) VALUES (
  'PO-0001-item1',
  (SELECT id FROM erp_purchase_orders WHERE po_number = 'PO-0001' LIMIT 1),
  'PO-0001',
  'item1',
  'item 1',
  'pcs',
  100,
  100,
  0,
  33.00,
  'Hassan Enterprises',
  'local',
  NOW(),
  NOW()
);

-- Verify the insert
SELECT * FROM erp_inventory_stock WHERE po_number = 'PO-0001';