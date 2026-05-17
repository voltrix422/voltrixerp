export type InventoryModelLabel = {
  id: string
  model: string
  displayName: string
  updatedAt: string
}

function mapRow(row: Record<string, unknown>): InventoryModelLabel {
  return {
    id: String(row.id),
    model: String(row.model ?? ""),
    displayName: String(row.displayName ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
  }
}

export async function getInventoryModelLabels(): Promise<InventoryModelLabel[]> {
  const res = await fetch("/api/db/inventory-model-labels")
  if (!res.ok) throw new Error("Failed to load model names")
  const data = await res.json()
  return (data ?? []).map(mapRow)
}

export async function saveInventoryModelLabel(model: string, displayName: string): Promise<InventoryModelLabel> {
  const res = await fetch("/api/db/inventory-model-labels", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, displayName }),
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.error || "Failed to save model name")
  }
  return mapRow(await res.json())
}
