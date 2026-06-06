"use client"

import { useCallback, useEffect, useMemo, useState, Fragment } from "react"
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  Minus,
  PackagePlus,
  Trash2,
  X,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { getSession } from "@/lib/auth"
import {
  addManualInventoryStock,
  addManualInventoryUnits,
  createManualInventoryItem,
  deleteManualInventoryItem,
  getManualInventoryItems,
  subtractManualInventoryStock,
  subtractManualInventoryUnits,
  type ManualInventoryItem,
} from "@/lib/manual-inventory"
import {
  parseSerialDispatchClient,
  parseSerialOrderRef,
  serialStatusLabel,
} from "@/lib/parse-serial-order-ref"

const fieldClass =
  "w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]/40"

export function ManualInventoryTab() {
  const { toast } = useToast()
  const [items, setItems] = useState<ManualInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")

  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState("")
  const [qty, setQty] = useState("")
  const [unit, setUnit] = useState("pcs")
  const [notes, setNotes] = useState("")
  const [serialText, setSerialText] = useState("")

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const [showAddQty, setShowAddQty] = useState(false)
  const [addMode, setAddMode] = useState<"units" | "stock">("units")
  const [restockItem, setRestockItem] = useState<ManualInventoryItem | null>(null)
  const [restockQty, setRestockQty] = useState("")
  const [restockNotes, setRestockNotes] = useState("")
  const [restocking, setRestocking] = useState(false)
  const [showSubtract, setShowSubtract] = useState(false)
  const [subtractItem, setSubtractItem] = useState<ManualInventoryItem | null>(null)
  const [subtractMode, setSubtractMode] = useState<"stock" | "units">("stock")
  const [subtractQty, setSubtractQty] = useState("")
  const [subtracting, setSubtracting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getManualInventoryItems()
      setItems(data)
    } catch (e) {
      toast({
        title: "Could not load manual inventory",
        message: e instanceof Error ? e.message : "Unknown error",
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        (item.notes || "").toLowerCase().includes(q),
    )
  }, [items, search])

  const itemCount = items.length
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0)
  const availableTotal = items.reduce((sum, i) => sum + i.availableQty, 0)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const q = Number(qty)
    if (!name.trim()) {
      toast({ title: "Name required", type: "error" })
      return
    }
    if (!Number.isFinite(q) || q <= 0) {
      toast({ title: "Enter a valid quantity", type: "error" })
      return
    }

    const serialNumbers = serialText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    setSaving(true)
    try {
      const user = getSession()?.name || "Inventory"
      await createManualInventoryItem({
        name: name.trim(),
        qty: q,
        unit: unit.trim() || "pcs",
        notes: notes.trim(),
        createdBy: user,
        serialNumbers: serialNumbers.length > 0 ? serialNumbers : undefined,
      })
      toast({ title: "Item added to manual inventory", type: "success" })
      setShowAdd(false)
      setName("")
      setQty("")
      setNotes("")
      setSerialText("")
      await load()
    } catch (err) {
      toast({
        title: "Failed to add item",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: ManualInventoryItem) {
    if (!confirm(`Delete "${item.name}" from manual inventory?`)) return
    try {
      await deleteManualInventoryItem(item.id)
      toast({ title: "Deleted", type: "success" })
      await load()
    } catch (err) {
      toast({
        title: "Delete failed",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    }
  }

  function openAddQty(item: ManualInventoryItem, mode: "units" | "stock") {
    setRestockItem(item)
    setAddMode(mode)
    setRestockQty("1")
    setRestockNotes("")
    setShowAddQty(true)
  }

  function openSubtract(item: ManualInventoryItem, mode: "stock" | "units") {
    setSubtractItem(item)
    setSubtractMode(mode)
    setSubtractQty("1")
    setShowSubtract(true)
  }

  async function handleSubtract(e: React.FormEvent) {
    e.preventDefault()
    if (!subtractItem) return
    const q = Math.floor(Number(subtractQty))
    const max = subtractMode === "stock" ? subtractItem.availableQty : subtractItem.qty
    if (!Number.isFinite(q) || q <= 0 || q > max) {
      toast({ title: "Enter a valid quantity", type: "error" })
      return
    }
    setSubtracting(true)
    try {
      const user = getSession()?.name || "Inventory"
      if (subtractMode === "stock") {
        await subtractManualInventoryStock({ manualId: subtractItem.id, qty: q, subtractedBy: user })
        toast({ title: "Stock subtracted", type: "success" })
      } else {
        await subtractManualInventoryUnits({ manualId: subtractItem.id, qty: q, subtractedBy: user })
        toast({ title: "Units subtracted", type: "success" })
      }
      setShowSubtract(false)
      setSubtractItem(null)
      setSubtractQty("")
      await load()
    } catch (err) {
      toast({
        title: "Could not subtract",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setSubtracting(false)
    }
  }

  async function handleAddQty(e: React.FormEvent) {
    e.preventDefault()
    if (!restockItem) return
    const q = Math.floor(Number(restockQty))
    const max =
      addMode === "units"
        ? Infinity
        : Math.max(0, restockItem.qty - restockItem.availableQty)
    if (!Number.isFinite(q) || q <= 0 || (addMode === "stock" && q > max)) {
      toast({ title: "Enter a valid quantity", type: "error" })
      return
    }
    setRestocking(true)
    try {
      const user = getSession()?.name || "Inventory"
      if (addMode === "units") {
        await addManualInventoryUnits({
          manualId: restockItem.id,
          qty: q,
          addedBy: user,
          notes: restockNotes.trim() || undefined,
        })
        toast({ title: "Added to total units", type: "success" })
      } else {
        await addManualInventoryStock({
          manualId: restockItem.id,
          qty: q,
          addedBy: user,
          notes: restockNotes.trim() || undefined,
        })
        toast({ title: "Added to available stock", type: "success" })
      }
      setShowAddQty(false)
      setRestockItem(null)
      setRestockQty("")
      setRestockNotes("")
      await load()
    } catch (err) {
      toast({
        title: addMode === "units" ? "Could not add units" : "Could not add stock",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setRestocking(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 min-h-0 h-[calc(100vh-11rem)]">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))] shrink-0">
          <span className="tabular-nums">
            <span className="font-semibold text-[hsl(var(--foreground))]">{itemCount}</span> items
          </span>
          <span className="text-[hsl(var(--border))]">·</span>
          <span className="tabular-nums">
            <span className="font-semibold text-[hsl(var(--foreground))]">{totalQty}</span> total qty
          </span>
          <span className="text-[hsl(var(--border))]">·</span>
          <span className="tabular-nums">
            <span className="font-semibold text-[#1faca6]">{availableTotal}</span> available
          </span>
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item, model…"
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]/40"
          />
        </div>
        <Button
          className="h-8 px-2.5 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white gap-1.5 shrink-0 cursor-pointer"
          onClick={() => setShowAdd(true)}
        >
          <PackagePlus className="h-3.5 w-3.5" />
          Add item
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-[hsl(var(--muted-foreground))] rounded-lg border border-dashed">
          <PackagePlus className="h-9 w-9 opacity-30 mb-3" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No manual items yet</p>
          <p className="text-xs mt-1">Add your first item with name and quantity.</p>
          <Button
            className="mt-4 h-8 px-3 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white gap-1.5 cursor-pointer"
            onClick={() => setShowAdd(true)}
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Add item
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))] rounded-lg border border-dashed">
          No items match &ldquo;{search.trim()}&rdquo;
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border">
          <div className="h-full overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[hsl(var(--background))] border-b">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 min-w-[140px]">Item</th>
                  <th className="px-3 py-2 min-w-[120px]">Model</th>
                  <th className="px-3 py-2 text-right w-24">Total</th>
                  <th className="px-3 py-2 text-right w-24">Available</th>
                  <th className="px-3 py-2 w-24">Last added</th>
                  <th className="px-3 py-2 text-right w-20">Serials</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const serials = item.serialUnits ?? []
                  const expanded = expandedItems[item.id] === true
                  const hasSerials = serials.length > 0
                  const lowStock = item.availableQty > 0 && item.availableQty < item.qty * 0.2
                  return (
                    <Fragment key={item.id}>
                      <tr className="border-b last:border-b-0 hover:bg-[hsl(var(--muted))]/10">
                        <td className="px-3 py-2.5 align-top">
                          {hasSerials ? (
                            <button
                              type="button"
                              className="p-0.5 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                              onClick={() =>
                                setExpandedItems((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                              }
                              aria-expanded={expanded}
                            >
                              {expanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <p className="font-medium text-[hsl(var(--foreground))] leading-snug">{item.name}</p>
                          {item.notes ? (
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">
                              {item.notes}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 align-top font-mono text-[11px] text-[hsl(var(--muted-foreground))] break-all">
                          {item.model}
                        </td>
                        <td className="px-3 py-2.5 align-top text-right tabular-nums whitespace-nowrap">
                          {item.qty} {item.unit}
                        </td>
                        <td className="px-3 py-2.5 align-top text-right tabular-nums whitespace-nowrap">
                          <span
                            className={
                              item.availableQty <= 0
                                ? "text-[hsl(var(--muted-foreground))]"
                                : lowStock
                                  ? "font-semibold text-amber-600"
                                  : "font-semibold text-[#1faca6]"
                            }
                          >
                            {item.availableQty} {item.unit}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top text-[11px] text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                          {new Date(item.lastAddedAt || item.createdAt).toLocaleDateString("en-PK")}
                        </td>
                        <td className="px-3 py-2.5 align-top text-right tabular-nums text-[11px] text-[hsl(var(--muted-foreground))]">
                          {serials.length > 0 ? (
                            <span>
                              {serials.filter((s) => s.status === "in_stock").length}/{serials.length}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              className="p-1.5 rounded-md text-[#1faca6] hover:bg-[#1faca6]/10 cursor-pointer"
                              onClick={() => openAddQty(item, "units")}
                              title="Add to total units"
                            >
                              <span className="text-[10px] font-bold leading-none">U+</span>
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-500/10 cursor-pointer disabled:opacity-40"
                              onClick={() => openAddQty(item, "stock")}
                              disabled={item.availableQty >= item.qty}
                              title="Add to available stock"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-md text-amber-600 hover:bg-amber-500/10 cursor-pointer disabled:opacity-40"
                              onClick={() => openSubtract(item, "stock")}
                              disabled={item.availableQty <= 0}
                              title="Subtract from stock"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-md text-orange-600 hover:bg-orange-500/10 cursor-pointer disabled:opacity-40"
                              onClick={() => openSubtract(item, "units")}
                              disabled={item.qty <= 0}
                              title="Subtract from units"
                            >
                              <span className="text-[10px] font-bold leading-none">U−</span>
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-md text-red-600 hover:bg-red-500/10 cursor-pointer"
                              onClick={() => void handleDelete(item)}
                              title="Delete item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded && hasSerials && (
                        <tr className="border-b bg-[hsl(var(--muted))]/5">
                          <td colSpan={8} className="px-3 py-2">
                            <div className="rounded-md border overflow-hidden">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="border-b text-[hsl(var(--muted-foreground))]">
                                    <th className="px-2.5 py-1.5 text-left font-semibold">Serial</th>
                                    <th className="px-2.5 py-1.5 text-left font-semibold">Status</th>
                                    <th className="px-2.5 py-1.5 text-left font-semibold">Order</th>
                                    <th className="px-2.5 py-1.5 text-left font-semibold">Client</th>
                                    <th className="px-2.5 py-1.5 text-left font-semibold">Scanned</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {serials.map((unit) => {
                                    const orderRef = parseSerialOrderRef(unit.notes, unit.specs)
                                    const client = parseSerialDispatchClient(unit.notes)
                                    return (
                                      <tr key={unit.id} className="border-b last:border-b-0">
                                        <td className="px-2.5 py-1.5 font-mono font-medium break-all">
                                          {unit.serialNumber}
                                        </td>
                                        <td className="px-2.5 py-1.5 capitalize">
                                          {serialStatusLabel(unit.status)}
                                        </td>
                                        <td className="px-2.5 py-1.5 font-mono">{orderRef ?? "—"}</td>
                                        <td className="px-2.5 py-1.5">{client ?? "—"}</td>
                                        <td className="px-2.5 py-1.5 tabular-nums text-[hsl(var(--muted-foreground))]">
                                          {new Date(unit.scannedAt).toLocaleDateString("en-PK")}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => !saving && setShowAdd(false)}
        >
          <form
            className="w-full max-w-md rounded-lg border bg-[hsl(var(--card))] p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleAdd(e)}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <p className="text-sm font-semibold">Add manual inventory</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={() => setShowAdd(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Item name *</label>
              <input
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Battery 150Ah"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Quantity *</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={fieldClass}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Unit</label>
                <input className={fieldClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Notes</label>
              <input className={fieldClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Serial numbers (optional)</label>
              <textarea
                className="w-full min-h-[72px] rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1faca6]/40"
                placeholder="One SN per line — or leave empty"
                value={serialText}
                onChange={(e) => setSerialText(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-9 text-sm cursor-pointer bg-[#1faca6] hover:bg-[#17857f] text-white"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save item"}
            </Button>
          </form>
        </div>
      )}

      {showAddQty && restockItem && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => !restocking && setShowAddQty(false)}
        >
          <form
            className="w-full max-w-md rounded-lg border bg-[hsl(var(--card))] p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleAddQty(e)}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <p className="text-sm font-semibold">Add quantity</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={() => setShowAddQty(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {restockItem.name}{" "}
              <span className="font-mono">({restockItem.model})</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Quantity to add *</label>
              <input
                type="number"
                min={1}
                step={1}
                className={fieldClass}
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Notes (optional)</label>
              <input
                className={fieldClass}
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                placeholder="e.g. New lot received"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-9 text-sm cursor-pointer bg-[#1faca6] hover:bg-[#17857f] text-white"
              disabled={restocking}
            >
              {restocking ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : addMode === "units" ? (
                "Add to total"
              ) : (
                "Add to stock"
              )}
            </Button>
          </form>
        </div>
      )}

      {showSubtract && subtractItem && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => !subtracting && setShowSubtract(false)}
        >
          <form
            className="w-full max-w-md rounded-lg border bg-[hsl(var(--card))] p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleSubtract(e)}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <p className="text-sm font-semibold">
                {subtractMode === "stock" ? "Subtract from stock" : "Subtract from units"}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={() => setShowSubtract(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {subtractItem.name}{" "}
              <span className="font-mono">({subtractItem.model})</span>
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {subtractMode === "stock" ? (
                <>
                  Available: <span className="font-semibold text-[hsl(var(--foreground))]">{subtractItem.availableQty}</span> / {subtractItem.qty} {subtractItem.unit}
                </>
              ) : (
                <>
                  Total units: <span className="font-semibold text-[hsl(var(--foreground))]">{subtractItem.qty}</span> {subtractItem.unit} ({subtractItem.availableQty} in stock)
                </>
              )}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Quantity to subtract *</label>
              <input
                type="number"
                min={1}
                max={subtractMode === "stock" ? subtractItem.availableQty : subtractItem.qty}
                step={1}
                className={fieldClass}
                value={subtractQty}
                onChange={(e) => setSubtractQty(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-9 text-sm cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
              disabled={subtracting}
            >
              {subtracting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Subtract"}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
