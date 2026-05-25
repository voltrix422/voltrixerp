-- Standalone Odoo-style accounting module

CREATE TABLE "acct_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "company_name" TEXT NOT NULL DEFAULT 'Voltrix Batteries',
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "fiscal_year_start" INTEGER NOT NULL DEFAULT 7,
    "lock_date" TIMESTAMP(3),
    "invoice_terms" TEXT NOT NULL DEFAULT '',
    "seeded_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acct_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acct_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "parent_code" TEXT NOT NULL DEFAULT '',
    "reconcile" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acct_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acct_accounts_code_key" ON "acct_accounts"("code");
CREATE INDEX "acct_accounts_account_type_idx" ON "acct_accounts"("account_type");

CREATE TABLE "acct_journals" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "journal_type" TEXT NOT NULL,
    "default_account_id" TEXT NOT NULL DEFAULT '',
    "sequence_prefix" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "acct_journals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acct_journals_code_key" ON "acct_journals"("code");

CREATE TABLE "acct_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partner_type" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "tax_id" TEXT NOT NULL DEFAULT '',
    "credit_limit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acct_partners_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acct_partners_partner_type_idx" ON "acct_partners"("partner_type");

CREATE TABLE "acct_taxes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "tax_type" TEXT NOT NULL,
    "account_code" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "acct_taxes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acct_payment_terms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "acct_payment_terms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acct_analytic_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'Projects',
    CONSTRAINT "acct_analytic_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acct_moves" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "journal_id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL DEFAULT '',
    "ref" TEXT NOT NULL DEFAULT '',
    "move_type" TEXT NOT NULL DEFAULT 'entry',
    "state" TEXT NOT NULL DEFAULT 'draft',
    "amount_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "narration" TEXT NOT NULL DEFAULT '',
    "invoice_id" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMP(3),
    CONSTRAINT "acct_moves_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acct_moves_journal_id_date_idx" ON "acct_moves"("journal_id", "date");
CREATE INDEX "acct_moves_state_idx" ON "acct_moves"("state");

CREATE TABLE "acct_move_lines" (
    "id" TEXT NOT NULL,
    "move_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analytic_code" TEXT NOT NULL DEFAULT '',
    "tax_id" TEXT NOT NULL DEFAULT '',
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "acct_move_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "acct_move_lines_move_id_fkey" FOREIGN KEY ("move_id") REFERENCES "acct_moves"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "acct_move_lines_move_id_idx" ON "acct_move_lines"("move_id");
CREATE INDEX "acct_move_lines_account_id_idx" ON "acct_move_lines"("account_id");

CREATE TABLE "acct_invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL DEFAULT '',
    "invoice_type" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "payment_term_id" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'draft',
    "amount_untaxed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_residual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "narration" TEXT NOT NULL DEFAULT '',
    "move_id" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acct_invoices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acct_invoices_invoice_type_state_idx" ON "acct_invoices"("invoice_type", "state");

CREATE TABLE "acct_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL DEFAULT '',
    "account_code" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "tax_id" TEXT NOT NULL DEFAULT '',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "acct_invoice_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "acct_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "acct_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "acct_invoice_lines_invoice_id_idx" ON "acct_invoice_lines"("invoice_id");

CREATE TABLE "acct_payments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "payment_type" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "journal_id" TEXT NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'draft',
    "invoice_ids" JSONB NOT NULL DEFAULT '[]',
    "move_id" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acct_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acct_payments_payment_type_state_idx" ON "acct_payments"("payment_type", "state");

CREATE TABLE "acct_bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL DEFAULT '',
    "bank_name" TEXT NOT NULL DEFAULT '',
    "journal_id" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "acct_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acct_bank_statements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "balance_start" DOUBLE PRECISION NOT NULL,
    "balance_end" DOUBLE PRECISION NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acct_bank_statements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acct_bank_statement_lines" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "payment_ref" TEXT NOT NULL DEFAULT '',
    "partner_name" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "move_line_id" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "acct_bank_statement_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "acct_bank_statement_lines_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "acct_bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "acct_bank_statement_lines_statement_id_idx" ON "acct_bank_statement_lines"("statement_id");

CREATE TABLE "acct_assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "original_value" DOUBLE PRECISION NOT NULL,
    "salvage_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL DEFAULT 'linear',
    "duration_months" INTEGER NOT NULL DEFAULT 36,
    "acquisition_date" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "depreciation_account_code" TEXT NOT NULL DEFAULT '5610',
    "asset_account_code" TEXT NOT NULL DEFAULT '1510',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acct_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acct_budgets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "state" TEXT NOT NULL DEFAULT 'draft',
    CONSTRAINT "acct_budgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acct_deferred_entries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "periods" INTEGER NOT NULL DEFAULT 12,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "account_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acct_deferred_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acct_sequences" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_num" INTEGER NOT NULL,
    CONSTRAINT "acct_sequences_pkey" PRIMARY KEY ("id")
);
