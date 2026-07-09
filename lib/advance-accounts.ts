export type AdvanceTransactionType = "deposit" | "expense"

export interface AdvanceTransaction {
  id: string
  type: AdvanceTransactionType
  amount: number
  date: string
  description: string
  receiptUrl: string
  receiptName: string
  createdBy: string
  createdAt: string
}

export interface AdvanceAccount {
  id: string
  purchaseScopeId: string
  personName: string
  purpose: string
  notes: string
  status: "open" | "closed"
  transactions: AdvanceTransaction[]
  totalDeposited: number
  totalSpent: number
  balance: number
  createdBy: string
  createdAt: string
}

function parseTransactions(raw: unknown): AdvanceTransaction[] {
  const list = Array.isArray(raw) ? raw : []
  return list.map((t, index) => ({
    id: String((t as AdvanceTransaction).id ?? `txn-${index}`),
    type: (t as AdvanceTransaction).type === "expense" ? "expense" : "deposit",
    amount: Number((t as AdvanceTransaction).amount) || 0,
    date: String((t as AdvanceTransaction).date ?? ""),
    description: String((t as AdvanceTransaction).description ?? ""),
    receiptUrl: String((t as AdvanceTransaction).receiptUrl ?? ""),
    receiptName: String((t as AdvanceTransaction).receiptName ?? ""),
    createdBy: String((t as AdvanceTransaction).createdBy ?? ""),
    createdAt: String((t as AdvanceTransaction).createdAt ?? ""),
  }))
}

function mapRow(row: Record<string, unknown>): AdvanceAccount {
  const transactions = parseTransactions(row.transactions)
  const totalDeposited = Number(row.totalDeposited)
    || transactions.filter(t => t.type === "deposit").reduce((s, t) => s + t.amount, 0)
  const totalSpent = Number(row.totalSpent)
    || transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
  return {
    id: row.id as string,
    purchaseScopeId: (row.purchaseScopeId as string) || "P1",
    personName: (row.personName as string) ?? "",
    purpose: (row.purpose as string) ?? "",
    notes: (row.notes as string) ?? "",
    status: row.status === "closed" ? "closed" : "open",
    transactions,
    totalDeposited,
    totalSpent,
    balance: totalDeposited - totalSpent,
    createdBy: (row.createdBy as string) ?? "",
    createdAt: row.createdAt as string,
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    if (data && typeof data.error === "string" && data.error) return data.error
  } catch {
    // ignore non-JSON bodies
  }
  return `${fallback} (HTTP ${res.status})`
}

export async function getAdvanceAccounts(purchaseScopeId?: string): Promise<AdvanceAccount[]> {
  const qs = purchaseScopeId ? `?scope=${encodeURIComponent(purchaseScopeId)}` : ""
  const res = await fetch(`/api/db/advance-accounts${qs}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data ?? []).map(mapRow)
}

export async function saveAdvanceAccount(account: {
  id?: string
  purchaseScopeId: string
  personName: string
  purpose?: string
  notes?: string
  status?: "open" | "closed"
  initialDeposit?: number
  createdBy?: string
}): Promise<AdvanceAccount> {
  const res = await fetch("/api/db/advance-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(account),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to save advance account"))
  return mapRow(await res.json())
}

export async function addAdvanceTransaction(
  id: string,
  transaction: Omit<AdvanceTransaction, "id" | "createdAt"> & { id?: string },
): Promise<AdvanceAccount> {
  const res = await fetch("/api/db/advance-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addTransaction", id, transaction }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to record transaction"))
  return mapRow(await res.json())
}

export async function deleteAdvanceTransaction(id: string, transactionId: string): Promise<AdvanceAccount> {
  const res = await fetch("/api/db/advance-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deleteTransaction", id, transactionId }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to delete transaction"))
  return mapRow(await res.json())
}

export async function deleteAdvanceAccount(id: string): Promise<void> {
  await fetch("/api/db/advance-accounts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}
