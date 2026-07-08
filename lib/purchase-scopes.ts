export type PurchaseScope = {
  id: string
  name: string
  active: boolean
}

export const DEFAULT_PURCHASE_SCOPES: PurchaseScope[] = [
  { id: "P1", name: "Main Office", active: true },
  { id: "P2", name: "Attock", active: true },
  { id: "P3", name: "Wah Cantt", active: true },
]

function mapRow(row: Record<string, unknown>): PurchaseScope {
  return {
    id: String(row.id || "").trim().toUpperCase(),
    name: String(row.name || "").trim() || String(row.id || ""),
    active: row.active !== false,
  }
}

export function purchaseScopeLabel(id: string, scopes?: PurchaseScope[]) {
  const code = String(id || "").trim().toUpperCase()
  if (!code) return ""
  const fromList = scopes?.find(s => s.id === code)?.name
  if (fromList) return fromList
  const fallback = DEFAULT_PURCHASE_SCOPES.find(s => s.id === code)?.name
  return fallback || code
}

export function formatPurchaseScope(id: string, scopes?: PurchaseScope[]) {
  const code = String(id || "").trim().toUpperCase()
  if (!code) return "—"
  const name = purchaseScopeLabel(code, scopes)
  return name === code ? code : `${name} (${code})`
}

export async function getPurchaseScopes(): Promise<PurchaseScope[]> {
  try {
    const res = await fetch("/api/db/purchase-scopes")
    if (!res.ok) return DEFAULT_PURCHASE_SCOPES
    const data = await res.json()
    const rows = Array.isArray(data) ? data.map(mapRow).filter((s: PurchaseScope) => s.id) : []
    return rows.length > 0 ? rows : DEFAULT_PURCHASE_SCOPES
  } catch {
    return DEFAULT_PURCHASE_SCOPES
  }
}

export async function savePurchaseScope(scope: PurchaseScope): Promise<PurchaseScope | null> {
  const res = await fetch("/api/db/purchase-scopes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scope),
  })
  if (!res.ok) return null
  return mapRow(await res.json())
}
