"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  fetchPendingSettlements,
  formatKpiValue,
  reviewSettlement,
  type KpiSettlement,
  type KpiUnit,
} from "@/lib/hrm-kpis"

export function HrmKpiApprovals({ reviewedBy }: { reviewedBy: string }) {
  const { toast } = useToast()
  const [pending, setPending] = useState<KpiSettlement[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPending(await fetchPendingSettlements())
    } catch {
      toast({ title: "Error", message: "Could not load pending approvals.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleReview(s: KpiSettlement, status: "approved" | "rejected") {
    setActingId(s.id)
    try {
      await reviewSettlement({
        id: s.id,
        status,
        adminNotes: notes[s.id] ?? "",
        reviewedBy,
      })
      toast({
        title: status === "approved" ? "Approved" : "Rejected",
        message:
          status === "approved"
            ? `${s.staffName}'s KPIs are updated on their profile.`
            : `${s.staffName} can revise and resubmit.`,
        type: "success",
      })
      load()
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Review failed",
        type: "error",
      })
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Pending KPI approvals</h2>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Employees submit from their profile or My KPIs. Approve to update their official KPI progress.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No submissions waiting for approval.
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(s => (
            <div
              key={s.id}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">{s.staffName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {s.staffRole}
                    {s.staffDepartment ? ` · ${s.staffDepartment}` : ""} · {s.staffEmail}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    Week {s.periodStart} → {s.periodEnd}
                    {s.submittedAt && (
                      <span> · Submitted {new Date(s.submittedAt).toLocaleString()}</span>
                    )}
                  </p>
                </div>
                <p className="text-lg font-bold text-[#1faca6] tabular-nums">
                  {s.weightedScore ?? 0}%
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {s.entries.map(e => (
                  <div
                    key={e.staffKpiId}
                    className="rounded-lg border border-[hsl(var(--border))]/60 px-3 py-2 text-sm"
                  >
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Target {formatKpiValue(e.target, e.unit as KpiUnit)} → Actual{" "}
                      <span className="font-semibold text-[hsl(var(--foreground))]">
                        {formatKpiValue(e.actual, e.unit as KpiUnit)}
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              {s.employeeNotes && (
                <p className="text-sm text-[hsl(var(--foreground))] bg-[hsl(var(--muted))]/20 rounded-lg px-3 py-2">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Employee note: </span>
                  {s.employeeNotes}
                </p>
              )}

              <textarea
                className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm min-h-[48px]"
                placeholder="Admin note (optional, shown if rejected)"
                value={notes[s.id] ?? ""}
                onChange={e => setNotes(n => ({ ...n, [s.id]: e.target.value }))}
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={actingId === s.id}
                  onClick={() => handleReview(s, "approved")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve & update KPIs
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-red-600"
                  disabled={actingId === s.id}
                  onClick={() => handleReview(s, "rejected")}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
