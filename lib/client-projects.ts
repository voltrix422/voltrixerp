export type ClientProjectTxnType = "receipt" | "expense"

export interface ClientProjectTransaction {
  id: string
  type: ClientProjectTxnType
  amount: number
  date: string
  description: string
  receiptUrl: string
  receiptName: string
  createdBy: string
  createdAt: string
}

export interface ClientProject {
  id: string
  purchaseScopeId: string
  projectName: string
  clientName: string
  clientPhone: string
  budget: number
  notes: string
  status: "open" | "completed" | "cancelled"
  transactions: ClientProjectTransaction[]
  totalReceived: number
  totalExpenses: number
  /** Profit = client paid − expenses */
  profit: number
  /** Budget still outstanding from client */
  remainingFromClient: number
  createdBy: string
  createdAt: string
}

function parseTransactions(raw: unknown): ClientProjectTransaction[] {
  const list = Array.isArray(raw) ? raw : []
  return list.map((t, index) => ({
    id: String((t as ClientProjectTransaction).id ?? `txn-${index}`),
    type: (t as ClientProjectTransaction).type === "expense" ? "expense" : "receipt",
    amount: Number((t as ClientProjectTransaction).amount) || 0,
    date: String((t as ClientProjectTransaction).date ?? ""),
    description: String((t as ClientProjectTransaction).description ?? ""),
    receiptUrl: String((t as ClientProjectTransaction).receiptUrl ?? ""),
    receiptName: String((t as ClientProjectTransaction).receiptName ?? ""),
    createdBy: String((t as ClientProjectTransaction).createdBy ?? ""),
    createdAt: String((t as ClientProjectTransaction).createdAt ?? ""),
  }))
}

function mapStatus(raw: unknown): ClientProject["status"] {
  if (raw === "completed" || raw === "cancelled") return raw
  return "open"
}

function mapRow(row: Record<string, unknown>): ClientProject {
  const transactions = parseTransactions(row.transactions)
  const totalReceived =
    Number(row.totalReceived) ||
    transactions.filter((t) => t.type === "receipt").reduce((s, t) => s + t.amount, 0)
  const totalExpenses =
    Number(row.totalExpenses) ||
    transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
  const budget = Number(row.budget) || 0
  return {
    id: row.id as string,
    purchaseScopeId: (row.purchaseScopeId as string) || "P1",
    projectName: (row.projectName as string) ?? "",
    clientName: (row.clientName as string) ?? "",
    clientPhone: (row.clientPhone as string) ?? "",
    budget,
    notes: (row.notes as string) ?? "",
    status: mapStatus(row.status),
    transactions,
    totalReceived,
    totalExpenses,
    profit: totalReceived - totalExpenses,
    remainingFromClient: Math.max(0, budget - totalReceived),
    createdBy: (row.createdBy as string) ?? "",
    createdAt: row.createdAt as string,
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    if (data && typeof data.error === "string" && data.error) return data.error
  } catch {
    // ignore
  }
  return `${fallback} (HTTP ${res.status})`
}

export async function getClientProjects(purchaseScopeId?: string): Promise<ClientProject[]> {
  const qs = purchaseScopeId ? `?scope=${encodeURIComponent(purchaseScopeId)}` : ""
  const res = await fetch(`/api/db/client-projects${qs}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data ?? []).map(mapRow)
}

export async function saveClientProject(project: {
  id?: string
  purchaseScopeId: string
  projectName: string
  clientName?: string
  clientPhone?: string
  budget?: number
  notes?: string
  status?: ClientProject["status"]
  initialReceived?: number
  initialReceivedDate?: string
  initialReceivedReceiptUrl?: string
  initialReceivedReceiptName?: string
  createdBy?: string
}): Promise<ClientProject> {
  const res = await fetch("/api/db/client-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to save project"))
  return mapRow(await res.json())
}

export async function addClientProjectTransaction(
  id: string,
  transaction: Omit<ClientProjectTransaction, "id" | "createdAt"> & { id?: string },
): Promise<ClientProject> {
  const res = await fetch("/api/db/client-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addTransaction", id, transaction }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to record transaction"))
  return mapRow(await res.json())
}

export async function deleteClientProjectTransaction(
  id: string,
  transactionId: string,
): Promise<ClientProject> {
  const res = await fetch("/api/db/client-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deleteTransaction", id, transactionId }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to delete transaction"))
  return mapRow(await res.json())
}

export async function deleteClientProject(id: string): Promise<void> {
  await fetch("/api/db/client-projects", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export async function syncClientProjectsFromLedger(
  purchaseScopeId: string,
  createdBy?: string,
): Promise<{ createdCount: number; projects: ClientProject[] }> {
  const res = await fetch("/api/db/client-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "syncFromLedger", purchaseScopeId, createdBy }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to sync projects from ledger"))
  const data = await res.json()
  return {
    createdCount: Number(data.createdCount) || 0,
    projects: (data.projects ?? []).map(mapRow),
  }
}

export async function mergeClientProjects(input: {
  targetId: string
  sourceIds: string[]
  canonicalName?: string
}): Promise<{ project: ClientProject; mergedCount: number; ledgerUpdated: number }> {
  const res = await fetch("/api/db/client-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "merge", ...input }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to merge projects"))
  const data = await res.json()
  return {
    project: mapRow(data.project),
    mergedCount: Number(data.mergedCount) || 0,
    ledgerUpdated: Number(data.ledgerUpdated) || 0,
  }
}
