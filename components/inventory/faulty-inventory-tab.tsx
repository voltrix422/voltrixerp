"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { AlertTriangle, Loader2, RotateCcw, Search } from "lucide-react"

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
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restoreDialog, setRestoreDialog] = useState<{
    group: FaultyInventoryGroup
    qty: string
  } | null>(null)

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
      <div className="flex items-center justify-center py-20 text-sm text-[hsl(var(--muted-foreground))]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading faulty/damaged inventory...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Faulty / damaged stock
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            These quantities are excluded from main sellable inventory.
          </p>
        </div>
        <div className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
          {totalQty} faulty {totalQty === 1 ? "unit" : "units"}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search model, name, or serial..."
          className="w-full h-10 rounded-lg border bg-[hsl(var(--background))] pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No faulty or damaged items recorded yet.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden divide-y divide-[hsl(var(--border))]">
          {filtered.map((group) => (
            <div key={group.modelKey} className="bg-[hsl(var(--background))]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{group.displayName}</p>
                  <p className="text-xs font-mono text-[hsl(var(--muted-foreground))] truncate">{group.modelKey}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                    {group.faultyQty} {group.unit}
                  </span>
                  {(group.manualId || group.stockId) && group.serialUnits.length === 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={Boolean(restoringId)}
                      onClick={() => setRestoreDialog({ group, qty: String(group.faultyQty) })}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Restore
                    </Button>
                  ) : null}
                </div>
              </div>

              {group.serialUnits.length > 0 ? (
                <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/5">
                  {group.serialUnits.map((unit) => (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[hsl(var(--border))]/60 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs break-all">{unit.serialNumber}</p>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                          Marked {formatDate(unit.scannedAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs shrink-0"
                        disabled={restoringId === unit.id}
                        onClick={() => void handleRestoreSerial(unit.id, unit.serialNumber)}
                      >
                        {restoringId === unit.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Restore
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {restoreDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setRestoreDialog(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border bg-[hsl(var(--background))] p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Restore to main inventory</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{restoreDialog.group.displayName}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3 mb-2">
              Faulty qty: <span className="font-semibold text-[hsl(var(--foreground))]">{restoreDialog.group.faultyQty}</span>{" "}
              {restoreDialog.group.unit}
            </p>
            <input
              type="number"
              min={1}
              max={restoreDialog.group.faultyQty}
              value={restoreDialog.qty}
              onChange={(e) => setRestoreDialog({ ...restoreDialog, qty: e.target.value })}
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setRestoreDialog(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" className="h-8 text-xs" disabled={Boolean(restoringId)} onClick={() => void confirmQtyRestore()}>
                Restore
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
