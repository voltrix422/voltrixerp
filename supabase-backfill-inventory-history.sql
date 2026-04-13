-- Backfill inventory history with existing transactions
-- This script creates historical records for items already received and delivered

-- 1. Add IN transactions for all received POs (items that came into inventory)
INSERT INTO erp_inventory_history (id, item_description, transaction_type, quantity, unit, reference_type, reference_id, reference_number, notes, created_at, created_by)
SELECT 
  gen_random_uuid()::text AS id,
  item->>'description' AS item_description,
  'in' AS transaction_type,
  (item->>'qty')::numeric AS quantity,
  item->>'unit' AS unit,
  'po' AS reference_type,
  po.id AS reference_id,
  po.po_number AS reference_number,
  CASE 
    WHEN po.type = 'imported' THEN 'Received from ' || COALESCE(po.imported_supplier_name, 'Supplier')
    ELSE 'Received from ' || COALESCE(po.supplier_names[1], 'Supplier')
  END AS notes,
  COALESCE(
    (SELECT fh->>'doneAt' FROM jsonb_array_elements(po.flow_history) AS fh WHERE fh->>'step' = 'Items Received' LIMIT 1),
    po.created_at
  )::timestamptz AS created_at,
  'System' AS created_by
FROM erp_purchase_orders po,
LATERAL jsonb_array_elements(
  CASE 
    WHEN po.type = 'imported' THEN po.imported_items
    ELSE po.items
  END
) AS item
WHERE po.status IN ('imp_inventory', 'in_inventory')
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(po.flow_history) AS fh 
    WHERE fh->>'step' = 'Items Received'
  )
ON CONFLICT (id) DO NOTHING;

-- 2. Add OUT transactions for all delivered orders (items that went out of inventory)
INSERT INTO erp_inventory_history (id, item_description, transaction_type, quantity, unit, reference_type, reference_id, reference_number, notes, created_at, created_by)
SELECT 
  gen_random_uuid()::text AS id,
  item->>'description' AS item_description,
  'out' AS transaction_type,
  (item->>'qty')::numeric AS quantity,
  item->>'unit' AS unit,
  'order' AS reference_type,
  o.id AS reference_id,
  o.order_number AS reference_number,
  'Delivered to ' || o.client_name AS notes,
  o.updated_at AS created_at,
  COALESCE(o.created_by, 'System') AS created_by
FROM erp_orders o,
LATERAL jsonb_array_elements(o.items) AS item
WHERE o.status = 'delivered'
ON CONFLICT (id) DO NOTHING;

-- Show summary of backfilled data
SELECT 
  transaction_type,
  COUNT(*) as transaction_count,
  SUM(quantity) as total_quantity
FROM erp_inventory_history
GROUP BY transaction_type
ORDER BY transaction_type;
