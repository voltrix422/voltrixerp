-- Add missing columns to erp_purchase_orders table
ALTER TABLE erp_purchase_orders
DROP COLUMN IF EXISTS supplier_id,
DROP COLUMN IF EXISTS supplier_name,
ADD COLUMN IF NOT EXISTS supplier_ids text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS supplier_names text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS receiving_location text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS suppliers_sent jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS quotes jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS finalized_supplier_id text,
ADD COLUMN IF NOT EXISTS payments jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS payment_amount numeric,
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_date text,
ADD COLUMN IF NOT EXISTS payment_proof text,
ADD COLUMN IF NOT EXISTS payment_notes text,
ADD COLUMN IF NOT EXISTS admin_documents jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS finance_documents_1 jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS purchase_documents jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS finance_documents_2 jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS pssid text,
ADD COLUMN IF NOT EXISTS imported_supplier_name text,
ADD COLUMN IF NOT EXISTS imported_items jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS flow_history jsonb NOT NULL DEFAULT '[]';

-- Add missing columns to erp_suppliers table
ALTER TABLE erp_suppliers
ADD COLUMN IF NOT EXISTS bank_account_name text,
ADD COLUMN IF NOT EXISTS bank_iban text;
