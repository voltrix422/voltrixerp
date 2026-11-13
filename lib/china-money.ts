export type ChinaMoneyTransfer = {
  id: string
  amount: number
  currency: string
  sentAt: string
  method: string
  reference: string
  beneficiary: string
  notes: string
  proofUrls: string[]
  createdBy: string
  createdById: string
  createdAt: string
  updatedAt: string
}

export type ChinaMoneyInput = {
  amount: number
  currency?: string
  sentAt: string
  method?: string
  reference?: string
  beneficiary?: string
  notes?: string
  proofUrls?: string[]
  createdBy?: string
  createdById?: string
}

function mapRow(row: Record<string, unknown>): ChinaMoneyTransfer {
  let proofUrls: string[] = []
  if (Array.isArray(row.proofUrls)) {
    proofUrls = row.proofUrls.map((u) => String(u ?? "").trim()).filter(Boolean)
  } else if (typeof row.proofUrls === "string") {
    try {
      const parsed = JSON.parse(row.proofUrls)
      if (Array.isArray(parsed)) proofUrls = parsed.map((u) => String(u ?? "").trim()).filter(Boolean)
    } catch {
      proofUrls = []
    }
  }
  return {
    id: String(row.id),
    amount: Number(row.amount) || 0,
    currency: String(row.currency || "USD"),
    sentAt: String(row.sentAt || ""),
    method: String(row.method || ""),
    reference: String(row.reference || ""),
    beneficiary: String(row.beneficiary || ""),
    notes: String(row.notes || ""),
    proofUrls,
    createdBy: String(row.createdBy || ""),
    createdById: String(row.createdById || ""),
    createdAt: row.createdAt ? new Date(String(row.createdAt)).toISOString() : "",
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)).toISOString() : "",
  }
}

export async function listChinaMoneyTransfers(): Promise<ChinaMoneyTransfer[]> {
  const res = await fetch("/api/db/china-money", { cache: "no-store" })
  if (!res.ok) throw new Error("Could not load transfers")
  const data = await res.json()
  return Array.isArray(data) ? data.map((r) => mapRow(r)) : []
}

export async function createChinaMoneyTransfer(input: ChinaMoneyInput): Promise<ChinaMoneyTransfer> {
  const res = await fetch("/api/db/china-money", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Could not save transfer")
  }
  return mapRow(await res.json())
}

export async function deleteChinaMoneyTransfer(id: string, actorUserId: string): Promise<void> {
  const res = await fetch("/api/db/china-money", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, actorUserId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Could not delete")
  }
}
