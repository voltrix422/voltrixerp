"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fmtMoney, fmtDate, todayISO } from "@/lib/accounting/format"
import type { AcctView } from "@/components/accounting/menu"
import { Loader2, Plus, CheckCircle, RefreshCw } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

const inputCls =
  "w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  if (!rows.length) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">No records yet.</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-[hsl(var(--muted))]/30">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 font-semibold text-[hsl(var(--muted-foreground))]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-[hsl(var(--muted))]/10">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StateBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-600",
    posted: "bg-blue-500/10 text-blue-700",
    paid: "bg-green-500/10 text-green-700",
    open: "bg-amber-500/10 text-amber-700",
    running: "bg-teal-500/10 text-teal-700",
  }
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${colors[state] ?? colors.draft}`}>{state}</span>
}

async function acctFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/accounting/${path}`, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Request failed")
  return data
}

export function AccountingViews({ view, refreshKey }: { view: AcctView; refreshKey: number }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [data, setData] = useState<unknown>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      let result: unknown = null
      switch (view) {
        case "dashboard":
          result = await acctFetch("dashboard")
          break
        case "chart_of_accounts":
          result = await acctFetch("accounts")
          break
        case "journals":
          result = await acctFetch("journals")
          break
        case "journal_entries":
          result = await acctFetch("moves")
          break
        case "customer_invoices":
          result = await acctFetch("invoices?type=out_invoice")
          break
        case "customer_credit_notes":
          result = await acctFetch("invoices?type=out_refund")
          break
        case "vendor_bills":
          result = await acctFetch("invoices?type=in_invoice")
          break
        case "vendor_refunds":
          result = await acctFetch("invoices?type=in_refund")
          break
        case "customer_payments":
          result = await acctFetch("payments?type=inbound")
          break
        case "vendor_payments":
          result = await acctFetch("payments?type=outbound")
          break
        case "bank_accounts":
          result = await acctFetch("bank-accounts")
          break
        case "bank_statements":
        case "bank_reconciliation":
          result = await acctFetch("bank-statements")
          break
        case "config_taxes":
          result = await acctFetch("taxes")
          break
        case "config_payment_terms":
          result = await acctFetch("payment-terms")
          break
        case "config_settings":
        case "lock_dates":
          result = await acctFetch("settings")
          break
        case "analytic_accounts":
          result = await acctFetch("analytic")
          break
        case "assets":
          result = await acctFetch("assets")
          break
        case "deferred":
          result = await acctFetch("deferred")
          break
        case "budgets":
          result = await acctFetch("budgets")
          break
        case "report_pnl":
          result = await acctFetch("reports?report=pnl")
          break
        case "report_balance_sheet":
          result = await acctFetch("reports?report=balance_sheet")
          break
        case "report_general_ledger":
          result = await acctFetch("reports?report=general_ledger")
          break
        case "report_aged_ar":
          result = await acctFetch("reports?report=aged_receivable")
          break
        case "report_aged_ap":
          result = await acctFetch("reports?report=aged_payable")
          break
        case "customer_followup":
          result = await acctFetch("reports?report=aged_receivable")
          break
        default:
          result = null
      }
      setData(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    reload()
  }, [reload, refreshKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#1faca6]" />
      </div>
    )
  }
  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-500/5 p-4 text-sm text-red-700">{error}</div>
  }

  return <ViewContent view={view} data={data} userName={user?.name ?? "Accountant"} onRefresh={reload} />
}

function ViewContent({
  view,
  data,
  userName,
  onRefresh,
}: {
  view: AcctView
  data: unknown
  userName: string
  onRefresh: () => void
}) {
  const d = data as Record<string, unknown>

  if (view === "dashboard") {
    if (!d.seeded) {
      return (
        <div className="rounded-lg border border-dashed p-10 text-center space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Initialize the accounting module with chart of accounts, journals, taxes, and sample data.</p>
          <InitializeButton onDone={onRefresh} />
        </div>
      )
    }
    const s = d.stats as Record<string, unknown>
    const cards = [
      { label: "Receivable outstanding", value: fmtMoney(Number(s.receivableOutstanding)) },
      { label: "Payable outstanding", value: fmtMoney(Number(s.payableOutstanding)) },
      { label: "Net profit (YTD posted)", value: fmtMoney(Number(s.netProfit)) },
      { label: "Posted journal entries", value: String(s.journalEntries) },
      { label: "Customer invoices", value: String(s.customerInvoices) },
      { label: "Vendor bills", value: String(s.vendorBills) },
    ]
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {cards.map(c => (
            <div key={c.label} className="rounded-lg border p-4">
              <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{c.label}</p>
              <p className="text-lg font-bold mt-1 tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
        {(s.bankBalances as { name: string; balance: number }[])?.length > 0 && (
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold mb-2">Bank balances</p>
            {(s.bankBalances as { name: string; balance: number }[]).map(b => (
              <div key={b.name} className="flex justify-between text-sm py-1">
                <span>{b.name}</span>
                <span className="font-medium tabular-nums">{fmtMoney(b.balance)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (view === "chart_of_accounts") {
    const rows = (data as { code: string; name: string; accountType: string; reconcile: boolean; active: boolean }[]).map(
      a => [a.code, a.name, a.accountType, a.reconcile ? "Yes" : "", a.active ? <StateBadge state="posted" /> : <StateBadge state="draft" />]
    )
    return (
      <>
        <AccountForm onSaved={onRefresh} />
        <div className="mt-4"><Table headers={["Code", "Name", "Type", "Reconcile", "Status"]} rows={rows} /></div>
      </>
    )
  }

  if (view === "journals") {
    const rows = (data as { code: string; name: string; journalType: string }[]).map(j => [j.code, j.name, j.journalType])
    return <Table headers={["Code", "Name", "Type"]} rows={rows} />
  }

  if (view === "journal_entries") {
    const rows = (data as { id: string; name: string; date: string; state: string; amountTotal: number; moveType: string }[]).map(m => [
      m.name, fmtDate(m.date), m.moveType, fmtMoney(m.amountTotal), <StateBadge state={m.state} />,
      m.state === "draft" ? <PostMoveButton id={m.id} onDone={onRefresh} /> : null,
    ])
    return (
      <div className="space-y-3">
        <ManualEntryForm userName={userName} onSaved={onRefresh} />
        <Table headers={["Number", "Date", "Type", "Total", "Status", ""]} rows={rows} />
      </div>
    )
  }

  if (["customer_invoices", "customer_credit_notes", "vendor_bills", "vendor_refunds"].includes(view)) {
    const typeMap: Record<string, string> = {
      customer_invoices: "out_invoice",
      customer_credit_notes: "out_refund",
      vendor_bills: "in_invoice",
      vendor_refunds: "in_refund",
    }
    const invType = typeMap[view]
    const rows = (data as { number: string; partnerName?: string; invoiceDate: string; amountTotal: number; amountResidual: number; state: string; id: string }[]).map(
      i => [
        i.number || "Draft",
        i.partnerName ?? "",
        fmtDate(i.invoiceDate),
        fmtMoney(i.amountTotal),
        fmtMoney(i.amountResidual),
        <StateBadge state={i.state} />,
        i.state === "draft" ? <PostInvoiceButton id={i.id} onDone={onRefresh} /> : null,
      ]
    )
    return (
      <div className="space-y-3">
        <InvoiceForm invoiceType={invType} userName={userName} onSaved={onRefresh} />
        <Table headers={["Number", "Partner", "Date", "Total", "Due", "Status", ""]} rows={rows} />
      </div>
    )
  }

  if (view === "customer_payments" || view === "vendor_payments") {
    const pType = view === "customer_payments" ? "inbound" : "outbound"
    const rows = (data as { name: string; date: string; amount: number; state: string; id: string }[]).map(p => [
      p.name || "Draft",
      fmtDate(p.date),
      fmtMoney(p.amount),
      <StateBadge state={p.state} />,
      p.state === "draft" ? <PostPaymentButton id={p.id} onDone={onRefresh} /> : null,
    ])
    return (
      <div className="space-y-3">
        <PaymentForm paymentType={pType} userName={userName} onSaved={onRefresh} />
        <Table headers={["Reference", "Date", "Amount", "Status", ""]} rows={rows} />
      </div>
    )
  }

  if (view === "customer_followup") {
    const aged = data as { buckets: Record<string, number>; details: { partner: string; invoice: string; days: number; amount: number }[] }
    return (
      <div className="space-y-4">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Payment follow-up — overdue customer invoices (Odoo-style dunning levels can be configured in Settings).</p>
        <div className="grid grid-cols-5 gap-2">
          {[
            ["Current", aged.buckets?.current],
            ["1–30 days", aged.buckets?.d30],
            ["31–60", aged.buckets?.d60],
            ["61–90", aged.buckets?.d90],
            ["90+", aged.buckets?.older],
          ].map(([l, v]) => (
            <div key={String(l)} className="rounded border p-2 text-center">
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{l}</p>
              <p className="font-bold text-sm">{fmtMoney(Number(v ?? 0))}</p>
            </div>
          ))}
        </div>
        <Table
          headers={["Customer", "Invoice", "Days overdue", "Amount"]}
          rows={(aged.details ?? []).map(x => [x.partner, x.invoice, String(x.days), fmtMoney(x.amount)])}
        />
      </div>
    )
  }

  if (view === "bank_accounts") {
    const rows = (data as { name: string; bankName: string; accountNumber: string; balance: number }[]).map(b => [
      b.name, b.bankName, b.accountNumber, fmtMoney(b.balance),
    ])
    return <Table headers={["Name", "Bank", "Account #", "Balance"]} rows={rows} />
  }

  if (view === "bank_statements" || view === "bank_reconciliation") {
    const stmts = data as { name: string; date: string; balanceStart: number; balanceEnd: number; state: string; lines: { paymentRef: string; amount: number; reconciled: boolean }[] }[]
    return (
      <div className="space-y-4">
        {view === "bank_reconciliation" && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Match statement lines with journal items. Mark lines reconciled when amounts match posted payments.</p>
        )}
        {stmts.map(s => (
          <div key={s.name} className="rounded-lg border p-4">
            <div className="flex justify-between mb-2">
              <span className="font-medium text-sm">{s.name}</span>
              <StateBadge state={s.state} />
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{fmtDate(s.date)} · {fmtMoney(s.balanceStart)} → {fmtMoney(s.balanceEnd)}</p>
            <Table
              headers={["Reference", "Amount", "Reconciled"]}
              rows={(s.lines ?? []).map(l => [l.paymentRef, fmtMoney(l.amount), l.reconciled ? "✓" : "—"])}
            />
          </div>
        ))}
        {!stmts.length && <p className="text-sm text-[hsl(var(--muted-foreground))]">Create bank statements from Bank → Import or manual entry.</p>}
      </div>
    )
  }

  if (view === "report_pnl") {
    const r = data as { rows: { code: string; name: string; balance: number }[]; totalIncome: number; totalExpense: number; netProfit: number }
    return (
      <ReportShell title="Profit & Loss">
        <Table headers={["Account", "Name", "Balance"]} rows={(r.rows ?? []).map(x => [x.code, x.name, fmtMoney(x.balance)])} />
        <div className="mt-4 flex gap-6 text-sm font-semibold">
          <span>Income: {fmtMoney(r.totalIncome ?? 0)}</span>
          <span>Expenses: {fmtMoney(r.totalExpense ?? 0)}</span>
          <span className="text-[#1faca6]">Net: {fmtMoney(r.netProfit ?? 0)}</span>
        </div>
      </ReportShell>
    )
  }

  if (view === "report_balance_sheet") {
    const r = data as { assets: { name: string; balance: number }[]; liabilities: { name: string; balance: number }[]; equity: { name: string; balance: number }[]; totalAssets: number; totalLiabilities: number; totalEquity: number }
    const section = (title: string, items: { name: string; balance: number }[]) => (
      <div className="mb-4">
        <p className="text-xs font-bold uppercase mb-1">{title}</p>
        <Table headers={["Account", "Balance"]} rows={items.map(i => [i.name, fmtMoney(i.balance)])} />
      </div>
    )
    return (
      <ReportShell title="Balance Sheet">
        {section("Assets", r.assets ?? [])}
        {section("Liabilities", r.liabilities ?? [])}
        {section("Equity", r.equity ?? [])}
        <p className="text-sm">Assets {fmtMoney(r.totalAssets ?? 0)} = Liabilities {fmtMoney(r.totalLiabilities ?? 0)} + Equity {fmtMoney(r.totalEquity ?? 0)}</p>
      </ReportShell>
    )
  }

  if (view === "report_general_ledger" || view === "report_trial_balance") {
    const lines = (data as { date: string; moveName: string; accountCode: string; accountName: string; label: string; debit: number; credit: number }[]) ?? []
    if (view === "report_trial_balance") {
      const byAcc: Record<string, { code: string; name: string; debit: number; credit: number }> = {}
      for (const l of lines) {
        const k = l.accountCode
        if (!byAcc[k]) byAcc[k] = { code: l.accountCode, name: l.accountName, debit: 0, credit: 0 }
        byAcc[k].debit += l.debit
        byAcc[k].credit += l.credit
      }
      return (
        <ReportShell title="Trial Balance">
          <Table headers={["Code", "Account", "Debit", "Credit"]} rows={Object.values(byAcc).map(a => [a.code, a.name, fmtMoney(a.debit), fmtMoney(a.credit)])} />
        </ReportShell>
      )
    }
    return (
      <ReportShell title="General Ledger">
        <Table headers={["Date", "Entry", "Account", "Label", "Debit", "Credit"]} rows={lines.map(l => [fmtDate(l.date), l.moveName, `${l.accountCode} ${l.accountName}`, l.label, fmtMoney(l.debit), fmtMoney(l.credit)])} />
      </ReportShell>
    )
  }

  if (view === "report_aged_ar" || view === "report_aged_ap") {
    const aged = data as { buckets: Record<string, number>; details: { partner: string; invoice: string; days: number; amount: number }[] }
    return (
      <ReportShell title={view === "report_aged_ar" ? "Aged Receivable" : "Aged Payable"}>
        <Table headers={["Partner", "Document", "Days", "Amount"]} rows={(aged.details ?? []).map(x => [x.partner, x.invoice, String(x.days), fmtMoney(x.amount)])} />
      </ReportShell>
    )
  }

  if (view === "report_tax") {
    return (
      <ReportShell title="Tax Report">
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">Tax collected on sales vs tax paid on purchases (from posted invoice lines with tax accounts).</p>
        <TaxReportLoader />
      </ReportShell>
    )
  }

  if (view === "report_cash_flow") {
    return (
      <ReportShell title="Cash Flow Statement">
        <div className="space-y-3 text-sm">
          <p className="text-[hsl(var(--muted-foreground))]">Operating, investing, and financing activities derived from cash/bank journal entries.</p>
          <CashFlowLoader />
        </div>
      </ReportShell>
    )
  }

  if (view === "config_taxes") {
    const rows = (data as { name: string; rate: number; taxType: string }[]).map(t => [t.name, `${t.rate}%`, t.taxType])
    return (
      <div className="space-y-3">
        <TaxForm onSaved={onRefresh} />
        <Table headers={["Name", "Rate", "Type"]} rows={rows} />
      </div>
    )
  }

  if (view === "config_payment_terms") {
    const rows = (data as { name: string; lines: { days: number; percent: number }[] }[]).map(t => [
      t.name,
      (t.lines ?? []).map(l => `${l.percent}% in ${l.days}d`).join(", "),
    ])
    return <Table headers={["Name", "Terms"]} rows={rows} />
  }

  if (view === "config_settings" || view === "lock_dates") {
    const s = data as { companyName: string; currency: string; fiscalYearStart: number; lockDate: string | null; invoiceTerms: string }
    return <SettingsForm settings={s} lockOnly={view === "lock_dates"} onSaved={onRefresh} />
  }

  if (view === "config_fiscal_positions") {
    return (
      <div className="rounded-lg border p-6 text-sm space-y-2">
        <p className="font-medium">Fiscal Positions</p>
        <p className="text-[hsl(var(--muted-foreground))]">Map partners to tax accounts and jurisdictions (e.g. export = 0% GST). Configure positions: Domestic (GST 17%), Export (Exempt), Intercompany.</p>
        <ul className="list-disc pl-5 text-xs space-y-1">
          <li>Domestic — GST 17% on sales & purchases</li>
          <li>Export — Tax exempt</li>
          <li>Sindh / Punjab — regional variants (localization)</li>
        </ul>
      </div>
    )
  }

  if (view === "analytic_accounts") {
    const rows = (data as { code: string; name: string; plan: string }[]).map(a => [a.code, a.name, a.plan])
    return (
      <div className="space-y-3">
        <AnalyticForm onSaved={onRefresh} />
        <Table headers={["Code", "Name", "Plan"]} rows={rows} />
      </div>
    )
  }

  if (view === "assets") {
    const rows = (data as { name: string; originalValue: number; durationMonths: number; state: string }[]).map(a => [
      a.name, fmtMoney(a.originalValue), `${a.durationMonths} mo`, <StateBadge state={a.state} />,
    ])
    return (
      <div className="space-y-3">
        <AssetForm onSaved={onRefresh} />
        <Table headers={["Asset", "Value", "Duration", "Status"]} rows={rows} />
      </div>
    )
  }

  if (view === "deferred") {
    const rows = (data as { name: string; entryType: string; totalAmount: number; periods: number; state: string }[]).map(e => [
      e.name, e.entryType, fmtMoney(e.totalAmount), String(e.periods), <StateBadge state={e.state} />,
    ])
    return (
      <div className="space-y-3">
        <DeferredForm onSaved={onRefresh} />
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Spread revenue/expense over multiple periods with automatic journal entries.</p>
        <Table headers={["Name", "Type", "Amount", "Periods", "Status"]} rows={rows} />
      </div>
    )
  }

  if (view === "budgets") {
    const rows = (data as { name: string; fiscalYear: number; state: string }[]).map(b => [b.name, String(b.fiscalYear), <StateBadge state={b.state} />])
    return (
      <div className="space-y-3">
        <BudgetForm onSaved={onRefresh} />
        <Table headers={["Budget", "Year", "Status"]} rows={rows} />
      </div>
    )
  }

  return null
}

function ReportShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  )
}

function InitializeButton({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  return (
    <Button disabled={loading} onClick={async () => {
      setLoading(true)
      await fetch("/api/accounting/init", { method: "POST" })
      setLoading(false)
      onDone()
    }}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
      <span className="ml-2">Initialize Accounting</span>
    </Button>
  )
}

function PostMoveButton({ id, onDone }: { id: string; onDone: () => void }) {
  return (
    <button className="text-[10px] text-[#1faca6] hover:underline" onClick={async () => {
      await acctFetch("moves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post", id }) })
      onDone()
    }}>Post</button>
  )
}

function PostInvoiceButton({ id, onDone }: { id: string; onDone: () => void }) {
  return (
    <button className="text-[10px] text-[#1faca6] hover:underline" onClick={async () => {
      await acctFetch("invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post", id }) })
      onDone()
    }}>Post</button>
  )
}

function PostPaymentButton({ id, onDone }: { id: string; onDone: () => void }) {
  return (
    <button className="text-[10px] text-[#1faca6] hover:underline" onClick={async () => {
      await acctFetch("payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post", id }) })
      onDone()
    }}>Post</button>
  )
}

function AccountForm({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [accountType, setAccountType] = useState("expense")
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3 w-3 mr-1" />New account</Button>
  return (
    <form className="flex flex-wrap gap-2 items-end p-3 rounded border" onSubmit={async e => {
      e.preventDefault()
      await acctFetch("accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name, accountType }) })
      setOpen(false); onSaved()
    }}>
      <input className={inputCls + " w-24"} placeholder="Code" value={code} onChange={e => setCode(e.target.value)} required />
      <input className={inputCls + " flex-1 min-w-[120px]"} placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
      <select className={inputCls + " w-32"} value={accountType} onChange={e => setAccountType(e.target.value)}>
        {["asset", "liability", "equity", "income", "expense", "receivable", "payable", "bank", "cash"].map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <Button type="submit" size="sm">Save</Button>
    </form>
  )
}

function ManualEntryForm({ userName, onSaved }: { userName: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [journals, setJournals] = useState<{ id: string; name: string }[]>([])
  const [accounts, setAccounts] = useState<{ id: string; code: string; name: string }[]>([])
  useEffect(() => {
    if (open) {
      Promise.all([acctFetch("journals"), acctFetch("accounts")]).then(([j, a]) => {
        setJournals(j); setAccounts(a)
      })
    }
  }, [open])
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3 w-3 mr-1" />Journal entry</Button>
  const misc = journals.find(j => j.name.includes("Misc")) ?? journals[0]
  const expense = accounts.find(a => a.code === "5200")
  const bank = accounts.find(a => a.code === "1020")
  return (
    <form className="p-3 rounded border space-y-2 text-xs" onSubmit={async e => {
      e.preventDefault()
      const fd = new FormData(e.target as HTMLFormElement)
      if (!misc || !expense || !bank) return
      const amt = Number(fd.get("amount"))
      await acctFetch("moves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalId: misc.id,
          date: fd.get("date"),
          narration: fd.get("label"),
          createdBy: userName,
          postImmediately: true,
          lines: [
            { accountId: expense.id, name: String(fd.get("label")), debit: amt },
            { accountId: bank.id, name: String(fd.get("label")), credit: amt },
          ],
        }),
      })
      setOpen(false); onSaved()
    }}>
      <div className="flex gap-2 flex-wrap">
        <input name="date" type="date" defaultValue={todayISO()} className={inputCls + " w-36"} />
        <input name="label" placeholder="Label" className={inputCls + " flex-1"} required />
        <input name="amount" type="number" placeholder="Amount" className={inputCls + " w-28"} required />
      </div>
      <Button type="submit" size="sm">Create & Post</Button>
    </form>
  )
}

function InvoiceForm({ invoiceType, userName, onSaved }: { invoiceType: string; userName: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([])
  const [journals, setJournals] = useState<{ id: string }[]>([])
  const isOut = invoiceType.startsWith("out")
  useEffect(() => {
    if (open) {
      Promise.all([
        acctFetch(`partners?type=${isOut ? "customer" : "vendor"}`),
        acctFetch("journals"),
      ]).then(([p, j]) => {
        setPartners(p)
        setJournals(j.filter((x: { journalType: string }) => x.journalType === (isOut ? "sale" : "purchase")))
      })
    }
  }, [open, isOut])
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3 w-3 mr-1" />Create</Button>
  return (
    <form className="p-3 rounded border space-y-2" onSubmit={async e => {
      e.preventDefault()
      const fd = new FormData(e.target as HTMLFormElement)
      await acctFetch("invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceType,
          partnerId: fd.get("partnerId"),
          journalId: fd.get("journalId"),
          invoiceDate: fd.get("date"),
          dueDate: fd.get("due"),
          createdBy: userName,
          lines: [{ productName: String(fd.get("product")), accountCode: isOut ? "4100" : "5100", quantity: 1, unitPrice: Number(fd.get("amount")) }],
        }),
      })
      setOpen(false); onSaved()
    }}>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <select name="partnerId" className={inputCls} required>
          <option value="">Partner</option>
          {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="journalId" className={inputCls} required>
          {journals.map(j => <option key={j.id} value={j.id}>{j.id.slice(0, 8)}</option>)}
        </select>
        <input name="date" type="date" defaultValue={todayISO()} className={inputCls} />
        <input name="due" type="date" defaultValue={todayISO()} className={inputCls} />
        <input name="product" placeholder="Description" className={inputCls} />
        <input name="amount" type="number" placeholder="Amount" className={inputCls} required />
      </div>
      <Button type="submit" size="sm">Save draft</Button>
    </form>
  )
}

function PaymentForm({ paymentType, userName, onSaved }: { paymentType: string; userName: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([])
  const [journals, setJournals] = useState<{ id: string }[]>([])
  useEffect(() => {
    if (open) {
      Promise.all([
        acctFetch(`partners?type=${paymentType === "inbound" ? "customer" : "vendor"}`),
        acctFetch("journals"),
      ]).then(([p, j]) => {
        setPartners(p)
        setJournals(j.filter((x: { journalType: string }) => ["bank", "cash"].includes(x.journalType)))
      })
    }
  }, [open, paymentType])
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3 w-3 mr-1" />Register payment</Button>
  return (
    <form className="p-3 rounded border flex flex-wrap gap-2" onSubmit={async e => {
      e.preventDefault()
      const fd = new FormData(e.target as HTMLFormElement)
      const pay = await acctFetch("payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentType,
          partnerId: fd.get("partnerId"),
          journalId: fd.get("journalId"),
          amount: Number(fd.get("amount")),
          date: fd.get("date"),
          memo: fd.get("memo"),
          createdBy: userName,
        }),
      })
      await acctFetch("payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post", id: pay.id }) })
      setOpen(false); onSaved()
    }}>
      <select name="partnerId" className={inputCls + " w-40"} required>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select name="journalId" className={inputCls + " w-32"} required>{journals.map(j => <option key={j.id} value={j.id}>Journal</option>)}</select>
      <input name="date" type="date" defaultValue={todayISO()} className={inputCls + " w-32"} />
      <input name="amount" type="number" className={inputCls + " w-28"} required />
      <input name="memo" placeholder="Memo" className={inputCls + " w-40"} />
      <Button type="submit" size="sm">Post payment</Button>
    </form>
  )
}

function TaxForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("")
  const [rate, setRate] = useState("17")
  return (
    <form className="flex gap-2" onSubmit={async e => {
      e.preventDefault()
      await acctFetch("taxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, rate: Number(rate), taxType: "sale" }) })
      setName(""); onSaved()
    }}>
      <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Tax name" />
      <input className={inputCls + " w-20"} value={rate} onChange={e => setRate(e.target.value)} />
      <Button type="submit" size="sm">Add</Button>
    </form>
  )
}

function SettingsForm({ settings, lockOnly, onSaved }: { settings: { companyName: string; currency: string; fiscalYearStart: number; lockDate: string | null; invoiceTerms: string }; lockOnly?: boolean; onSaved: () => void }) {
  const [form, setForm] = useState(settings)
  return (
    <form className="max-w-md space-y-3 text-sm" onSubmit={async e => {
      e.preventDefault()
      await acctFetch("settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      onSaved()
    }}>
      {!lockOnly && (
        <>
          <label className="block text-xs font-medium">Company</label>
          <input className={inputCls} value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} />
          <label className="block text-xs font-medium">Currency</label>
          <input className={inputCls} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
          <label className="block text-xs font-medium">Fiscal year start month (1–12)</label>
          <input type="number" className={inputCls} value={form.fiscalYearStart} onChange={e => setForm({ ...form, fiscalYearStart: Number(e.target.value) })} />
          <label className="block text-xs font-medium">Default invoice terms</label>
          <textarea className={inputCls + " h-20"} value={form.invoiceTerms} onChange={e => setForm({ ...form, invoiceTerms: e.target.value })} />
        </>
      )}
      <label className="block text-xs font-medium">Lock date (no posting before)</label>
      <input type="date" className={inputCls} value={form.lockDate ? form.lockDate.slice(0, 10) : ""} onChange={e => setForm({ ...form, lockDate: e.target.value || null })} />
      <Button type="submit" size="sm">Save settings</Button>
    </form>
  )
}

function AnalyticForm({ onSaved }: { onSaved: () => void }) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  return (
    <form className="flex gap-2" onSubmit={async e => {
      e.preventDefault()
      await acctFetch("analytic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name }) })
      onSaved()
    }}>
      <input className={inputCls + " w-24"} value={code} onChange={e => setCode(e.target.value)} placeholder="Code" />
      <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
      <Button type="submit" size="sm">Add</Button>
    </form>
  )
}

function AssetForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("")
  const [value, setValue] = useState("")
  return (
    <form className="flex gap-2 flex-wrap" onSubmit={async e => {
      e.preventDefault()
      await acctFetch("assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, originalValue: Number(value), acquisitionDate: todayISO() }) })
      onSaved()
    }}>
      <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Asset name" />
      <input className={inputCls + " w-32"} value={value} onChange={e => setValue(e.target.value)} placeholder="Value" type="number" />
      <Button type="submit" size="sm">Add asset</Button>
    </form>
  )
}

function DeferredForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  return (
    <form className="flex gap-2" onSubmit={async e => {
      e.preventDefault()
      const start = todayISO()
      await acctFetch("deferred", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, entryType: "revenue", totalAmount: Number(amount), startDate: start, endDate: start, periods: 12, accountCode: "4100" }),
      })
      onSaved()
    }}>
      <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
      <input className={inputCls + " w-32"} value={amount} onChange={e => setAmount(e.target.value)} type="number" />
      <Button type="submit" size="sm">Add</Button>
    </form>
  )
}

function BudgetForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("")
  return (
    <form className="flex gap-2" onSubmit={async e => {
      e.preventDefault()
      await acctFetch("budgets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, fiscalYear: new Date().getFullYear(), lines: [] }) })
      onSaved()
    }}>
      <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Budget name" />
      <Button type="submit" size="sm">Create budget</Button>
    </form>
  )
}

function TaxReportLoader() {
  const [rows, setRows] = useState<string[][]>([])
  useEffect(() => {
    acctFetch("taxes").then((taxes: { name: string; rate: number }[]) => {
      setRows(taxes.map(t => [t.name, `${t.rate}%`, "Configure invoice lines to populate balances"]))
    })
  }, [])
  return <Table headers={["Tax", "Rate", "Balance"]} rows={rows} />
}

function CashFlowLoader() {
  const [text, setText] = useState("Loading…")
  useEffect(() => {
    acctFetch("reports?report=general_ledger").then((lines: { accountCode: string; debit: number; credit: number }[]) => {
      const cash = lines.filter(l => l.accountCode === "1010" || l.accountCode === "1020")
      const net = cash.reduce((s, l) => s + l.debit - l.credit, 0)
      setText(`Net cash movement (posted): ${fmtMoney(net)}`)
    })
  }, [])
  return <p className="font-medium">{text}</p>
}
