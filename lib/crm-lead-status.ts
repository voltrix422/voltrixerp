export const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "price_negotiable", label: "Price negotiable" },
  { value: "on_hold", label: "On hold" },
  { value: "not_responded", label: "Not responded" },
  { value: "responded", label: "Responded" },
  { value: "closed", label: "Closed" },
] as const

export type LeadStatusValue = (typeof LEAD_STATUS_OPTIONS)[number]["value"]

export const LEAD_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  LEAD_STATUS_OPTIONS.map((o) => [o.value, o.label]),
)

export function leadStatusLabel(status: string) {
  return LEAD_STATUS_LABELS[status] ?? status.replace(/_/g, " ")
}

export function mapLeadRow(l: {
  id: string
  name: string
  company: string
  city: string
  address: string
  email: string
  phone: string
  notes: string
  source: string
  status: string
  followUpAt: Date | null
  followUpNotes: string
  assignedToUserId: string | null
  assignedToName: string
  importedAt: Date
  createdBy: string
  createdById: string | null
  importBatchId: string | null
  importUploaderName: string | null
  _count: { contacts: number }
  contacts: { contactedAt: Date; leadResponse: string }[]
}) {
  return {
    id: l.id,
    name: l.name,
    company: l.company,
    city: l.city,
    address: l.address,
    email: l.email,
    phone: l.phone,
    notes: l.notes,
    source: l.source,
    status: l.status,
    followUpAt: l.followUpAt?.toISOString() ?? null,
    followUpNotes: l.followUpNotes,
    assignedToUserId: l.assignedToUserId,
    assignedToName: l.assignedToName,
    importedAt: l.importedAt.toISOString(),
    createdBy: l.createdBy,
    createdById: l.createdById,
    importBatchId: l.importBatchId,
    importUploaderName: l.importUploaderName,
    contactCount: l._count.contacts,
    lastContactedAt: l.contacts[0]?.contactedAt.toISOString() ?? null,
    lastResponseSnippet: l.contacts[0]?.leadResponse
      ? String(l.contacts[0].leadResponse).slice(0, 160)
      : null,
  }
}
