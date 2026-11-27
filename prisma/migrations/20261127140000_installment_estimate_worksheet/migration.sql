-- Solar installment estimate worksheet snapshot (sizing + breakdown).
ALTER TABLE "erp_installment_estimates" ADD COLUMN IF NOT EXISTS "worksheet" JSONB NOT NULL DEFAULT '{}';
