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
import { Loader2, Search } from "lucide-react"

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          Faulty / damaged · excluded from sellable stock ·{" "}
          <span className="tabular-nums font-medium text-[hsl(var(--foreground))]">{totalQty}</span>{" "}
          {totalQty === 1 ? "unit" : "units"}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search model, name, or serial..."
          className="w-full h-7 border border-[hsl(var(--border))] bg-transparent pl-7 pr-2 text-[11px] focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-8">No faulty or damaged items recorded yet.</p>
      ) : (
        <div className="overflow-x-auto border border-[hsl(var(--border))]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <th className="h-8 px-2 font-medium">Item</th>
                <th className="h-8 px-2 font-medium">Model</th>
                <th className="h-8 px-2 font-medium text-right">Qty</th>
                <th className="h-8 px-2 font-medium">Serial / marked</th>
                <th className="h-8 px-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((group) => (
                group.serialUnits.length > 0 ? (
                  group.serialUnits.map((unit, idx) => (
                    <tr key={unit.id} className="border-b border-[hsl(var(--border))] last:border-0">
                      {idx === 0 ? (
                        <td className="px-2 py-1.5 align-top" rowSpan={group.serialUnits.length}>
                          {group.displayName}
                        </td>
                      ) : null}
                      {idx === 0 ? (
                        <td className="px-2 py-1.5 align-top font-mono text-[11px] text-[hsl(var(--muted-foreground))]" rowSpan={group.serialUnits.length}>
                          {group.modelKey}
                        </td>
                      ) : null}
                      {idx === 0 ? (
                        <td className="px-2 py-1.5 align-top text-right tabular-nums" rowSpan={group.serialUnits.length}>
                          {group.faultyQty} {group.unit}
                        </td>
                      ) : null}
                      <td className="px-2 py-1.5">
                        <span className="font-mono">{unit.serialNumber}</span>
                        <span className="text-[hsl(var(--muted-foreground))]"> · {formatDate(unit.scannedAt)}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          className="h-7 px-2 text-[11px] border border-[hsl(var(--border))] cursor-pointer disabled:opacity-50"
                          disabled={restoringId === unit.id}
                          onClick={() => void handleRestoreSerial(unit.id, unit.serialNumber)}
                        >
                          {restoringId === unit.id ? "…" : "Restore"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr key={group.modelKey} className="border-b border-[hsl(var(--border))] last:border-0">
                    <td className="px-2 py-1.5">{group.displayName}</td>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{group.modelKey}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{group.faultyQty} {group.unit}</td>
                    <td className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]">—</td>
                    <td className="px-2 py-1.5 text-right">
                      {(group.manualId || group.stockId) ? (
                        <button
                          type="button"
                          className="h-7 px-2 text-[11px] border border-[hsl(var(--border))] cursor-pointer disabled:opacity-50"
                          disabled={Boolean(restoringId)}
                          onClick={() => setRestoreDialog({ group, qty: String(group.faultyQty) })}
                        >
                          Restore
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {restoreDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setRestoreDialog(null)}
        >
          <div
            className="w-full max-w-sm border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Restore to main inventory</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{restoreDialog.group.displayName}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-3 mb-2">
              Faulty qty: <span className="font-medium text-[hsl(var(--foreground))]">{restoreDialog.group.faultyQty}</span>{" "}
              {restoreDialog.group.unit}
            </p>
            <input
              type="number"
              min={1}
              max={restoreDialog.group.faultyQty}
              value={restoreDialog.qty}
              onChange={(e) => setRestoreDialog({ ...restoreDialog, qty: e.target.value })}
              className="w-full h-7 border border-[hsl(var(--border))] bg-transparent px-2 text-xs focus:outline-none mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setRestoreDialog(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={Boolean(restoringId)} onClick={() => void confirmQtyRestore()}>
                Restore
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
