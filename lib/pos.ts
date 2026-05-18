export type PosTerminal = {
  id: string
  name: string
  code: string
  location: string
  isActive: boolean
  createdAt: string
}

export type PosCartItem = {
  stockId: string
  description: string
  unit: string
  unitPrice: number
  qty: number
  lineTotal: number
}

export type PosSale = {
  id: string
  receiptNumber: string
  terminalId: string
  terminalName: string
  items: PosCartItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
  cashierId: string
  cashierName: string
  customerName: string
  notes: string
  createdAt: string
}

export type PosStockProduct = {
  id: string
  description: string
  name: string
  unit: string
  availableQty: number
  costPrice: number
}

export async function ensurePosSetup(): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch("/api/db/pos/setup", { method: "POST" })
  if (!res.ok) return { ok: false, message: "Setup failed" }
  return res.json()
}

export async function getPosTerminals(): Promise<PosTerminal[]> {
  const res = await fetch("/api/db/pos/terminals")
  if (!res.ok) return []
  return res.json()
}

export async function savePosTerminal(
  terminal: Partial<PosTerminal> & { name: string; code: string },
): Promise<PosTerminal | null> {
  const res = await fetch("/api/db/pos/terminals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(terminal),
  })
  if (!res.ok) return null
  return res.json()
}

export async function deletePosTerminal(id: string): Promise<boolean> {
  const res = await fetch("/api/db/pos/terminals", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  return res.ok
}

export async function getPosStockProducts(all = false): Promise<PosStockProduct[]> {
  const res = await fetch(`/api/db/pos/products${all ? "?all=1" : ""}`)
  if (!res.ok) return []
  return res.json()
}

export async function receivePosManualLine(payload: {
  model: string
  qty: number
  unitPrice?: number
  receiveDate?: string
  scannedBy?: string
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/db/pos/receive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      receiveDate: payload.receiveDate,
      scannedBy: payload.scannedBy,
      manualLines: [
        {
          model: payload.model,
          qty: payload.qty,
          unitPrice: payload.unitPrice ?? 0,
          description: payload.model,
        },
      ],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: (data as { error?: string }).error || "Failed" }
  return { ok: true }
}

export async function getPosSales(terminalId?: string): Promise<PosSale[]> {
  const q = terminalId ? `?terminalId=${encodeURIComponent(terminalId)}` : ""
  const res = await fetch(`/api/db/pos/sales${q}`)
  if (!res.ok) return []
  return res.json()
}

export async function completePosSale(payload: {
  terminalId: string
  terminalName: string
  items: PosCartItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
  cashierId: string
  cashierName: string
  customerName: string
  notes: string
}): Promise<PosSale | null> {
  const res = await fetch("/api/db/pos/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Sale failed")
  }
  return res.json()
}

export function formatCurrency(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}
