"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getInventoryHistory,
  type InventoryTransaction,
} from "@/lib/inventory-history"
import { downloadBranchPosStockHistoryPDF } from "@/lib/generate-branch-pos-stock-history-pdf"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { FileDown, Loader2, TrendingDown } from "lucide-react"

function absQty(t: InventoryTransaction) {
  return Math.abs(Number(t.quantity) || 0)
}

function refLabel(refType: string) {
  if (refType === "branch_pos_order") return "POS Order"
  if (refType === "pos_sale") return "POS Sale"
  return refType || "—"
}

/** Outbound-only stock history: POS orders & sales leaving this branch (not warehouse transfers). */
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
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<InventoryTransaction[]>([])
  const [exporting, setExporting] = useState(false)

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
    const qtyOut = rows.reduce((s, r) => s + absQty(r), 0)
    return { outCount: rows.length, qtyOut }
  }, [rows])

  async function handleExportPdf() {
    setExporting(true)
    try {
      downloadBranchPosStockHistoryPDF({
        branchName,
        movements: rows,
        exportedBy: userName,
        dateLabel: "Stock going out (POS orders & sales)",
      })
      toast({ type: "success", title: "PDF downloaded" })
    } catch {
      toast({ type: "error", title: "Could not export PDF" })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="rounded-xl border bg-[hsl(var(--card))] overflow-hidden space-y-0">
      <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Stock history</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Stock going outside this branch (POS orders &amp; sales only). Warehouse transfers are not listed here.
          </p>
        </div>
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

      <div className="p-3 border-b bg-[hsl(var(--muted))]/10">
        <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2 max-w-xs">
          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-orange-600" /> Stock out
          </p>
          <p className="text-sm font-semibold tabular-nums mt-0.5">
            {summary.outCount} · {summary.qtyOut.toLocaleString()} units
          </p>
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
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[hsl(var(--muted))]/10">
                  <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("en-PK")}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                      OUT
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium min-w-0">
                    <p className="truncate max-w-[220px]">{r.item_description}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    −{absQty(r)} {r.unit}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <p className="font-medium">{refLabel(r.reference_type)}</p>
                    <p className="font-mono text-[hsl(var(--muted-foreground))]">{r.reference_number}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] max-w-[200px] truncate">
                    {r.notes || "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]">
                    No stock-out movements yet for this branch
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
