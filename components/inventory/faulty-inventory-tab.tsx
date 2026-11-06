"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  getFaultyInventory,
  restoreManualQtyFromFaulty,
  restoreSerialFromFaulty,
  restoreStockQtyFromFaulty,
  type FaultyInventoryGroup,
} from "@/lib/faulty-inventory"
import { getSession } from "@/lib/auth"
import { useToast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Loader2, Search, ChevronDown, SlidersHorizontal, X } from "lucide-react"

function formatDate(iso?: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-PK")
  } catch {
    return iso
  }
}

export function FaultyInventoryTab() {
  const { toast } = useToast()
  const [groups, setGroups] = useState<FaultyInventoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({})
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restoreDialog, setRestoreDialog] = useState<{
    group: FaultyInventoryGroup
    qty: string
  } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null)
  const filterBtnRef = useRef<HTMLButtonElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getFaultyInventory()
      setGroups(data.groups)
    } catch {
      toast({ title: "Error", message: "Could not load faulty/damaged inventory.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) return
    setOpenKeys((prev) => {
      const next = { ...prev }
      for (const g of groups) {
        const hit =
          g.modelKey.toLowerCase().includes(q) ||
          g.displayName.toLowerCase().includes(q) ||
          g.serialUnits.some((u) => u.serialNumber.toLowerCase().includes(q))
        if (hit) next[g.modelKey] = true
      }
      return next
    })
  }, [search, groups])

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(
      (g) =>
        g.modelKey.toLowerCase().includes(q) ||
        g.displayName.toLowerCase().includes(q) ||
        g.serialUnits.some((u) => u.serialNumber.toLowerCase().includes(q)),
    )
  }, [groups, search])

  const totalQty = filtered.reduce((sum, g) => sum + g.faultyQty, 0)

  async function handleRestoreSerial(unitId: string, serialNumber: string) {
    setRestoringId(unitId)
    try {
      await restoreSerialFromFaulty({
        unitId,
        actor: getSession()?.name || "Inventory",
      })
      await load()
      toast({
        title: "Restored",
        message: `${serialNumber} moved back to main inventory.`,
        type: "success",
      })
    } catch (err) {
      toast({
        title: "Could not restore",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setRestoringId(null)
    }
  }

  async function confirmQtyRestore() {
    if (!restoreDialog) return
    const qty = Math.floor(Number(restoreDialog.qty))
    const max = restoreDialog.group.faultyQty
    if (!Number.isFinite(qty) || qty <= 0 || qty > max) return

    const actor = getSession()?.name || "Inventory"
    const group = restoreDialog.group
    setRestoringId(group.manualId || group.stockId || group.modelKey)
    try {
      if (group.manualId) {
        await restoreManualQtyFromFaulty({ manualId: group.manualId, qty, actor })
      } else if (group.stockId) {
        await restoreStockQtyFromFaulty({ stockId: group.stockId, qty, actor })
      }
      setRestoreDialog(null)
      await load()
      toast({
        title: "Restored",
        message: `${qty} ${group.unit} moved back to main inventory.`,
        type: "success",
      })
    } catch (err) {
      toast({
        title: "Could not restore",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setRestoringId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[13px] text-[#86868b]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading faulty/damaged inventory…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[#86868b]">
          <span className="tabular-nums font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{totalQty}</span>{" "}
          {totalQty === 1 ? "unit" : "units"} excluded from sellable stock
        </p>
        <button
          ref={filterBtnRef}
          type="button"
          onClick={() => setShowFilters((v) => !v)}
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
                placeholder="Search model, name, or serial…"
                className="w-full h-8 pl-8 pr-2.5 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
              />
            </div>
          </div>,
          document.body,
        )}

      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#86868b] py-10 text-center rounded-[16px] border border-black/[0.06] bg-white dark:bg-[hsl(var(--card))]">
          No faulty or damaged items recorded yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filtered.map((group) => {
            const open = openKeys[group.modelKey] === true
            const modelLabel =
              group.aliasModelKeys && group.aliasModelKeys.length > 1
                ? group.aliasModelKeys.join(" · ")
                : group.modelKey
            return (
              <div
                key={group.modelKey}
                className="rounded-[16px] border border-black/[0.04] bg-white/90 dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--card))] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full text-left p-3.5 cursor-pointer hover:bg-black/[0.02] transition-colors"
                  onClick={() => setOpenKeys((prev) => ({ ...prev, [group.modelKey]: !prev[group.modelKey] }))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] leading-snug line-clamp-2">
                      {group.displayName}
                    </p>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#86868b] transition-transform ${open ? "" : "-rotate-90"}`}
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-mono text-[#86868b] truncate">{modelLabel}</p>
                  <p className="mt-3 text-[20px] font-semibold tracking-tight tabular-nums leading-none text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                    {group.faultyQty}
                    <span className="text-[12px] font-medium text-[#86868b] ml-1">{group.unit}</span>
                  </p>
                </button>
                {open && (
                  <div className="border-t border-black/[0.04] dark:border-[hsl(var(--border))] px-3 py-2.5 space-y-2 bg-[#fafafa]/80 dark:bg-white/[0.02]">
                    {group.serialUnits.length > 0 ? (
                      group.serialUnits.map((unit) => (
                        <div key={unit.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-[11px]">
                              <span className="font-mono font-medium">{unit.serialNumber}</span>
                              {unit.orderNumber ? (
                                <span className="text-[#86868b]"> · {unit.orderNumber}</span>
                              ) : null}
                              <span className="text-[#86868b]"> · {formatDate(unit.scannedAt)}</span>
                            </p>
                            {unit.replaceReason ? (
                              <p className="text-[10px] text-[#86868b]">Reason: {unit.replaceReason}</p>
                            ) : unit.notes?.trim() ? (
                              <p className="text-[10px] text-[#86868b] line-clamp-2">{unit.notes.trim()}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="h-7 px-2.5 rounded-full text-[11px] font-semibold border border-black/[0.08] bg-white cursor-pointer disabled:opacity-50 shrink-0"
                            disabled={restoringId === unit.id}
                            onClick={() => void handleRestoreSerial(unit.id, unit.serialNumber)}
                          >
                            {restoringId === unit.id ? "…" : "Restore"}
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-[#86868b]">No serials · qty only</p>
                        {group.manualId || group.stockId ? (
                          <button
                            type="button"
                            className="h-7 px-2.5 rounded-full text-[11px] font-semibold border border-black/[0.08] bg-white cursor-pointer disabled:opacity-50"
                            disabled={Boolean(restoringId)}
                            onClick={() => setRestoreDialog({ group, qty: String(group.faultyQty) })}
                          >
                            Restore
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {restoreDialog &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xl p-4"
            onClick={() => setRestoreDialog(null)}
          >
            <div
              className="w-full max-w-sm rounded-[20px] border border-black/[0.06] bg-white/95 dark:bg-[hsl(var(--card))] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[14px] font-semibold tracking-tight">Restore to main inventory</p>
              <p className="text-[12px] text-[#86868b]">{restoreDialog.group.displayName}</p>
              <p className="text-[11px] text-[#86868b]">
                Faulty qty:{" "}
                <span className="font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                  {restoreDialog.group.faultyQty}
                </span>{" "}
                {restoreDialog.group.unit}
              </p>
              <input
                type="number"
                min={1}
                max={restoreDialog.group.faultyQty}
                value={restoreDialog.qty}
                onChange={(e) => setRestoreDialog({ ...restoreDialog, qty: e.target.value })}
                className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-3 text-[13px] focus:outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" className="h-8 rounded-full text-[11px]" onClick={() => setRestoreDialog(null)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" className="h-8 rounded-full text-[11px]" disabled={Boolean(restoringId)} onClick={() => void confirmQtyRestore()}>
                  Restore
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
