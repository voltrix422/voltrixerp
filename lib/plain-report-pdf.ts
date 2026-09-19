export type PlainCol = {
  header: string
  align?: "left" | "right" | "center"
  width?: number
}

export type PlainTable = {
  title?: string
  note?: string
  columns: PlainCol[]
  rows: (string | number)[][]
  foot?: (string | number)[]
  newPage?: boolean
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

export function pkr(n: number) {
  return `PKR ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

export function pct(part: number, total: number) {
  if (!total) return "—"
  return `${((part / total) * 100).toLocaleString("en-PK", { maximumFractionDigits: 1 })}%`
}

async function loadLogoBase64(): Promise<string> {
  try {
    const res = await fetch("/logo.png")
    if (!res.ok) return ""
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ""))
      reader.readAsDataURL(blob)
    })
  } catch {
    return ""
  }
}

function drawLogo(doc: JsDoc, logo: string, x: number, y: number, size: number) {
  if (!logo) return
  try {
    doc.addImage(logo, "PNG", x, y, size, size)
  } catch {
    /* keep text-only header if the image cannot be embedded */
  }
}

function drawRunningHeader(
  doc: JsDoc,
  pageW: number,
  m: number,
  company: string,
  title: string,
  period: string,
  logo: string,
) {
  const ink: [number, number, number] = [20, 20, 20]
  const line: [number, number, number] = [40, 40, 40]
  const logoSize = logo ? 8 : 0
  if (logo) drawLogo(doc, logo, m, 6.5, logoSize)
  doc.setTextColor(...ink)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text(company, m + (logo ? logoSize + 3 : 0), 10)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(title, pageW - m, 10, { align: "right" })
  doc.setDrawColor(...line)
  doc.setLineWidth(0.35)
  doc.line(m, 16, pageW - m, 16)
  if (period) {
    doc.setFontSize(7.5)
    doc.text(period, m, 19.5)
  }
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

  const logo = await loadLogoBase64()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const m = 12
  const ink: [number, number, number] = [20, 20, 20]
  const muted: [number, number, number] = [70, 70, 70]
  const line: [number, number, number] = [40, 40, 40]
  const period = opts.subtitle || ""
  const logoSize = logo ? 16 : 0
  const textX = m + (logo ? logoSize + 4 : 0)

  if (logo) drawLogo(doc, logo, m, 8, logoSize)
  let y = logo ? 13 : 11
  doc.setTextColor(...ink)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("VOLTRIX BATTERIES PVT. LTD.", textX, y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(opts.title, pageW - m, y, { align: "right" })
  y = logo ? 26 : 15
  doc.setDrawColor(...line)
  doc.setLineWidth(0.4)
  doc.line(m, y, pageW - m, y)
  y += 5.5

  if (opts.subtitle) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text(`Period  ${opts.subtitle}`, m, y)
    y += 4.5
  }

  for (const lineText of opts.meta || []) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    doc.text(lineText, m, y)
    y += 3.6
  }
  doc.setTextColor(...ink)
  y += 2

  const startTable = (needed: number) => {
    if (y > pageH - needed) {
      doc.addPage()
      drawRunningHeader(doc, pageW, m, "VOLTRIX BATTERIES PVT. LTD.", opts.title, period, logo)
      y = period ? 24 : 20
    }
  }

  for (const table of opts.tables) {
    if (table.newPage && y > 28) {
      doc.addPage()
      drawRunningHeader(doc, pageW, m, "VOLTRIX BATTERIES PVT. LTD.", opts.title, period, logo)
      y = period ? 24 : 20
    }

    startTable(table.note ? 36 : 30)

    if (table.title) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9.5)
      doc.setTextColor(...ink)
      doc.text(table.title, m, y)
      y += 4
    }
    if (table.note) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(...muted)
      const noteLines = doc.splitTextToSize(table.note, pageW - m * 2)
      doc.text(noteLines, m, y)
      y += noteLines.length * 3.3 + 1
      doc.setTextColor(...ink)
    }

    const body =
      table.rows.length > 0
        ? table.rows.map((r) => r.map((c) => String(c ?? "")))
        : [table.columns.map((_, i) => (i === 0 ? "No rows in this date range." : ""))]

    const usable = pageW - m * 2
    const given = table.columns.map((c) => c.width || 0)
    const givenSum = given.reduce((s, n) => s + n, 0)
    const autoCount = given.filter((n) => n <= 0).length
    const leftover = Math.max(usable - givenSum, autoCount * 18)
    const autoW = autoCount ? leftover / autoCount : 0

    autoTable(doc, {
      startY: y,
      head: [table.columns.map((c) => c.header)],
      body,
      foot: table.foot ? [table.foot.map((c) => String(c ?? ""))] : undefined,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: { top: 1.7, bottom: 1.7, left: 1.8, right: 1.8 },
        textColor: ink,
        fillColor: [255, 255, 255],
        lineColor: line,
        lineWidth: 0.16,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        fontStyle: "bold",
        fontSize: 7.5,
        fillColor: [245, 245, 245],
        textColor: ink,
        lineWidth: 0.22,
        valign: "middle",
      },
      footStyles: {
        fontStyle: "bold",
        fillColor: [245, 245, 245],
        textColor: ink,
        lineWidth: 0.22,
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: Object.fromEntries(
        table.columns.map((c, i) => [
          i,
          {
            halign: c.align || "left",
            cellWidth: c.width && c.width > 0 ? c.width : autoW,
          },
        ]),
      ),
      margin: { left: m, right: m, top: period ? 24 : 20 },
      tableLineColor: line,
      tableLineWidth: 0.16,
      didDrawPage: () => {
        if (doc.getCurrentPageInfo().pageNumber > 1 && !table.title) {
          // running header already drawn when we add pages ourselves
        }
      },
    })
    y = (doc.lastAutoTable?.finalY || y) + 8
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    if (i > 1) {
      drawRunningHeader(doc, pw, m, "VOLTRIX BATTERIES PVT. LTD.", opts.title, period, logo)
    }
    doc.setDrawColor(...line)
    doc.setLineWidth(0.25)
    doc.line(m, ph - 9, pw - m, ph - 9)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...ink)
    doc.text("Voltrix Batteries Pvt. Ltd.  ·  Confidential finance report", m, ph - 5.5)
    doc.text(`Page ${i} of ${pages}`, pw - m, ph - 5.5, { align: "right" })
  }

  doc.save(opts.filename)
}
