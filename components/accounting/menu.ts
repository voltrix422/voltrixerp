import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, FileText, Receipt, CreditCard, Bell,
  Building2, RotateCcw, BookOpen, ListTree, Layers, Lock,
  Landmark, GitCompare, BarChart3, Scale, Users, Settings,
  Percent, Calendar, PiggyBank, TrendingDown, Wallet, Globe,
} from "lucide-react"

export type AcctView =
  | "dashboard"
  | "customer_invoices" | "customer_credit_notes" | "customer_payments" | "customer_followup"
  | "vendor_bills" | "vendor_refunds" | "vendor_payments"
  | "journal_entries" | "chart_of_accounts" | "journals" | "analytic_accounts"
  | "assets" | "deferred" | "lock_dates"
  | "bank_reconciliation" | "bank_statements" | "bank_accounts"
  | "report_pnl" | "report_balance_sheet" | "report_general_ledger" | "report_aged_ar" | "report_aged_ap"
  | "report_trial_balance" | "report_tax" | "report_cash_flow"
  | "config_settings" | "config_taxes" | "config_payment_terms" | "config_fiscal_positions"
  | "budgets"

export interface MenuGroup {
  id: string
  label: string
  items: { id: AcctView; label: string; icon: LucideIcon }[]
}

export const ACCOUNTING_MENU: MenuGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      { id: "customer_invoices", label: "Invoices", icon: FileText },
      { id: "customer_credit_notes", label: "Credit Notes", icon: RotateCcw },
      { id: "customer_payments", label: "Payments", icon: CreditCard },
      { id: "customer_followup", label: "Follow-up", icon: Bell },
    ],
  },
  {
    id: "vendors",
    label: "Vendors",
    items: [
      { id: "vendor_bills", label: "Bills", icon: Receipt },
      { id: "vendor_refunds", label: "Refunds", icon: RotateCcw },
      { id: "vendor_payments", label: "Payments", icon: Wallet },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    items: [
      { id: "journal_entries", label: "Journal Entries", icon: BookOpen },
      { id: "chart_of_accounts", label: "Chart of Accounts", icon: ListTree },
      { id: "journals", label: "Journals", icon: Layers },
      { id: "analytic_accounts", label: "Analytic Accounts", icon: Building2 },
      { id: "assets", label: "Assets", icon: Landmark },
      { id: "deferred", label: "Deferred Revenue / Expenses", icon: Calendar },
      { id: "lock_dates", label: "Lock Dates", icon: Lock },
      { id: "budgets", label: "Budgets", icon: PiggyBank },
    ],
  },
  {
    id: "bank",
    label: "Bank",
    items: [
      { id: "bank_reconciliation", label: "Bank Reconciliation", icon: GitCompare },
      { id: "bank_statements", label: "Bank Statements", icon: FileText },
      { id: "bank_accounts", label: "Bank Accounts", icon: Landmark },
    ],
  },
  {
    id: "reports",
    label: "Reporting",
    items: [
      { id: "report_pnl", label: "Profit & Loss", icon: TrendingDown },
      { id: "report_balance_sheet", label: "Balance Sheet", icon: Scale },
      { id: "report_general_ledger", label: "General Ledger", icon: BookOpen },
      { id: "report_aged_ar", label: "Aged Receivable", icon: Users },
      { id: "report_aged_ap", label: "Aged Payable", icon: Users },
      { id: "report_trial_balance", label: "Trial Balance", icon: BarChart3 },
      { id: "report_tax", label: "Tax Report", icon: Percent },
      { id: "report_cash_flow", label: "Cash Flow", icon: Wallet },
    ],
  },
  {
    id: "config",
    label: "Configuration",
    items: [
      { id: "config_settings", label: "Settings", icon: Settings },
      { id: "config_taxes", label: "Taxes", icon: Percent },
      { id: "config_payment_terms", label: "Payment Terms", icon: Calendar },
      { id: "config_fiscal_positions", label: "Fiscal Positions", icon: Globe },
    ],
  },
]

export const VIEW_TITLES: Record<AcctView, string> = Object.fromEntries(
  ACCOUNTING_MENU.flatMap(g => g.items.map(i => [i.id, i.label]))
) as Record<AcctView, string>
