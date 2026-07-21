-- PSW multi customs duties + GD SROs on import shipments
ALTER TABLE "erp_import_shipments" ADD COLUMN IF NOT EXISTS "customs_duties" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "erp_import_shipments" ADD COLUMN IF NOT EXISTS "gd_sros" JSONB NOT NULL DEFAULT '[]';
