import { dateRangeLabel, downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"
import { cashRequestStatusLabel, type CashRequest } from "@/lib/finance-cash-requests"

function fmtDay(iso: string) {
  if (!iso) return "—"
  const day = iso.slice(0, 10)
  const [y, m, d] = day.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
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
      title: "Requests",
      columns: [
        { header: "Date", width: 24 },
        { header: "Employee", width: 36 },
        { header: "Description", width: 70 },
        { header: "Status", width: 20 },
        { header: "Admin note", width: 36, small: true },
        { header: "Amount", align: "right", width: 24 },
      ],
      rows: rows.map((r) => [
        fmtDay(r.createdAt),
        r.staffName || r.requesterName,
        r.purpose || "—",
        cashRequestStatusLabel(r.status),
        r.adminNotes || "—",
        pkr(r.amount),
      ]),
      foot: ["", "", "", "", String(rows.length), pkr(sum(rows))],
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
