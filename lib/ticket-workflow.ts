export interface TicketWorkflow {
  ticketId: string
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

const DEFAULT_WORKFLOW: Omit<TicketWorkflow, "ticketId"> = {
  diagnosisSteps: [],
  issueFound: false,
  supportFindings: "",
  supportFix: "",
  escalatedToGround: false,
  groundStaffNotes: "",
  groundStaffFixed: false,
  supportFinalNotes: "",
  warrantyClaimed: false,
  returnedItem: "",
  replacementItem: "",
  replacementInvoiceNumber: "",
  replacementDispatchNoteNumber: "",
}

export async function getTicketWorkflow(ticketId: string): Promise<TicketWorkflow> {
  try {
    const res = await fetch(`/api/db/ticket-workflows?ticketId=${encodeURIComponent(ticketId)}`)
    if (!res.ok) return { ticketId, ...DEFAULT_WORKFLOW }
    const data = await res.json()
    return {
      ticketId,
      diagnosisSteps: Array.isArray(data.diagnosisSteps) ? data.diagnosisSteps.map(String) : [],
      issueFound: Boolean(data.issueFound),
      supportFindings: String(data.supportFindings || ""),
      supportFix: String(data.supportFix || ""),
      escalatedToGround: Boolean(data.escalatedToGround),
      groundStaffNotes: String(data.groundStaffNotes || ""),
      groundStaffFixed: Boolean(data.groundStaffFixed),
      supportFinalNotes: String(data.supportFinalNotes || ""),
      warrantyClaimed: Boolean(data.warrantyClaimed),
      returnedItem: String(data.returnedItem || ""),
      replacementItem: String(data.replacementItem || ""),
      replacementInvoiceNumber: String(data.replacementInvoiceNumber || ""),
      replacementDispatchNoteNumber: String(data.replacementDispatchNoteNumber || ""),
    }
  } catch {
    return { ticketId, ...DEFAULT_WORKFLOW }
  }
}

export async function saveTicketWorkflow(workflow: TicketWorkflow): Promise<boolean> {
  try {
    const res = await fetch("/api/db/ticket-workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    })
    return res.ok
  } catch {
    return false
  }
}
