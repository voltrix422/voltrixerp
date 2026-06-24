import jsPDF from "jspdf"

type TicketInput = {
  ticketNumber: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  subject: string
  description: string
  status: string
  priority: string
  createdAt: string
  supportEngineerName?: string
}

type WorkflowInput = {
  diagnosisSteps: string[]
  issueFound: boolean
  supportFindings: string
  supportFix: string
  escalatedToGround: boolean
  groundStaffNotes: string
  groundStaffFixed: boolean
  supportFinalNotes: string
  warrantyClaimed: boolean
  returnedItem: string
  replacementItem: string
  replacementInvoiceNumber: string
  replacementDispatchNoteNumber: string
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

export async function generateTicketReportPDF(ticket: TicketInput, workflow: WorkflowInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = 210
  const margin = 14
  let y = 14

  // Header band with branding
  doc.setFillColor(26, 159, 154)
  doc.rect(0, 0, pageW, 32, "F")
  const logo = await loadImageBase64("/logo.png")
  if (logo) {
    doc.addImage(logo, "PNG", margin, 5, 18, 18)
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text("VOLTRIX BATTERIES", margin + 22, 13)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text("Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", margin + 22, 18)
  doc.text("Phone: 051-8731661 | Email: sale@voltrixbatteries.com", margin + 22, 22.5)
  doc.text("www.voltrixbatteries.com", margin + 22, 27)

  y = 40
  doc.setTextColor(30, 30, 30)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text("Ticket Resolution Report", margin, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`Ticket: ${ticket.ticketNumber}`, margin, y)
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, y, { align: "right" })
  y += 8

  const lines = [
    `Customer: ${ticket.customerName}`,
    `Email: ${ticket.customerEmail}`,
    `Phone: ${ticket.customerPhone || "N/A"}`,
    `Priority: ${ticket.priority}`,
    `Status: ${ticket.status}`,
    `Created: ${new Date(ticket.createdAt).toLocaleString()}`,
    `Support Engineer: ${ticket.supportEngineerName || "N/A"}`,
    `Subject: ${ticket.subject}`,
    `Description: ${ticket.description}`,
  ]
  doc.setFontSize(9)
  lines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, pageW - margin * 2)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 4.5
  })

  y += 2
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Diagnostic Stages Checked", margin, y)
  y += 6
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  if (workflow.diagnosisSteps.length === 0) {
    doc.text("None", margin, y)
    y += 5
  } else {
    workflow.diagnosisSteps.forEach((step) => {
      doc.text(`- ${step}`, margin, y)
      y += 5
    })
  }

  const section = (title: string, content: string) => {
    y += 2
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text(title, margin, y)
    y += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    const wrapped = doc.splitTextToSize(content || "N/A", pageW - margin * 2)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 4.5
  }

  section("Support Findings", workflow.supportFindings)
  section("Support Fix", workflow.supportFix)

  if (workflow.escalatedToGround) {
    section("Ground Staff Notes", workflow.groundStaffNotes)
    section("Support Final Notes", workflow.supportFinalNotes)
  }

  if (workflow.warrantyClaimed) {
    section(
      "Warranty Replacement",
      `Returned Item: ${workflow.returnedItem || "N/A"}\nReplacement Item: ${workflow.replacementItem || "N/A"}\nReplacement Invoice: ${workflow.replacementInvoiceNumber || "N/A"}\nReplacement Dispatch Note: ${workflow.replacementDispatchNoteNumber || "N/A"}`
    )
  }

  return doc.output("blob")
}
