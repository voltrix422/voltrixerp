-- Add new columns to erp_orders table
ALTER TABLE erp_orders 
ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transport_cost NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transport_label TEXT DEFAULT 'Transport',
ADD COLUMN IF NOT EXISTS other_cost NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_cost_label TEXT DEFAULT 'Other',
ADD COLUMN IF NOT EXISTS dispatcher TEXT,
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]';

-- Update existing records to have default values
UPDATE erp_orders 
SET tax_percent = 0, 
    transport_cost = 0, 
    transport_label = 'Transport',
    other_cost = 0,
    other_cost_label = 'Other',
    payments = '[]'
WHERE tax_percent IS NULL 
   OR transport_cost IS NULL 
   OR other_cost IS NULL 
   OR payments IS NULL;
