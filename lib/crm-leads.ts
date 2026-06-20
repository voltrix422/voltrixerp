export type CrmLeadRow = {
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
  followUpAt: string | null
  followUpNotes: string
  assignedToUserId: string | null
  assignedToName: string
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

export async function fetchLeads(options?: { assignedToUserId?: string | null }): Promise<CrmLeadRow[]> {
  const params = new URLSearchParams()
  if (options?.assignedToUserId) {
    params.set("assignedToUserId", options.assignedToUserId)
  }
  const qs = params.toString()
  const res = await fetch(`/api/crm/leads${qs ? `?${qs}` : ""}`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchLeadDetail(id: string): Promise<{
  lead: CrmLeadRow & { contacts: CrmLeadContactRow[] }
} | null> {
  const res = await fetch(`/api/crm/leads/${id}`, { cache: "no-store" })
  if (!res.ok) return null
  return res.json()
}

export async function fetchLeadContacts(leadId: string): Promise<CrmLeadContactRow[]> {
  const res = await fetch(`/api/crm/leads/contacts?leadId=${encodeURIComponent(leadId)}`, {
    cache: "no-store",
  })
  if (!res.ok) return []
  const data = (await res.json()) as { contacts?: CrmLeadContactRow[] }
  return Array.isArray(data.contacts) ? data.contacts : []
}

export async function importFacebookLeadAdsCsv(body: {
  csvText: string
  createdBy: string
  createdById?: string | null
  importUploaderName: string
  importBatchId?: string
}): Promise<{
  created: number
  importBatchId: string
  importUploaderName: string
  withPhone?: number
  phonesSynced?: number
}> {
  const res = await fetch("/api/crm/leads/import-facebook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Facebook import failed")
  return data as {
    created: number
    importBatchId: string
    importUploaderName: string
    withPhone?: number
    phonesSynced?: number
  }
}

/** Sync phones from uploaded Facebook CSV or bundled installers file on server. */
export async function syncPhonesFromCsvText(body: {
  csvText?: string
  importBatchId?: string
}): Promise<{
  updated: number
  total: number
  notMatched: number
  alreadyHad?: number
  lookupSize?: number
}> {
  const res = await fetch("/api/crm/leads/sync-phones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Sync phones failed")
  return data as {
    updated: number
    total: number
    notMatched: number
    alreadyHad?: number
    lookupSize?: number
  }
}

/** Fetch installers CSV from /public and sync phones (preferred on VPS). */
export async function syncInstallersPhonesFromBrowser(importBatchId?: string): Promise<{
  updated: number
  total: number
  notMatched: number
  alreadyHad?: number
  lookupSize?: number
}> {
  const { fetchInstallersLeadsCsvText } = await import("@/lib/installers-leads-csv-client")
  const csvText = await fetchInstallersLeadsCsvText()
  return syncPhonesFromCsvText({ csvText, importBatchId })
}

/** Sync phones from hardcoded public/Voltrix installers Leads 19 May 2026.csv */
export async function syncVoltrixInstallersPhones(importBatchId?: string): Promise<{
  updated: number
  total: number
  notMatched: number
}> {
  const res = await fetch("/api/crm/leads/sync-installers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(importBatchId ? { importBatchId } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Sync installers phones failed")
  return data as { updated: number; total: number; notMatched: number }
}

export async function importVoltrixInstallersLeads(body: {
  createdBy: string
  createdById?: string | null
  allowImport?: boolean
}): Promise<{
  mode: string
  created?: number
  allRepair?: { updated: number; total: number }
}> {
  const res = await fetch("/api/crm/leads/import-installers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Import installers failed")
  return data as { mode: string; created?: number; allRepair?: { updated: number; total: number } }
}

export async function importLeadsJson(body: {
  leads: {
    name: string
    company?: string
    city?: string
    address?: string
    email?: string
    phone?: string
    notes?: string
  }[]
  createdBy: string
  createdById?: string | null
  source?: string
  importBatchId: string
  importUploaderName: string
  csvText?: string
}): Promise<{ created: number; withPhone?: number; phonesSynced?: number }> {
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

export async function patchLeadAssignment(
  id: string,
  body: { assignedToUserId: string | null; assignedToName: string },
): Promise<{ assignedToUserId: string | null; assignedToName: string }> {
  const res = await fetch("/api/crm/leads", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Assignment update failed")
  return data as { assignedToUserId: string | null; assignedToName: string }
}

export async function patchLeadFollowUp(
  id: string,
  body: { followUpAt?: string | null; followUpNotes?: string },
): Promise<{ followUpAt: string | null; followUpNotes: string }> {
  const res = await fetch("/api/crm/leads", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Follow-up update failed")
  return data as { followUpAt: string | null; followUpNotes: string }
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

export async function renameLeadImportBatch(
  importBatchId: string,
  importUploaderName: string,
): Promise<{ updated: number; importUploaderName: string }> {
  const res = await fetch("/api/crm/leads/batches", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "rename", importBatchId, importUploaderName }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Rename failed")
  return data as { updated: number; importUploaderName: string }
}

export async function mergeLeadImportBatches(
  sourceImportBatchId: string,
  targetImportBatchId: string,
): Promise<{ merged: number; importUploaderName: string | null }> {
  const res = await fetch("/api/crm/leads/batches", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "merge", sourceImportBatchId, targetImportBatchId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Merge failed")
  return data as { merged: number; importUploaderName: string | null }
}

export async function logLeadContact(body: {
  leadId: string
  contactedBy: string
  contactedById?: string | null
  contactedAt?: string
  screenshotUrls: string[]
  leadResponse: string
  notes?: string
  followUpAt?: string | null
  followUpNotes?: string
}): Promise<
  CrmLeadContactRow & {
    followUpAt: string | null
    followUpNotes: string
  }
> {
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
