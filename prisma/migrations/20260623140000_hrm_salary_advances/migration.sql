-- CreateTable
CREATE TABLE "hrm_salary_advances" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "reason" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'outstanding',
    "given_by" TEXT NOT NULL,
    "given_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recovered_at" TIMESTAMP(3),
    "recovered_in_month" TEXT,
    "proof_url" TEXT,
    "proof_name" TEXT,

    CONSTRAINT "hrm_salary_advances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hrm_salary_advances_staff_id_status_idx" ON "hrm_salary_advances"("staff_id", "status");

-- AddForeignKey
ALTER TABLE "hrm_salary_advances" ADD CONSTRAINT "hrm_salary_advances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "erp_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
