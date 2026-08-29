import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const TEAL: [number, number, number] = [31, 172, 166]
const TEAL_DARK: [number, number, number] = [22, 140, 136]
const SLATE: [number, number, number] = [51, 65, 85]
const MARGIN = 14

type JsDoc = jsPDF & { lastAutoTable?: { finalY: number } }

export type LoanStatementRow = {
  date: string
  type: string
  detail: string
  moneyIn: number
  moneyOut: number
  weOweAfter: number
  theyOweAfter: number
  recordedBy: string
}

export type LoanStatementPayload = {
  personName: string
  periodLabel: string
  generatedBy: string
  weOwe: number
  theyOwe: number
  periodIn: number
  periodOut: number
  txnCount: number
  rows: LoanStatementRow[]
}

function fmt(n: number) {
  return `Rs ${(n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

function blankIfZero(n: number) {
  if (!n || Math.abs(n) < 0.004) return "—"
  return fmt(n)
}

async function loadImageBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return ""
    const blob = await res.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ""))
      reader.readAsDataURL(blob)
    })
  } catch {
    return ""
  }
}

function safeText(s: string | null | undefined, max = 60) {
  const t = String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
  if (!t) return "—"
  if (/[\u0600-\u06FF]/.test(t)) {
    const latin = t.replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g, "…").trim()
    return (latin || "Note").slice(0, max)
  }
  return t.slice(0, max)
}

function drawFooter(doc: JsDoc) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...TEAL)
    doc.rect(0, pageH - 10, pageW, 10, "F")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)
    doc.text("Voltrix Batteries Pvt. Ltd.  ·  Confidential ERP statement", MARGIN, pageH - 4)
    doc.text(`Page ${i} of ${pages}`, pageW - MARGIN, pageH - 4, { align: "right" })
  }
}

export async function downloadLoanStatementPdf(data: LoanStatementPayload) {
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsDoc
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFillColor(...TEAL_DARK)
  doc.rect(0, 0, pageW, 36, "F")

  const logo = await loadImageBase64("/logo.png")
  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGIN, 7, 20, 20)
    } catch {
      /* ignore missing logo */
    }
  }
  const textX = logo ? MARGIN + 24 : MARGIN
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text("VOLTRIX BATTERIES", textX, 13)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.text("Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", textX, 19)
  doc.text("051-8731661  ·  sale@voltrixbatteries.com", textX, 24)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("LOAN STATEMENT", pageW - MARGIN, 14, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.text("ERP Finance  ·  Official copy", pageW - MARGIN, 20, { align: "right" })

  let y = 44
  doc.setTextColor(...SLATE)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(safeText(data.personName, 48), MARGIN, y)
  y += 6
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Period: ${data.periodLabel}`, MARGIN, y)
  y += 4.5
  doc.text(
    `Generated ${new Date().toLocaleString("en-PK")}  ·  ${safeText(data.generatedBy, 28)}  ·  ${data.txnCount} transaction${data.txnCount === 1 ? "" : "s"}`,
    MARGIN,
    y,
  )
  y += 8

  const cards = [
    { label: "We owe them", value: fmt(Math.max(0, data.weOwe)), fill: [254, 242, 242] as [number, number, number] },
    { label: "They owe us", value: fmt(Math.max(0, data.theyOwe)), fill: [236, 253, 245] as [number, number, number] },
    { label: "Period in", value: fmt(data.periodIn), fill: [240, 253, 250] as [number, number, number] },
    { label: "Period out", value: fmt(data.periodOut), fill: [255, 247, 237] as [number, number, number] },
  ]
  const gap = 3
  const cardW = (pageW - MARGIN * 2 - gap * 3) / 4
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + gap)
    doc.setFillColor(...c.fill)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(x, y, cardW, 16, 1.5, 1.5, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text(c.label.toUpperCase(), x + 3, y + 5)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(...SLATE)
    doc.text(c.value, x + 3, y + 11.5)
  })
  y += 22

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...SLATE)
  doc.text("TRANSACTION HISTORY", MARGIN, y)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.7)
  doc.line(MARGIN, y + 1.6, MARGIN + 42, y + 1.6)
  y += 5

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      textColor: SLATE,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: TEAL,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: [248, 250, 250] },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
    head: [["Date", "Type", "Detail", "In", "Out", "We owe", "They owe"]],
    body:
      data.rows.length > 0
        ? data.rows.map((r) => [
            r.date,
            safeText(r.type, 22),
            safeText(r.detail, 42),
            blankIfZero(r.moneyIn),
            blankIfZero(r.moneyOut),
            fmt(r.weOweAfter),
            fmt(r.theyOweAfter),
          ])
        : [["—", "No transactions in this period", "", "", "", "", ""]],
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 28 },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 24, halign: "right" },
    },
  })

  y = (doc.lastAutoTable?.finalY || y) + 8
  const pageH = doc.internal.pageSize.getHeight()
  if (y > pageH - 28) {
    doc.addPage()
    y = 18
  }
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(
    "Running balances after each transaction. Positive In is cash received by Voltrix; Out is cash paid by Voltrix.",
    MARGIN,
    y,
    { maxWidth: pageW - MARGIN * 2 },
  )

  drawFooter(doc)

  const slug = data.personName.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "loan"
  doc.save(`Voltrix-Loan-Statement-${slug}.pdf`)
}
