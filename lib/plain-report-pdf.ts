export type PlainCol = {
  header: string
  align?: "left" | "right" | "center"
}

export type PlainTable = {
  title?: string
  columns: PlainCol[]
  rows: (string | number)[][]
  foot?: (string | number)[]
}

type JsDoc = import("jspdf").jsPDF & { lastAutoTable?: { finalY: number } }

function fmtDateLabel(iso: string) {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function dateRangeLabel(from: string, to: string) {
  if (from && to) return `${fmtDateLabel(from)} – ${fmtDateLabel(to)}`
  if (from) return `From ${fmtDateLabel(from)}`
  if (to) return `Until ${fmtDateLabel(to)}`
  return "All dates"
}

export async function downloadPlainReportPdf(opts: {
  title: string
  subtitle?: string
  meta?: string[]
  filename: string
  tables: PlainTable[]
  landscape?: boolean
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: opts.landscape ? "landscape" : "portrait",
  }) as JsDoc

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const m = 12
  const ink: [number, number, number] = [20, 20, 20]
  const line: [number, number, number] = [40, 40, 40]

  let y = 11
  doc.setTextColor(...ink)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("VOLTRIX BATTERIES PVT. LTD.", m, y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(opts.title, pageW - m, y, { align: "right" })
  y += 3.5
  doc.setDrawColor(...line)
  doc.setLineWidth(0.35)
  doc.line(m, y, pageW - m, y)
  y += 5

  if (opts.subtitle) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text(opts.subtitle, m, y)
    y += 4
  }

  for (const lineText of opts.meta || []) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.text(lineText, m, y)
    y += 3.4
  }
  y += 1.5

  for (const table of opts.tables) {
    if (y > pageH - 28) {
      doc.addPage()
      y = 12
    }
    if (table.title) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.setTextColor(...ink)
      doc.text(table.title, m, y)
      y += 3
    }

    const body =
      table.rows.length > 0
        ? table.rows.map((r) => r.map((c) => String(c ?? "")))
        : [table.columns.map((_, i) => (i === 0 ? "No rows in this range." : ""))]

    autoTable(doc, {
      startY: y,
      head: [table.columns.map((c) => c.header)],
      body,
      foot: table.foot ? [table.foot.map((c) => String(c ?? ""))] : undefined,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: { top: 1.3, bottom: 1.3, left: 1.5, right: 1.5 },
        textColor: ink,
        fillColor: [255, 255, 255],
        lineColor: line,
        lineWidth: 0.18,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fontStyle: "bold",
        fillColor: [255, 255, 255],
        textColor: ink,
        lineWidth: 0.22,
      },
      footStyles: {
        fontStyle: "bold",
        fillColor: [255, 255, 255],
        textColor: ink,
        lineWidth: 0.22,
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: Object.fromEntries(
        table.columns.map((c, i) => [i, { halign: c.align || "left" }]),
      ),
      margin: { left: m, right: m },
      tableLineColor: line,
      tableLineWidth: 0.18,
    })
    y = (doc.lastAutoTable?.finalY || y) + 6
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...line)
    doc.setLineWidth(0.25)
    doc.line(m, ph - 9, pw - m, ph - 9)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...ink)
    doc.text("Voltrix Batteries Pvt. Ltd.", m, ph - 5.5)
    doc.text(`Page ${i} of ${pages}`, pw - m, ph - 5.5, { align: "right" })
  }

  doc.save(opts.filename)
}

export function pkr(n: number) {
  return `PKR ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}
