export type PlainCol = {
  header: string
  align?: "left" | "right" | "center"
  width?: number
  minWidth?: number
  small?: boolean
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

const TITLE_FONT = "times"
const TABLE_FONT = "times"
const INK: [number, number, number] = [18, 18, 18]
const MUTED: [number, number, number] = [72, 72, 72]
const RULE: [number, number, number] = [32, 32, 32]
const MONEY_HEADER = /^(amount|total|paid|due|received|credit|unit)$/i

function columnMinWidth(col: PlainCol): number {
  if (col.minWidth && col.minWidth > 0) return col.minWidth
  if (col.header === "%") return 14
  if (col.header === "Date") return 22
  if (col.align === "right" && MONEY_HEADER.test(col.header)) return 36
  if (col.align === "right") return 16
  return 14
}

function fitColumnWidths(columns: PlainCol[], usable: number): number[] {
  const mins = columns.map(columnMinWidth)
  const preferred = columns.map((c, i) => Math.max(c.width && c.width > 0 ? c.width : mins[i], mins[i]))
  const minSum = mins.reduce((s, w) => s + w, 0)
  if (minSum >= usable) {
    return mins.map((w) => (w / minSum) * usable)
  }
  const extra = usable - minSum
  const flex = preferred.map((p, i) => Math.max(p - mins[i], 0))
  const flexSum = flex.reduce((s, w) => s + w, 0)
  const widths = mins.map((m, i) => m + (flexSum > 0 ? extra * (flex[i] / flexSum) : extra / columns.length))
  const rounded = widths.map((w) => Math.round(w * 10) / 10)
  rounded[rounded.length - 1] += usable - rounded.reduce((s, w) => s + w, 0)
  return rounded
}

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
  return `PKR\u00A0${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
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
  const logoSize = logo ? 8 : 0
  if (logo) drawLogo(doc, logo, m, 6.5, logoSize)
  doc.setTextColor(...INK)
  doc.setFont(TITLE_FONT, "bold")
  doc.setFontSize(10)
  doc.text(company, m + (logo ? logoSize + 3 : 0), 10.5)
  doc.setFont(TITLE_FONT, "normal")
  doc.setFontSize(9)
  doc.text(title, pageW - m, 10.5, { align: "right" })
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.4)
  doc.line(m, 16.5, pageW - m, 16.5)
  if (period) {
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(period, m, 20.5)
    doc.setTextColor(...INK)
  }
}

function drawSectionTitle(doc: JsDoc, title: string, x: number, y: number, pageW: number, m: number, compact = false) {
  doc.setFont(TITLE_FONT, "bold")
  doc.setFontSize(compact ? 10 : 14)
  doc.setTextColor(...INK)
  doc.text(title, x, y)
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.45)
  doc.line(x, y + 1.8, pageW - m, y + 1.8)
  return y + (compact ? 5.5 : 8)
}

export async function downloadPlainReportPdf(opts: {
  title: string
  subtitle?: string
  meta?: string[]
  filename: string
  tables: PlainTable[]
  landscape?: boolean
  pagePerTable?: boolean
  compact?: boolean
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
  const m = 14
  const period = opts.subtitle || ""
  const logoSize = logo ? 18 : 0
  const textX = m + (logo ? logoSize + 5 : 0)
  const compact = Boolean(opts.compact)
  const headerBottom = period ? (compact ? 22 : 24) : 20
  const pagePerTable = Boolean(opts.pagePerTable)
  const bodySize = compact ? 8 : 9
  const smallSize = compact ? 6.8 : 7.5
  const pad = compact ? { top: 1.1, bottom: 1.1, left: 1.2, right: 1.2 } : { top: 2.1, bottom: 2.1, left: 1.8, right: 1.8 }

  if (logo) drawLogo(doc, logo, m, compact ? 8 : 10, compact ? 14 : logoSize)
  let y = logo ? (compact ? 13 : 16) : 14
  doc.setTextColor(...INK)
  doc.setFont(TITLE_FONT, "bold")
  doc.setFontSize(compact ? 11 : 12)
  doc.text("VOLTRIX BATTERIES PVT. LTD.", textX, y)
  y += compact ? 5.5 : 7
  doc.setFontSize(compact ? 14 : 18)
  doc.text(opts.title.toUpperCase(), textX, y)
  y = Math.max(y, logo ? (compact ? 24 : 30) : y) + (compact ? 2 : 3)
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.55)
  doc.line(m, y, pageW - m, y)
  y += compact ? 5 : 7

  if (opts.subtitle) {
    doc.setFont(TITLE_FONT, "bold")
    doc.setFontSize(compact ? 9 : 11)
    doc.text(`Period  ${opts.subtitle}`, m, y)
    y += compact ? 4.2 : 5.5
  }

  for (const lineText of opts.meta || []) {
    doc.setFont(TITLE_FONT, "normal")
    doc.setFontSize(compact ? 8 : 10)
    doc.setTextColor(...INK)
    doc.text(lineText, m, y)
    y += compact ? 3.4 : 4.4
  }
  y += compact ? 2.5 : 4

  const startTable = (needed: number) => {
    if (y > pageH - needed) {
      doc.addPage()
      y = headerBottom + 4
    }
  }

  let tableIndex = 0
  for (const table of opts.tables) {
    const forceNewPage = table.newPage || (pagePerTable && tableIndex > 0)
    if (forceNewPage && y > 36) {
      doc.addPage()
      y = headerBottom + 4
    }

    startTable(34)

    if (table.title) {
      y = drawSectionTitle(doc, table.title, m, y, pageW, m, compact)
    }

    const body =
      table.rows.length > 0
        ? table.rows.map((r) => r.map((c) => String(c ?? "")))
        : [table.columns.map((_, i) => (i === 0 ? "—" : ""))]

    const usable = pageW - m * 2
    const colWidths = fitColumnWidths(table.columns, usable)
    const sectionTitle = table.title || ""

    autoTable(doc, {
      startY: y,
      head: [table.columns.map((c) => c.header)],
      body,
      foot: table.foot ? [table.foot.map((c) => String(c ?? ""))] : undefined,
      theme: "grid",
      tableWidth: usable,
      styles: {
        font: TABLE_FONT,
        fontSize: bodySize,
        cellPadding: pad,
        textColor: INK,
        fillColor: [255, 255, 255],
        lineColor: RULE,
        lineWidth: 0.2,
        overflow: "linebreak",
        valign: "middle",
        minCellHeight: compact ? 5 : 7,
      },
      headStyles: {
        font: TABLE_FONT,
        fontStyle: "bold",
        fontSize: compact ? 7.5 : 9,
        fillColor: [255, 255, 255],
        textColor: INK,
        lineWidth: 0.3,
        valign: "middle",
      },
      footStyles: {
        font: TABLE_FONT,
        fontStyle: "bold",
        fontSize: compact ? 7.5 : 9,
        fillColor: [255, 255, 255],
        textColor: INK,
        lineWidth: 0.3,
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: Object.fromEntries(
        table.columns.map((c, i) => [
          i,
          {
            halign: c.align || "left",
            cellWidth: colWidths[i],
            overflow: "linebreak",
            fontSize: c.small ? smallSize : bodySize,
          },
        ]),
      ),
      margin: { left: m, right: m, top: headerBottom + (sectionTitle ? (compact ? 8 : 12) : 4) },
      showHead: "everyPage",
      tableLineColor: RULE,
      tableLineWidth: 0.2,
      didDrawPage: (hook) => {
        const pageNo = doc.getCurrentPageInfo().pageNumber
        if (pageNo > 1) {
          drawRunningHeader(doc, pageW, m, "VOLTRIX BATTERIES PVT. LTD.", opts.title, period, logo)
          if (sectionTitle && hook.pageNumber > 1) {
            drawSectionTitle(doc, sectionTitle, m, headerBottom + 4, pageW, m, compact)
          }
        }
      },
    })
    y = (doc.lastAutoTable?.finalY || y) + (compact ? 5 : 10)
    tableIndex += 1
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.3)
    doc.line(m, ph - 10, pw - m, ph - 10)
    doc.setFont(TITLE_FONT, "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text("Voltrix Batteries Pvt. Ltd.", m, ph - 6)
    doc.text(`Page ${i} of ${pages}`, pw - m, ph - 6, { align: "right" })
  }

  doc.save(opts.filename)
}
