"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Plus,
  ChevronDown,
  Loader2,
  Minus,
  PackagePlus,
  Trash2,
  X,
  Search,
  SlidersHorizontal,
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
  "w-full h-7 border border-[hsl(var(--border))] bg-transparent px-2 text-xs focus:outline-none"

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
  const [showFilters, setShowFilters] = useState(false)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null)
  const filterBtnRef = useRef<HTMLButtonElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
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

  useEffect(() => {
    if (!showFilters) {
      setFilterPos(null)
      return
    }
    function place() {
      const btn = filterBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const panelW = Math.min(300, window.innerWidth - 24)
      const left = Math.min(Math.max(12, r.right - panelW), window.innerWidth - panelW - 12)
      const top = Math.min(r.bottom + 8, window.innerHeight - 24)
      setFilterPos({ top, left })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [showFilters])

  useEffect(() => {
    if (!showFilters) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (filtersRef.current?.contains(t) || filterBtnRef.current?.contains(t)) return
      setShowFilters(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [showFilters])

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
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#86868b]">
          <span>Items <span className="tabular-nums font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{itemCount}</span></span>
          <span>Total <span className="tabular-nums font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{totalQty}</span></span>
          <span>Available <span className="tabular-nums font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{availableTotal}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            className="h-8 rounded-full px-3 text-[11px] gap-1 border-black/[0.08] bg-white dark:bg-[hsl(var(--card))]"
            onClick={() => setShowAdd(true)}
          >
            <PackagePlus className="h-3 w-3" />
            Add item
          </Button>
          <button
            ref={filterBtnRef}
            type="button"
            onClick={() => setShowFilters((o) => !o)}
            className={`relative h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              showFilters
                ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                : "text-[#86868b] hover:bg-black/[0.05] hover:text-[#1d1d1f]"
            }`}
            aria-label="Filters"
            aria-expanded={showFilters}
            title="Filters"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            {search.trim() && !showFilters && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#007aff]" />
            )}
          </button>
        </div>
      </div>

      {showFilters &&
        filterPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={filtersRef}
            className="fixed z-[95] w-[min(18rem,calc(100vw-1.5rem))] rounded-[18px] border border-black/[0.06] bg-white/92 dark:bg-[hsl(var(--card))]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-3 space-y-2.5"
            style={{ top: filterPos.top, left: filterPos.left }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold tracking-tight">Filters</p>
              <div className="flex items-center gap-2">
                {search.trim() ? (
                  <button type="button" onClick={() => setSearch("")} className="text-[11px] font-semibold text-[#0071e3] cursor-pointer">
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item, model…"
                className="w-full h-8 pl-8 pr-2.5 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
              />
            </div>
          </div>,
          document.body,
        )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-[#86868b]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-[13px]">Loading…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-[#86868b] rounded-[16px] border border-dashed border-black/[0.08]">
          <PackagePlus className="h-9 w-9 opacity-30 mb-3" />
          <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">No manual items yet</p>
          <p className="text-[12px] mt-1">Add your first item with name and quantity.</p>
          <Button
            variant="outline"
            className="mt-4 h-8 px-3 text-[11px] gap-1 rounded-full"
            onClick={() => setShowAdd(true)}
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Add item
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-[#86868b] rounded-[16px] border border-dashed border-black/[0.08]">
          No items match &ldquo;{search.trim()}&rdquo;
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filteredItems.map((item) => {
              const serials = item.serialUnits ?? []
              const expanded = expandedItems[item.id] === true
              const hasSerials = serials.length > 0
              return (
                <div
                  key={item.id}
                  className="rounded-[16px] border border-black/[0.04] bg-white/90 dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--card))] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
                >
                  <div className="p-3.5 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] leading-snug line-clamp-2">
                        {item.name}
                      </p>
                      {hasSerials ? (
                        <button
                          type="button"
                          className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.05] cursor-pointer"
                          onClick={() =>
                            setExpandedItems((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                          }
                          aria-expanded={expanded}
                        >
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "" : "-rotate-90"}`} />
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[10px] font-mono text-[#86868b] truncate">{item.model}</p>
                    {item.notes ? (
                      <p className="mt-1 text-[11px] text-[#86868b] line-clamp-1">{item.notes}</p>
                    ) : null}
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-[20px] font-semibold tracking-tight tabular-nums leading-none text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                          {item.availableQty}
                          <span className="text-[12px] font-medium text-[#86868b]">/{item.qty}</span>
                        </p>
                        <p className="mt-1 text-[10px] text-[#86868b]">
                          {item.unit}
                          {hasSerials
                            ? ` · ${serials.filter((s) => s.status === "in_stock").length}/${serials.length} SN`
                            : ""}
                        </p>
                      </div>
                      <p className="text-[10px] text-[#aeaeb2]">
                        {new Date(item.lastAddedAt || item.createdAt).toLocaleDateString("en-PK")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-0.5 px-2.5 pb-2.5">
                    <button
                      type="button"
                      className="h-7 min-w-7 px-1.5 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.05] text-[10px] font-bold cursor-pointer"
                      onClick={() => openAddQty(item, "units")}
                      title="Add to total units"
                    >
                      U+
                    </button>
                    <button
                      type="button"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.05] disabled:opacity-40 cursor-pointer"
                      onClick={() => openAddQty(item, "stock")}
                      disabled={item.availableQty >= item.qty}
                      title="Add to available stock"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.05] disabled:opacity-40 cursor-pointer"
                      onClick={() => openSubtract(item, "stock")}
                      disabled={item.availableQty <= 0}
                      title="Subtract from stock"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="h-7 min-w-7 px-1.5 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.05] disabled:opacity-40 text-[10px] font-bold cursor-pointer"
                      onClick={() => openSubtract(item, "units")}
                      disabled={item.qty <= 0}
                      title="Subtract from units"
                    >
                      U−
                    </button>
                    <button
                      type="button"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#86868b] hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                      onClick={() => void handleDelete(item)}
                      title="Delete item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {expanded && hasSerials && (
                    <div className="border-t border-black/[0.04] px-3 py-2 space-y-1.5 bg-[#fafafa]/80 dark:bg-white/[0.02]">
                      {serials.map((unit) => {
                        const orderRef = parseSerialOrderRef(unit.notes, unit.specs)
                        const client = parseSerialDispatchClient(unit.notes)
                        return (
                          <div key={unit.id} className="flex items-start justify-between gap-2 text-[10px]">
                            <div className="min-w-0">
                              <p className="font-mono font-medium truncate">{unit.serialNumber}</p>
                              <p className="text-[#86868b] truncate">
                                {serialStatusLabel(unit.status)}
                                {orderRef ? ` · ${orderRef}` : ""}
                                {client ? ` · ${client}` : ""}
                              </p>
                            </div>
                            <span className="shrink-0 tabular-nums text-[#aeaeb2]">
                              {new Date(unit.scannedAt).toLocaleDateString("en-PK")}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showAdd &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xl p-4"
          onClick={() => !saving && setShowAdd(false)}
        >
          <form
            className="w-full max-w-md rounded-[20px] border border-black/[0.06] bg-white/95 dark:bg-[hsl(var(--card))] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleAdd(e)}
          >
            <div className="flex items-center justify-between pb-1">
              <p className="text-[14px] font-semibold tracking-tight">Add manual inventory</p>
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
                className="w-full min-h-[72px] border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-xs font-mono focus:outline-none resize-none"
                placeholder="One SN per line — or leave empty"
                value={serialText}
                onChange={(e) => setSerialText(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-8 text-[11px] rounded-full"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save item"}
            </Button>
          </form>
        </div>,
        document.body,
      )}

      {showAddQty && restockItem &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xl p-4"
          onClick={() => !restocking && setShowAddQty(false)}
        >
          <form
            className="w-full max-w-md rounded-[20px] border border-black/[0.06] bg-white/95 dark:bg-[hsl(var(--card))] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleAddQty(e)}
          >
            <div className="flex items-center justify-between pb-1">
              <p className="text-[14px] font-semibold tracking-tight">Add quantity</p>
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
              className="w-full h-8 text-[11px] rounded-full"
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
        </div>,
        document.body,
      )}

      {showSubtract && subtractItem &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xl p-4"
          onClick={() => !subtracting && setShowSubtract(false)}
        >
          <form
            className="w-full max-w-md rounded-[20px] border border-black/[0.06] bg-white/95 dark:bg-[hsl(var(--card))] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleSubtract(e)}
          >
            <div className="flex items-center justify-between pb-1">
              <p className="text-[14px] font-semibold tracking-tight">
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
              className="w-full h-8 text-[11px] rounded-full"
              disabled={subtracting}
            >
              {subtracting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Subtract"}
            </Button>
          </form>
        </div>,
        document.body,
      )}
    </div>
  )
}
