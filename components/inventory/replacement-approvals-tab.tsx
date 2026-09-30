"use client"

import { useCallback, useEffect, useState } from "react"
import {
  getPendingReplacementApprovals,
  reviewReplacementReturn,
  type PendingReplacementApprovalRow,
} from "@/lib/order-replacement"
import { getSession } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useDialog } from "@/components/ui/dialog-provider"
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react"

function formatWhen(iso?: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ReplacementApprovalsTab() {
  const { toast } = useToast()
  const { confirm } = useDialog()
  const [rows, setRows] = useState<PendingReplacementApprovalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getPendingReplacementApprovals())
    } catch (err) {
      toast({
        type: "error",
        title: "Could not load approvals",
        message: err instanceof Error ? err.message : undefined,
      })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function handleReview(row: PendingReplacementApprovalRow, decision: "approved" | "rejected") {
    const dest = row.replacement.disposition === "faulty" ? "Faulty / damaged" : "Main inventory"
    const ok = await confirm({
      type: "confirm",
      title: decision === "approved" ? "Approve return into stock?" : "Reject this return?",
      message:
        decision === "approved"
          ? `Confirm you received the returned unit for ${row.orderNumber}. It will be added to ${dest}.`
          : `Reject return for ${row.orderNumber}? Stock will not increase.`,
      confirmLabel: decision === "approved" ? "Approve & add stock" : "Reject",
    })
    if (!ok) return

    setBusyId(row.replacement.id)
    try {
      await reviewReplacementReturn({
        orderId: row.orderId,
        replacementId: row.replacement.id,
        decision,
        reviewedBy: getSession()?.name || "Inventory",
      })
      toast({
        type: "success",
        title: decision === "approved" ? "Return approved" : "Return rejected",
        message:
          decision === "approved"
            ? `Added to ${dest} for ${row.orderNumber}.`
            : `${row.orderNumber} return was rejected.`,
      })
      await load()
    } catch (err) {
      toast({
        type: "error",
        title: "Could not review",
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading approvals…</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Replacement return approvals</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
            When a replace is submitted, the returned unit waits here. Approve after you receive it — then stock goes to Main or Faulty.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Pending <span className="tabular-nums font-medium text-[hsl(var(--foreground))]">{rows.length}</span>
          </span>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-10 text-center border rounded-lg">
          No pending replacement returns. New replaces will appear here for inventory approval.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const r = row.replacement
            const dest = r.disposition === "faulty" ? "Faulty / damaged" : "Main inventory"
            const busy = busyId === r.id
            return (
              <div key={`${row.orderId}-${r.id}`} className="rounded-lg border p-3 space-y-2 bg-[hsl(var(--card))]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {row.orderNumber}
                      <span className="font-normal text-[hsl(var(--muted-foreground))]"> · {row.clientName}</span>
                    </p>
                    <p className="text-xs mt-0.5">{r.description || r.model || "Returned item"}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                      Submitted {formatWhen(r.replacedAt)} by {r.replacedBy}
                      {r.oldSerialNumber ? ` · Old SN ${r.oldSerialNumber}` : " · Qty return (no serial)"}
                      {r.newSerialNumber ? ` · New SN ${r.newSerialNumber}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                      r.disposition === "faulty"
                        ? "border-orange-200 bg-orange-50 text-orange-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    → {dest}
                  </span>
                </div>

                {r.reason && (
                  <p className="text-xs rounded-md border bg-[hsl(var(--muted))]/20 px-2.5 py-2">
                    <span className="font-medium">Reason:</span> {r.reason}
                  </p>
                )}

                {r.photoUrls && r.photoUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.photoUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#1faca6] underline"
                      >
                        View photo
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white gap-1.5"
                    disabled={busy}
                    onClick={() => void handleReview(row, "approved")}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Approve — add to {r.disposition === "faulty" ? "Faulty" : "Main"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                    disabled={busy}
                    onClick={() => void handleReview(row, "rejected")}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
