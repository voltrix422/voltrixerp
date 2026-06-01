"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Loader2, CheckCircle2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  assignStaffKpi,
  deleteStaffKpi,
  fetchKpiTemplates,
  fetchSettlements,
  fetchStaffKpis,
  formatKpiValue,
  reviewSettlement,
  saveSettlement,
  weekBounds,
  computeWeightedScore,
  type KpiTemplate,
  type StaffKpi,
  type SettlementEntry,
  type KpiSettlement,
} from "@/lib/hrm-kpis"

type Props = {
  staffId: string
  staffName: string
  isAdmin: boolean
  actorName: string
  /** Employee can edit draft settlement */
  canSettle?: boolean
}

export function StaffKpiSection({
  staffId,
  staffName,
  isAdmin,
  actorName,
  canSettle = false,
}: Props) {
  const { toast } = useToast()
  const [kpis, setKpis] = useState<StaffKpi[]>([])
  const [templates, setTemplates] = useState<KpiTemplate[]>([])
  const [settlement, setSettlement] = useState<KpiSettlement | null>(null)
  const [entries, setEntries] = useState<SettlementEntry[]>([])
  const [employeeNotes, setEmployeeNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assignTemplateId, setAssignTemplateId] = useState("")
  const { periodStart, periodEnd } = weekBounds()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiList, tpls, settlements] = await Promise.all([
        fetchStaffKpis(staffId),
        isAdmin ? fetchKpiTemplates() : Promise.resolve([]),
        fetchSettlements({ staffId, periodStart, periodEnd }),
      ])
      setKpis(kpiList.filter(k => k.active))
      setTemplates(tpls.filter(t => t.active))
      const current = settlements[0] ?? null
      setSettlement(current)
      if (current) {
        setEntries(current.entries)
        setEmployeeNotes(current.employeeNotes)
      } else {
        setEntries(
          kpiList
            .filter(k => k.active)
            .map(k => ({
              staffKpiId: k.id,
              name: k.name,
              target: k.targetValue,
              actual: 0,
              weight: k.weight,
              unit: k.unit,
            }))
        )
        setEmployeeNotes("")
      }
    } catch {
      toast({ title: "Error", message: "Could not load KPIs.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [staffId, periodStart, periodEnd, isAdmin, toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleAssign() {
    if (!assignTemplateId) return
    const tpl = templates.find(t => t.id === assignTemplateId)
    if (!tpl) return
    try {
      await assignStaffKpi({
        staffId,
        templateId: tpl.id,
        name: tpl.name,
        unit: tpl.unit,
        targetValue: tpl.defaultTarget,
        weight: tpl.defaultWeight,
        periodType: tpl.periodType,
        assignedBy: actorName,
      })
      toast({ title: "Assigned", message: `${tpl.name} added to ${staffName}.`, type: "success" })
      setAssignTemplateId("")
      load()
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Assign failed",
        type: "error",
      })
    }
  }

  async function handleRemove(kpiId: string) {
    if (!confirm("Remove this KPI from the employee?")) return
    try {
      await deleteStaffKpi(kpiId)
      load()
    } catch {
      toast({ title: "Error", message: "Could not remove KPI.", type: "error" })
    }
  }

  function updateActual(staffKpiId: string, actual: number) {
    setEntries(prev =>
      prev.map(e => (e.staffKpiId === staffKpiId ? { ...e, actual } : e))
    )
  }

  const liveScore = computeWeightedScore(entries)
  const isDraft = !settlement || settlement.status === "draft"
  const canEdit = (canSettle || isAdmin) && isDraft

  async function persist(status: "draft" | "submitted") {
    setSaving(true)
    try {
      const saved = await saveSettlement({
        staffId,
        periodStart,
        periodEnd,
        entries,
        employeeNotes,
        status,
        submittedBy: status === "submitted" ? actorName : undefined,
      })
      setSettlement(saved)
      toast({
        title: status === "submitted" ? "Submitted" : "Saved",
        message:
          status === "submitted"
            ? "Weekly KPI settlement submitted."
            : "Draft saved.",
        type: "success",
      })
      load()
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Save failed",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleReview(next: "approved" | "rejected") {
    if (!settlement) return
    setSaving(true)
    try {
      await reviewSettlement({
        id: settlement.id,
        status: next,
        reviewedBy: actorName,
      })
      toast({ title: "Reviewed", message: `Settlement ${next}.`, type: "success" })
      load()
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Review failed",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Assigned KPIs
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Week {periodStart} → {periodEnd}
            {settlement && (
              <span
                className={`ml-2 inline-flex items-center gap-1 font-medium ${
                  settlement.status === "approved"
                    ? "text-emerald-600"
                    : settlement.status === "submitted"
                      ? "text-blue-600"
                      : "text-amber-600"
                }`}
              >
                {settlement.status === "approved" ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {settlement.status}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Score</p>
          <p className="text-xl font-bold text-[#1faca6] tabular-nums">{liveScore}%</p>
        </div>
      </div>

      {isAdmin && templates.length > 0 && (
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm"
            value={assignTemplateId}
            onChange={e => setAssignTemplateId(e.target.value)}
          >
            <option value="">Assign KPI from template…</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} (target: {t.defaultTarget}, {t.defaultWeight}%)
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={handleAssign}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      )}

      {kpis.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          No KPIs assigned yet.
          {isAdmin ? " Use the dropdown above to assign templates from Performance tab." : ""}
        </p>
      ) : (
        <div className="space-y-3">
          {kpis.map(k => {
            const entry = entries.find(e => e.staffKpiId === k.id)
            const actual = entry?.actual ?? 0
            const pct = k.targetValue > 0 ? Math.min(100, (actual / k.targetValue) * 100) : 0
            return (
              <div key={k.id} className="rounded-lg border border-[hsl(var(--border))]/60 p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Target: {formatKpiValue(k.targetValue, k.unit)} · Weight {k.weight}%
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:underline"
                      onClick={() => handleRemove(k.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-[hsl(var(--muted))]/40 overflow-hidden mb-2">
                  <div
                    className="h-full bg-[#1faca6] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {canEdit ? (
                  <input
                    type="number"
                    className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm"
                    placeholder="Actual achieved"
                    value={actual || ""}
                    onChange={e => updateActual(k.id, Number(e.target.value) || 0)}
                  />
                ) : (
                  <p className="text-sm font-semibold tabular-nums">
                    Achieved: {formatKpiValue(actual, k.unit)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(canSettle || isAdmin) && kpis.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[hsl(var(--border))]">
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">
            Weekly settlement
          </p>
          {canEdit && (
            <textarea
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm min-h-[56px]"
              placeholder="Notes for this week (optional)"
              value={employeeNotes}
              onChange={e => setEmployeeNotes(e.target.value)}
            />
          )}
          {!canEdit && employeeNotes && (
            <p className="text-sm text-[hsl(var(--foreground))]">{employeeNotes}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => persist("draft")}>
                  Save draft
                </Button>
                <Button size="sm" disabled={saving} onClick={() => persist("submitted")}>
                  Submit settlement
                </Button>
              </>
            )}
            {isAdmin && settlement?.status === "submitted" && (
              <>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => handleReview("approved")}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="text-red-600" disabled={saving} onClick={() => handleReview("rejected")}>
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
