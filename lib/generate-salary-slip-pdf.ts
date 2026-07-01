export type SalarySlipAdjustment = {
  id?: string
  type: "add" | "deduct"
  amount: string | number
  label: string
}

export type SalarySlipPdfData = {
  staffName: string
  staffRole: string
  staffDepartment: string
  month: string
  baseSalary: number
  currency: string
  adjustments?: SalarySlipAdjustment[]
  netSalary: number
  generatedDate: string | Date
  payPeriodText?: string
  isDraft?: boolean
  bankName?: string
  bankAccountNumber?: string
  bankAccountTitle?: string
}

export async function downloadSalarySlipPdf(
  slip: SalarySlipPdfData,
  fileName?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF()

  const primaryColor: [number, number, number] = [31, 172, 166]
  const textColor: [number, number, number] = [40, 40, 40]
  const lightGray: [number, number, number] = [248, 250, 252]
  const borderColor: [number, number, number] = [226, 232, 240]

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, 210, 55, "F")

  try {
    const logoImg = new Image()
    logoImg.src = "/logo.png"
    await new Promise((resolve) => {
      logoImg.onload = resolve
      logoImg.onerror = resolve
    })
    if (logoImg.complete && logoImg.naturalHeight !== 0) {
      doc.addImage(logoImg, "PNG", 15, 10, 35, 35)
    }
  } catch {
    // logo optional
  }

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("VOLTRIX BATTERIES", 55, 18)

  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text("Head Office", 55, 24)
  doc.text("Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", 55, 29)
  doc.text("Phone: 051-8731661 | Mobile: +92 303 4927779", 55, 34)
  doc.text("Email: sale@voltrixbatteries.com", 55, 39)

  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.text("SALARY SLIP", 205, 30, { align: "right" })

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  const periodHeader =
    slip.payPeriodText ||
    new Date(slip.month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })
  doc.text(periodHeader, 205, 38, { align: "right" })
  if (slip.isDraft) {
    doc.setFontSize(8)
    doc.text("DRAFT", 205, 44, { align: "right" })
  }

  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.setLineWidth(0.5)
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
  doc.line(15, 60, 195, 60)

  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
  doc.roundedRect(15, 68, 180, 60, 2, 2, "F")
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(15, 68, 180, 8, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("EMPLOYEE INFORMATION", 20, 73)

  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("Employee Name:", 20, 83)
  doc.text("Role:", 20, 91)
  doc.text("Department:", 20, 99)
  doc.text("Employee Status:", 20, 107)
  doc.setFont("helvetica", "normal")
  doc.text(slip.staffName, 60, 83)
  doc.text(slip.staffRole, 60, 91)
  doc.text(slip.staffDepartment, 60, 99)
  doc.text("Active", 60, 107)

  doc.setFont("helvetica", "bold")
  doc.text("Pay Period:", 120, 83)
  doc.text("Generated On:", 120, 91)
  doc.text("Currency:", 120, 99)
  doc.setFont("helvetica", "normal")
  const periodDetail =
    slip.payPeriodText ||
    new Date(slip.month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })
  doc.text(periodDetail, 155, 83)
  doc.text(
    new Date(slip.generatedDate).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    155,
    91,
  )
  doc.text(slip.currency, 155, 99)

  if (slip.bankName || slip.bankAccountNumber) {
    doc.setFont("helvetica", "bold")
    doc.text("Bank Name:", 20, 115)
    doc.text("Account Number:", 20, 123)
    doc.setFont("helvetica", "normal")
    doc.text(slip.bankName || "—", 60, 115)
    doc.text(slip.bankAccountNumber || "—", 60, 123)
    if (slip.bankAccountTitle) {
      doc.setFont("helvetica", "bold")
      doc.text("Account Title:", 120, 115)
      doc.setFont("helvetica", "normal")
      doc.text(slip.bankAccountTitle, 155, 115)
    }
  }

  let currentY = slip.bankName || slip.bankAccountNumber ? 140 : 125

  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
  doc.roundedRect(15, currentY, 180, 12, 2, 2, "F")
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("BASE SALARY", 20, currentY + 8)
  doc.setFontSize(12)
  doc.text(`${slip.currency} ${slip.baseSalary.toLocaleString()}`, 190, currentY + 8, {
    align: "right",
  })
  currentY += 20

  const adjustments = slip.adjustments ?? []
  if (adjustments.length > 0) {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.rect(15, currentY, 180, 8, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("SALARY ADJUSTMENTS", 20, currentY + 5)
    currentY += 12
    doc.setTextColor(textColor[0], textColor[1], textColor[2])

    adjustments.forEach((adj, index) => {
      const amount = parseFloat(String(adj.amount))
      const isAddition = adj.type === "add"
      if (index % 2 === 0) {
        doc.setFillColor(252, 252, 252)
        doc.rect(15, currentY - 4, 180, 9, "F")
      }
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text(adj.label, 20, currentY)
      doc.setFont("helvetica", "bold")
      if (isAddition) {
        doc.setTextColor(34, 197, 94)
        doc.text(`+ ${slip.currency} ${amount.toLocaleString()}`, 190, currentY, { align: "right" })
      } else {
        doc.setTextColor(239, 68, 68)
        doc.text(`- ${slip.currency} ${amount.toLocaleString()}`, 190, currentY, { align: "right" })
      }
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      currentY += 9
    })
    currentY += 5
  }

  doc.setLineWidth(0.5)
  doc.line(15, currentY, 195, currentY)
  currentY += 10

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.roundedRect(15, currentY, 180, 20, 2, 2, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.text("NET SALARY (TOTAL PAYABLE)", 20, currentY + 13)
  doc.setFontSize(16)
  doc.text(`${slip.currency} ${slip.netSalary.toLocaleString()}`, 190, currentY + 13, {
    align: "right",
  })

  currentY += 35
  doc.setFillColor(255, 251, 235)
  doc.roundedRect(15, currentY, 180, 20, 2, 2, "F")
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(146, 64, 14)
  doc.text("IMPORTANT NOTE:", 20, currentY + 7)
  doc.setFont("helvetica", "normal")
  doc.text("This salary slip is computer-generated and does not require a signature.", 20, currentY + 12)
  doc.text("Please verify all details and contact Finance for any discrepancies.", 20, currentY + 16)

  doc.setTextColor(100, 100, 100)
  doc.line(15, 270, 195, 270)
  doc.setFontSize(8)
  doc.setFont("helvetica", "italic")
  doc.text("Voltrix Batteries — Finance & Payroll", 105, 276, { align: "center" })
  doc.text("Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", 105, 281, {
    align: "center",
  })

  const pdfBlob = doc.output("blob")
  const url = URL.createObjectURL(pdfBlob)
  const a = document.createElement("a")
  a.href = url
  a.download =
    fileName ??
    `Salary-Slip-${slip.staffName.replace(/\s+/g, "-")}-${slip.month}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number)
  if (!y || !m) return yyyyMm
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export function monthDateRange(yyyyMm: string): { from: string; to: string } {
  const [y, m] = yyyyMm.split("-").map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return {
    from: `${yyyyMm}-01`,
    to: `${yyyyMm}-${String(lastDay).padStart(2, "0")}`,
  }
}

export function currentPayrollMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export type PayrollSummaryRow = {
  staffName: string
  staffRole: string
  periodText: string
  baseSalary: number
  netSalary: number
  currency: string
  advanceDeducted: number
  bankName?: string
  bankAccountNumber?: string
  bankAccountTitle?: string
  status?: "draft" | "finalized"
}

export async function downloadPayrollSummaryPdf(
  month: string,
  rows: PayrollSummaryRow[],
  options?: { isDraft?: boolean },
): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const primaryColor: [number, number, number] = [26, 159, 154]
  const textColor: [number, number, number] = [30, 41, 59]
  const borderColor: [number, number, number] = [203, 213, 225]

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, 297, 28, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  const title = options?.isDraft
    ? `Salary Draft — ${monthLabel(month)}`
    : `Monthly Payroll — ${monthLabel(month)}`
  doc.text(title, 12, 12)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 19)

  const total = rows.reduce((sum, r) => sum + r.netSalary, 0)
  const currency = rows[0]?.currency || "PKR"
  doc.setFont("helvetica", "bold")
  doc.text(`Total: ${currency} ${total.toLocaleString()}`, 285, 12, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.text(`${rows.length} employee${rows.length === 1 ? "" : "s"}`, 285, 19, { align: "right" })

  const cols = {
    employee: 8,
    role: 38,
    bank: 68,
    account: 108,
    period: 148,
    base: 198,
    advance: 222,
    net: 248,
    status: 278,
  }
  let y = 36
  doc.setFillColor(241, 245, 249)
  doc.rect(8, y, 281, 8, "F")
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.text("Employee", cols.employee, y + 5.5)
  doc.text("Role", cols.role, y + 5.5)
  doc.text("Bank", cols.bank, y + 5.5)
  doc.text("Account", cols.account, y + 5.5)
  doc.text("Pay period", cols.period, y + 5.5)
  doc.text("Base", cols.base, y + 5.5)
  doc.text("Advance", cols.advance, y + 5.5)
  doc.text("Net", cols.net, y + 5.5)
  doc.text("Status", cols.status, y + 5.5)
  y += 10

  doc.setFont("helvetica", "normal")
  for (const row of rows) {
    if (y > 190) {
      doc.addPage()
      y = 16
    }
    doc.text(row.staffName.slice(0, 22), cols.employee, y)
    doc.text(row.staffRole.slice(0, 18), cols.role, y)
    doc.text((row.bankName || "—").slice(0, 22), cols.bank, y)
    const accountLine = row.bankAccountTitle
      ? `${(row.bankAccountTitle || "").slice(0, 14)} / ${(row.bankAccountNumber || "—").slice(0, 16)}`
      : (row.bankAccountNumber || "—").slice(0, 28)
    doc.text(accountLine, cols.account, y)
    doc.text(row.periodText.slice(0, 28), cols.period, y)
    doc.text(`${row.currency} ${row.baseSalary.toLocaleString()}`, cols.base, y)
    doc.text(
      row.advanceDeducted > 0 ? `- ${row.currency} ${row.advanceDeducted.toLocaleString()}` : "—",
      cols.advance,
      y,
    )
    doc.setFont("helvetica", "bold")
    doc.text(`${row.currency} ${row.netSalary.toLocaleString()}`, cols.net, y)
    doc.setFont("helvetica", "normal")
    doc.text(row.status === "draft" ? "Draft" : "Final", cols.status, y)
    y += 7
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
    doc.line(8, y - 2, 289, y - 2)
  }

  const suffix = options?.isDraft ? "Draft" : "Payroll"
  doc.save(`${suffix}-${month}.pdf`)
}
