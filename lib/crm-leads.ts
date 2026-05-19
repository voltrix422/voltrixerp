export type CrmLeadRow = {
  id: string
  name: string
  company: string
  email: string
  phone: string
  notes: string
  source: string
  status: string
  importedAt: string
  createdBy: string
  createdById: string | null
  importBatchId: string | null
  importUploaderName: string | null
  contactCount: number
  lastContactedAt: string | null
  lastResponseSnippet: string | null
}

export type CrmLeadContactRow = {
  id: string
  leadId: string
  contactedAt: string
  contactedBy: string
  contactedById: string | null
  screenshotUrls: string[]
  leadResponse: string
  notes: string
}

export async function fetchLeads(): Promise<CrmLeadRow[]> {
  const res = await fetch("/api/crm/leads")
  if (!res.ok) return []
  return res.json()
}

export async function fetchLeadDetail(id: string): Promise<{
  lead: CrmLeadRow & { contacts: CrmLeadContactRow[] }
} | null> {
  const res = await fetch(`/api/crm/leads/${id}`)
  if (!res.ok) return null
  return res.json()
}

export async function importVoltrixInstallersLeads(body: {
  createdBy: string
  createdById?: string | null
  /** When batch already exists, also fix phones on every lead (any import batch). */
  repairAll?: boolean
}): Promise<{
  mode: string
  created?: number
  importBatchId?: string
  batchRepair?: { updated: number; total: number }
  allRepair?: { updated: number; total: number }
}> {
  const res = await fetch("/api/crm/leads/import-installers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Import installers failed")
  return data as {
    mode: string
    created?: number
    importBatchId?: string
    batchRepair?: { updated: number; total: number }
    allRepair?: { updated: number; total: number }
  }
}

export async function importLeadsJson(body: {
  leads: { name: string; company?: string; email?: string; phone?: string; notes?: string }[]
  createdBy: string
  createdById?: string | null
  source?: string
  importBatchId: string
  importUploaderName: string
}): Promise<{ created: number }> {
  const res = await fetch("/api/crm/leads/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Import failed")
  return res.json()
}

export async function patchLeadStatus(id: string, status: string): Promise<void> {
  const res = await fetch("/api/crm/leads", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  })
  if (!res.ok) throw new Error("Update failed")
}

export async function deleteLead(id: string): Promise<void> {
  const res = await fetch("/api/crm/leads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error("Delete failed")
}

/** Delete every lead that belongs to one CSV import batch (contacts cascade on the server). */
export async function deleteLeadsByImportBatch(importBatchId: string): Promise<{ deleted: number }> {
  const res = await fetch("/api/crm/leads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ importBatchId }),
  })
  if (!res.ok) throw new Error("Delete batch failed")
  return res.json() as Promise<{ deleted: number }>
}

export async function logLeadContact(body: {
  leadId: string
  contactedBy: string
  contactedById?: string | null
  contactedAt?: string
  screenshotUrls: string[]
  leadResponse: string
  notes?: string
}): Promise<CrmLeadContactRow> {
  const res = await fetch("/api/crm/leads/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Log failed")
  }
  return res.json()
}

export type DailyStatMember = { name: string; userId: string | null; count: number }

export async function fetchDailyStats(date: string): Promise<{
  date: string
  total: number
  byMember: DailyStatMember[]
}> {
  const res = await fetch(`/api/crm/leads/daily-stats?date=${encodeURIComponent(date)}`)
  if (!res.ok) return { date, total: 0, byMember: [] }
  return res.json()
}
