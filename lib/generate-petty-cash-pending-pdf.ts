import { dateRangeLabel, downloadPlainReportPdf, pkr } from "@/lib/plain-report-pdf"
import type { PettyCashAllocation } from "@/lib/petty-cash"

function fmtWhen(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })
}

export async function downloadPendingPettyCashPdf(rows: PettyCashAllocation[]) {
  if (!rows.length) throw new Error("Nothing to download")

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const stamp = new Date().toISOString().slice(0, 10)

  await downloadPlainReportPdf({
    title: "Petty cash pending requests",
    subtitle: dateRangeLabel("", ""),
    meta: [
      `Generated ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`,
      "Print this sheet for hard-copy approval. Sir Mustafa Ali and Sir Ejaz both sign below.",
    ],
    filename: `voltrix-petty-cash-pending-${stamp}.pdf`,
    tables: [
      {
        title: "Pending requests",
        columns: [
          { header: "Requested on", width: 38 },
          { header: "Employee", width: 40 },
          { header: "Purpose", width: 78 },
          { header: "Amount", align: "right", width: 28 },
        ],
        rows: rows.map((r) => [
          fmtWhen(r.allocatedAt),
          r.employeeName || "—",
          r.purpose || "—",
          pkr(r.amount),
        ]),
        foot: ["", "", `${rows.length} waiting`, pkr(total)],
      },
    ],
    compact: true,
    signatures: [
      { name: "Sir Mustafa Ali", role: "Approver 1" },
      { name: "Sir Ejaz", role: "Approver 2" },
    ],
  })
}
