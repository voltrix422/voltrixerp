"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  clearPosOutboundInventoryHistory,
  deleteInventoryHistoryEntry,
  getInventoryHistory,
  type InventoryTransaction,
} from "@/lib/inventory-history"
import { downloadBranchPosStockHistoryPDF } from "@/lib/generate-branch-pos-stock-history-pdf"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useDialog } from "@/components/ui/dialog-provider"
import { FileDown, Loader2, Trash2, TrendingDown, TrendingUp } from "lucide-react"

function absQty(t: InventoryTransaction) {
  return Math.abs(Number(t.quantity) || 0)
}

function isInbound(t: InventoryTransaction) {
  const type = String(t.transaction_type || "").trim().toLowerCase()
  if (type === "in") return true
  if (type === "out") {
    // Defensive: mis-tagged restore rows still show as stock in
    return /stock restored|order deleted/i.test(t.notes || "")
  }
  return /stock restored|order deleted/i.test(t.notes || "")
}

function typeBadge(t: InventoryTransaction) {
  if (isInbound(t)) {
    if (/stock restored|order deleted/i.test(t.notes || "")) return { label: "IN · Restored", inbound: true }
    return { label: "IN", inbound: true }
  }
  if (/delivered/i.test(t.notes || "")) return { label: "OUT · Delivered", inbound: false }
  return { label: "OUT", inbound: false }
}

function refLabel(refType: string, notes?: string) {
  if (/stock restored|order deleted/i.test(notes || "")) return "Order deleted"
  if (refType === "branch_pos_order") return "POS Order"
  if (refType === "branch_pos_restore") return "Order deleted"
  if (refType === "pos_sale") return "POS Sale"
  return refType || "—"
}

/** Branch POS stock ledger: OUT on deliver / sale, IN when a delivered order is deleted. */
export function BranchPosStockHistory({
  branchId,
  branchName,
  userName,
}: {
  branchId: string
  branchName: string
  userName: string
}) {
  const { toast } = useToast()
  const { confirm } = useDialog()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<InventoryTransaction[]>([])
  const [exporting, setExporting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getInventoryHistory({
        locationLabel: branchName,
        branchId,
        posOutbound: true,
      })
      setRows(data)
    } finally {
      setLoading(false)
    }
  }, [branchId, branchName])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    const outbound = rows.filter((r) => !isInbound(r))
    const inbound = rows.filter((r) => isInbound(r))
    return {
      outCount: outbound.length,
      qtyOut: outbound.reduce((s, r) => s + absQty(r), 0),
      inCount: inbound.length,
      qtyIn: inbound.reduce((s, r) => s + absQty(r), 0),
    }
  }, [rows])

  async function handleExportPdf() {
    setExporting(true)
    try {
      downloadBranchPosStockHistoryPDF({
        branchName,
        movements: rows,
        exportedBy: userName,
        dateLabel: "POS deliver (out) & deleted-order restore (in)",
      })
      toast({ type: "success", title: "PDF downloaded" })
    } catch {
      toast({ type: "error", title: "Could not export PDF" })
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteOne(row: InventoryTransaction) {
    const ok = await confirm({
      type: "confirm",
      title: "Delete history entry?",
      message: `Remove this stock record for ${row.item_description} (${row.reference_number || "no ref"})? Stock quantities are not changed.`,
      confirmLabel: "Delete",
    })
    if (!ok) return
    setBusyId(row.id)
    try {
      await deleteInventoryHistoryEntry(row.id)
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      toast({ type: "success", title: "History entry deleted" })
    } catch (err) {
      toast({
        type: "error",
        title: "Could not delete",
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleClearAll() {
    const ok = await confirm({
      type: "confirm",
      title: "Clear stock history?",
      message: `Remove all POS stock history for ${branchName}? This cannot be undone. Stock quantities are not changed.`,
      confirmLabel: "Clear all",
    })
    if (!ok) return
    setClearing(true)
    try {
      const deleted = await clearPosOutboundInventoryHistory(branchName)
      setRows([])
      toast({
        type: "success",
        title: "History cleared",
        message: deleted > 0 ? `${deleted} entr${deleted === 1 ? "y" : "ies"} removed.` : undefined,
      })
    } catch (err) {
      toast({
        type: "error",
        title: "Could not clear history",
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setClearing(false)
    }
  }

  const actionBusy = busyId !== null || clearing

  return (
    <div className="rounded-xl border bg-[hsl(var(--card))] overflow-hidden space-y-0">
      <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Stock history</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Stock out when an order is delivered (or POS sale). Stock in when a delivered order is deleted. Warehouse transfers are not listed here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={actionBusy || rows.length === 0}
            onClick={() => void handleClearAll()}
          >
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Clear all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer"
            disabled={exporting || rows.length === 0}
            onClick={() => void handleExportPdf()}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            Export PDF
          </Button>
        </div>
      </div>

      <div className="p-3 border-b bg-[hsl(var(--muted))]/10">
        <div className="grid grid-cols-2 gap-2 max-w-md">
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-orange-600" /> Stock out
            </p>
            <p className="text-sm font-semibold tabular-nums mt-0.5">
              {summary.outCount} · {summary.qtyOut.toLocaleString()} units
            </p>
          </div>
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-600" /> Stock in
            </p>
            <p className="text-sm font-semibold tabular-nums mt-0.5">
              {summary.inCount} · {summary.qtyIn.toLocaleString()} units
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/30 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="text-left px-3 py-2.5">Date</th>
                <th className="text-left px-3 py-2.5">Type</th>
                <th className="text-left px-3 py-2.5">Item</th>
                <th className="text-right px-3 py-2.5">Qty</th>
                <th className="text-left px-3 py-2.5">Ref</th>
                <th className="text-left px-3 py-2.5">Notes</th>
                <th className="text-right px-3 py-2.5 w-14"> </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const badge = typeBadge(r)
                const inbound = badge.inbound
                return (
                  <tr key={r.id} className="hover:bg-[hsl(var(--muted))]/10">
                    <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("en-PK")}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          inbound
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                        }`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium min-w-0">
                      <p className="truncate max-w-[220px]">{r.item_description}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      {inbound ? "+" : "−"}
                      {absQty(r)} {r.unit}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <p className="font-medium">{refLabel(r.reference_type, r.notes)}</p>
                      <p className="font-mono text-[hsl(var(--muted-foreground))]">{r.reference_number}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] max-w-[200px] truncate">
                      {r.notes || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={actionBusy}
                        title="Delete this entry"
                        onClick={() => void handleDeleteOne(r)}
                      >
                        {busyId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]">
                    No stock movements yet — appear when an order is delivered or a delivered order is deleted
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
