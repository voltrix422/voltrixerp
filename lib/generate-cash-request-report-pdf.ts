import { dateRangeLabel, downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"
import {
  cashRequestStatusLabel,
  paymentMethodLabel,
  type CashRequest,
} from "@/lib/finance-cash-requests"

function fmtDay(iso: string) {
  if (!iso) return "—"
  const day = iso.slice(0, 10)
  const [y, m, d] = day.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function detailsLine(r: CashRequest) {
  if (!r.itemBreakdown?.length) return r.purpose || "—"
  return r.itemBreakdown.map((l) => `${l.description} ${pkr(l.amount)}`).join("; ")
}

export async function downloadCashRequestReportPdf(
  rows: CashRequest[],
  opts: {
    title?: string
    employeeName?: string
    dateFrom?: string
    dateTo?: string
  } = {},
) {
  if (!rows.length) throw new Error("Nothing to download")

  const period = dateRangeLabel(opts.dateFrom || "", opts.dateTo || "")
  const employee = opts.employeeName || "All employees"
  const pending = rows.filter((r) => r.status === "pending")
  const approved = rows.filter((r) => r.status === "approved")
  const rejected = rows.filter((r) => r.status === "rejected")
  const sum = (list: CashRequest[]) => list.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const tables: PlainTable[] = [
    {
      title: "Summary",
      columns: [
        { header: "Item", width: 90 },
        { header: "Amount", align: "right", width: 40 },
      ],
      rows: [
        ["Employee", employee],
        ["Period", period],
        ["Requests", String(rows.length)],
        ["Pending", `${pending.length} · ${pkr(sum(pending))}`],
        ["Approved", `${approved.length} · ${pkr(sum(approved))}`],
        ["Rejected", `${rejected.length} · ${pkr(sum(rejected))}`],
        ["Total requested", pkr(sum(rows))],
      ],
    },
    {
      title: "Cash requests",
      columns: [
        { header: "Requested", width: 22 },
        { header: "Needed", width: 22 },
        { header: "Employee", width: 32 },
        { header: "Purpose", width: 42 },
        { header: "Category", width: 22 },
        { header: "Pay", width: 18 },
        { header: "Status", width: 18 },
        { header: "Amount", align: "right", width: 24 },
      ],
      rows: rows.map((r) => [
        fmtDay(r.createdAt),
        fmtDay(r.neededOn),
        r.staffName || r.requesterName,
        r.purpose || "—",
        r.category,
        paymentMethodLabel(r.paymentMethod),
        cashRequestStatusLabel(r.status),
        pkr(r.amount),
      ]),
      foot: ["", "", "", "", "", "", String(rows.length), pkr(sum(rows))],
    },
    {
      title: "Cash details",
      columns: [
        { header: "Employee", width: 32 },
        { header: "Needed", width: 22 },
        { header: "Details", width: 70, small: true },
        { header: "Location", width: 24 },
        { header: "Admin notes", width: 36, small: true },
        { header: "Amount", align: "right", width: 22 },
      ],
      rows: rows.map((r) => [
        r.staffName || r.requesterName,
        fmtDay(r.neededOn),
        detailsLine(r),
        r.location || "—",
        r.adminNotes || "—",
        pkr(r.amount),
      ]),
    },
  ]

  const who = opts.employeeName ? `-${opts.employeeName.replace(/\s+/g, "-").toLowerCase()}` : ""
  const stamp = new Date().toISOString().slice(0, 10)

  await downloadPlainReportPdf({
    title: opts.title || "Cash requests",
    subtitle: `${employee} · ${period}`,
    meta: [
      `Generated ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`,
    ],
    filename: `voltrix-cash-requests${who}-${stamp}.pdf`,
    tables,
    compact: true,
  })
}
