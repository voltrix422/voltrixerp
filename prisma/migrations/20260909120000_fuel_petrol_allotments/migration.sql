-- Petrol / fuel allotment for purchase module
CREATE TABLE IF NOT EXISTS "erp_fuel_vehicles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plate" TEXT NOT NULL DEFAULT '',
    "avg_km_per_liter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_fuel_vehicles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_fuel_vehicles_active_idx" ON "erp_fuel_vehicles"("active");

CREATE TABLE IF NOT EXISTS "erp_fuel_allotments" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "person_staff_id" TEXT,
    "person_name" TEXT NOT NULL,
    "person_user_id" TEXT,
    "amount_pkr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liters" DOUBLE PRECISION,
    "allotted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_proof_urls" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'allotted',
    "km_driven" DOUBLE PRECISION,
    "odometer_start" DOUBLE PRECISION,
    "odometer_end" DOUBLE PRECISION,
    "settlement_notes" TEXT NOT NULL DEFAULT '',
    "spending_proof_urls" JSONB NOT NULL DEFAULT '[]',
    "settled_at" TIMESTAMP(3),
    "settled_by" TEXT NOT NULL DEFAULT '',
    "allotted_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_fuel_allotments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_fuel_allotments_vehicle_id_idx" ON "erp_fuel_allotments"("vehicle_id");
CREATE INDEX IF NOT EXISTS "erp_fuel_allotments_person_staff_id_idx" ON "erp_fuel_allotments"("person_staff_id");
CREATE INDEX IF NOT EXISTS "erp_fuel_allotments_person_user_id_idx" ON "erp_fuel_allotments"("person_user_id");
CREATE INDEX IF NOT EXISTS "erp_fuel_allotments_status_idx" ON "erp_fuel_allotments"("status");
CREATE INDEX IF NOT EXISTS "erp_fuel_allotments_allotted_at_idx" ON "erp_fuel_allotments"("allotted_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'erp_fuel_allotments_vehicle_id_fkey'
  ) THEN
    ALTER TABLE "erp_fuel_allotments"
      ADD CONSTRAINT "erp_fuel_allotments_vehicle_id_fkey"
      FOREIGN KEY ("vehicle_id") REFERENCES "erp_fuel_vehicles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
