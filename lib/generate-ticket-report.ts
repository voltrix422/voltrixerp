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

export function generateTicketReportPDF(ticket: TicketInput, workflow: WorkflowInput): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = 210
  const margin = 14
  let y = 16

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
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
