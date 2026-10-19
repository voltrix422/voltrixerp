import { dateRangeLabel, downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"
import { getPettyCashAllocations, type PettyCashAllocation } from "@/lib/petty-cash"
import { isPersonalLedgerAllocation } from "@/lib/petty-cash-personal"
import {
  formatLedgerItemsSummary,
  formatLedgerSuppliers,
  getPurchaseLedgerEntries,
  type PurchaseLedgerEntry,
} from "@/lib/purchase-ledger"

function fmtWhen(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })
}

function fmtDay(iso: string) {
  if (!iso) return "—"
  const day = iso.slice(0, 10)
  const [y, m, d] = day.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function pendingCash(rows: PettyCashAllocation[]) {
  return rows.filter((r) => r.status === "pending" && !isPersonalLedgerAllocation(r))
}

function dueEntries(rows: PurchaseLedgerEntry[]) {
  return rows
    .filter((e) => (Number(e.amountDue) || 0) > 0.004)
    .sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)))
}

export async function downloadMoneyApprovalPdf(opts: {
  pendingRequests?: PettyCashAllocation[]
  ledgerDues?: PurchaseLedgerEntry[]
  scopeLabel?: string
} = {}) {
  const pending =
    opts.pendingRequests != null
      ? pendingCash(opts.pendingRequests)
      : pendingCash(await getPettyCashAllocations())
  const ledgerDues =
    opts.ledgerDues != null
      ? dueEntries(opts.ledgerDues)
      : dueEntries(await getPurchaseLedgerEntries())

  if (pending.length === 0 && ledgerDues.length === 0) {
    throw new Error("No pending petty cash and no purchase amounts due")
  }

  const pendingTotal = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const dueTotal = ledgerDues.reduce((s, e) => s + (Number(e.amountDue) || 0), 0)
  const stamp = new Date().toISOString().slice(0, 10)
  const scope = opts.scopeLabel?.trim()

  const tables: PlainTable[] = [
    {
      title: "Summary",
      columns: [
        { header: "Item", width: 90 },
        { header: "Amount", align: "right", width: 40 },
      ],
      rows: [
        ["Pending petty cash requests", `${pending.length} · ${pkr(pendingTotal)}`],
        ["Purchase ledger due", `${ledgerDues.length} · ${pkr(dueTotal)}`],
        ["Combined to approve", pkr(pendingTotal + dueTotal)],
      ],
    },
  ]

  if (pending.length > 0) {
    tables.push({
      title: "Petty cash pending requests",
      columns: [
        { header: "Requested on", width: 38 },
        { header: "Employee", width: 40 },
        { header: "Purpose", width: 78 },
        { header: "Amount", align: "right", width: 28 },
      ],
      rows: pending.map((r) => [
        fmtWhen(r.allocatedAt),
        r.employeeName || "—",
        r.purpose || "—",
        pkr(r.amount),
      ]),
      foot: ["", "", `${pending.length} waiting`, pkr(pendingTotal)],
    })
  }

  if (ledgerDues.length > 0) {
    tables.push({
      title: "Purchase ledger due",
      columns: [
        { header: "Ledger No.", width: 22 },
        { header: "Date", width: 22 },
        { header: "Supplier(s)", width: 40 },
        { header: "Items", width: 58 },
        { header: "Total", align: "right", width: 24 },
        { header: "Paid", align: "right", width: 24 },
        { header: "Due", align: "right", width: 24 },
      ],
      rows: ledgerDues.map((e) => [
        e.ledgerNumber || "—",
        fmtDay(e.transactionDate),
        formatLedgerSuppliers(e) || "—",
        formatLedgerItemsSummary(e),
        pkr(e.totalAmount),
        pkr(e.amountPaid),
        pkr(e.amountDue),
      ]),
      foot: ["", "", "", `${ledgerDues.length} due`, "", "", pkr(dueTotal)],
    })
  }

  await downloadPlainReportPdf({
    title: "Money approval",
    subtitle: dateRangeLabel("", ""),
    meta: [
      `Generated ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`,
      scope ? `Purchase ledger ${scope}` : "",
    ].filter(Boolean),
    filename: `voltrix-money-approval-${stamp}.pdf`,
    tables,
    compact: true,
    signatures: [
      { name: "Sir Mustafa Ali", role: "Approver 1" },
      { name: "Sir Ejaz", role: "Approver 2" },
    ],
  })
}

export async function downloadPendingPettyCashPdf(rows: PettyCashAllocation[]) {
  await downloadMoneyApprovalPdf({ pendingRequests: rows })
}
