import { dateRangeLabel, downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"
import { getPettyCashAllocations, type PettyCashAllocation } from "@/lib/petty-cash"
import { isPersonalLedgerAllocation } from "@/lib/petty-cash-personal"
import {
  formatLedgerItemsSummary,
  formatLedgerSuppliers,
  getPurchaseLedgerEntries,
  type PurchaseLedgerEntry,
} from "@/lib/purchase-ledger"

const SIGN_SPACE = "Mustafa Ali ______    Ejaz ______"

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
  /** When false, skip purchase-ledger dues even if they exist. Petty Cash PDF uses this. */
  includeLedgerDues?: boolean
  scopeLabel?: string
} = {}) {
  const includeLedger = opts.includeLedgerDues === true || opts.ledgerDues != null
  const pending =
    opts.pendingRequests != null
      ? pendingCash(opts.pendingRequests)
      : pendingCash(await getPettyCashAllocations())
  const ledgerDues = includeLedger
    ? dueEntries(opts.ledgerDues ?? (await getPurchaseLedgerEntries()))
    : []

  if (pending.length === 0 && ledgerDues.length === 0) {
    throw new Error(includeLedger
      ? "No pending petty cash and no purchase amounts due"
      : "No pending petty cash requests")
  }

  const pendingTotal = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const dueTotal = ledgerDues.reduce((s, e) => s + (Number(e.amountDue) || 0), 0)
  const stamp = new Date().toISOString().slice(0, 10)
  const scope = opts.scopeLabel?.trim()
  const pettyOnly = !includeLedger

  const tables: PlainTable[] = [
    {
      title: "Summary",
      columns: [
        { header: "Item", width: 90 },
        { header: "Amount", align: "right", width: 40 },
      ],
      rows: pettyOnly
        ? [
            ["Pending petty cash requests", `${pending.length} · ${pkr(pendingTotal)}`],
            ["Total to approve", pkr(pendingTotal)],
          ]
        : [
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
        { header: "Requested on", width: 32 },
        { header: "Employee", width: 32 },
        { header: "Purpose", width: 50 },
        { header: "Amount", align: "right", width: 22 },
        { header: "Sign", width: 56 },
      ],
      rows: pending.map((r) => [
        fmtWhen(r.allocatedAt),
        r.employeeName || "—",
        r.purpose || "—",
        pkr(r.amount),
        SIGN_SPACE,
      ]),
      foot: ["", "", `${pending.length} waiting`, pkr(pendingTotal), ""],
    })
  }

  if (ledgerDues.length > 0) {
    tables.push({
      title: "Purchase ledger due",
      columns: [
        { header: "Ledger No.", width: 20 },
        { header: "Date", width: 20 },
        { header: "Supplier(s)", width: 32 },
        { header: "Items", width: 34 },
        { header: "Due", align: "right", width: 20 },
        { header: "Sign", width: 56 },
      ],
      rows: ledgerDues.map((e) => [
        e.ledgerNumber || "—",
        fmtDay(e.transactionDate),
        formatLedgerSuppliers(e) || "—",
        formatLedgerItemsSummary(e),
        pkr(e.amountDue),
        SIGN_SPACE,
      ]),
      foot: ["", "", "", `${ledgerDues.length} due`, pkr(dueTotal), ""],
    })
  }

  await downloadPlainReportPdf({
    title: pettyOnly ? "Petty cash requests" : "Money approval",
    subtitle: dateRangeLabel("", ""),
    meta: [
      `Generated ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`,
      pettyOnly ? "" : (scope ? `Purchase ledger ${scope}` : ""),
    ].filter(Boolean),
    filename: pettyOnly
      ? `voltrix-petty-cash-requests-${stamp}.pdf`
      : `voltrix-money-approval-${stamp}.pdf`,
    tables,
    compact: true,
    signatures: [
      { name: "Sir Mustafa Ali", role: "Approver 1" },
      { name: "Sir Ejaz", role: "Approver 2" },
    ],
  })
}

export async function downloadPendingPettyCashPdf(rows: PettyCashAllocation[]) {
  await downloadMoneyApprovalPdf({ pendingRequests: rows, includeLedgerDues: false })
}
