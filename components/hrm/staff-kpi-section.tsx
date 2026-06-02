"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Loader2, CheckCircle2, Clock, AlertCircle, Send } from "lucide-react"
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
  computeWeightedScore,
  periodBounds,
  periodLabel,
  type KpiPeriodType,
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
  canSettle?: boolean
}

function statusLabel(status: string) {
  switch (status) {
    case "approved":
      return "Approved — KPIs updated"
    case "submitted":
      return "Pending admin approval"
    case "rejected":
      return "Rejected — please revise"
    default:
      return "Draft"
  }
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
  const [adminReviewNote, setAdminReviewNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assignTemplateId, setAssignTemplateId] = useState("")
  const [customName, setCustomName] = useState("")
  const [customTarget, setCustomTarget] = useState("")
  const [customWeight, setCustomWeight] = useState("")
  const [activePeriodType, setActivePeriodType] = useState<KpiPeriodType>("weekly")
  const [customRangeStart, setCustomRangeStart] = useState("")
  const [customRangeEnd, setCustomRangeEnd] = useState("")
  const autoBounds = periodBounds(activePeriodType)
  const periodStart = activePeriodType === "custom" ? customRangeStart : autoBounds.periodStart
  const periodEnd = activePeriodType === "custom" ? customRangeEnd : autoBounds.periodEnd
  const periodKey = `${periodStart}_${periodEnd}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiList, tpls, settlements] = await Promise.all([
        fetchStaffKpis(staffId),
        isAdmin ? fetchKpiTemplates() : Promise.resolve([]),
        periodStart && periodEnd
          ? fetchSettlements({ staffId, periodStart, periodEnd })
          : Promise.resolve([]),
      ])
      const activeKpis = kpiList.filter(k => k.active)
      const availableTypes = Array.from(new Set(activeKpis.map(k => (k.periodType as KpiPeriodType))))
      if (!availableTypes.includes(activePeriodType) && availableTypes.length > 0) {
        setActivePeriodType(availableTypes[0])
      }
      const filteredKpis = activeKpis.filter(k => k.periodType === activePeriodType)
      setKpis(filteredKpis)
      setTemplates(tpls.filter(t => t.active))
      const current = settlements[0] ?? null
      setSettlement(current)
      if (current) {
        setEntries(current.entries)
        setEmployeeNotes(current.employeeNotes)
        setAdminReviewNote(current.adminNotes)
      } else {
        setEntries(
          filteredKpis
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
        setAdminReviewNote("")
      }
    } catch {
      toast({ title: "Error", message: "Could not load KPIs.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [staffId, periodStart, periodEnd, isAdmin, toast, activePeriodType])

  useEffect(() => {
    load()
  }, [load])

  async function handleAssignTemplate() {
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
      toast({ title: "Assigned", message: `${tpl.name} linked to ${staffName}.`, type: "success" })
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

  async function handleAssignCustom() {
    if (!customName.trim()) return
    try {
      await assignStaffKpi({
        staffId,
        name: customName.trim(),
        targetValue: Number(customTarget) || 0,
        weight: Number(customWeight) || 0,
        assignedBy: actorName,
      })
      toast({ title: "Assigned", message: "Custom KPI added.", type: "success" })
      setCustomName("")
      setCustomTarget("")
      setCustomWeight("")
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
    if (!confirm("Remove this KPI from the profile?")) return
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
  const st = settlement?.status ?? "draft"
  const canEdit = (canSettle || isAdmin) && (st === "draft" || st === "rejected")
  const isPending = st === "submitted"
  const isApproved = st === "approved"
  const isRejected = st === "rejected"

  async function persist(opts: { status: "draft" | "submitted"; revise?: boolean }) {
    if (!periodStart || !periodEnd) {
      toast({ title: "Select period", message: "Please select start/end date.", type: "error" })
      return
    }
    setSaving(true)
    try {
      const saved = await saveSettlement({
        staffId,
        periodStart,
        periodEnd,
        periodType: activePeriodType,
        entries,
        employeeNotes,
        status: opts.status,
        revise: opts.revise,
        submittedBy: opts.status === "submitted" ? actorName : undefined,
      })
      setSettlement(saved)
      toast({
        title: opts.status === "submitted" ? "Sent for approval" : "Draft saved",
        message:
          opts.status === "submitted"
            ? "Admin will review and approve to update your KPIs."
            : "You can continue editing.",
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
        adminNotes: adminReviewNote,
        reviewedBy: actorName,
      })
      toast({
        title: next === "approved" ? "Approved" : "Rejected",
        message:
          next === "approved"
            ? "KPI progress updated on this profile."
            : "Employee can revise and resubmit.",
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
            KPIs on profile
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {periodLabel(activePeriodType)} period {periodStart || "—"} → {periodEnd || "—"}
          </p>
          {settlement && (
            <p
              className={`text-xs font-medium mt-1 flex items-center gap-1 ${
                isApproved
                  ? "text-emerald-600"
                  : isPending
                    ? "text-blue-600"
                    : isRejected
                      ? "text-red-600"
                      : "text-amber-600"
              }`}
            >
              {isApproved ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : isRejected ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {statusLabel(st)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Week score</p>
          <p className="text-xl font-bold text-[#1faca6] tabular-nums">{liveScore}%</p>
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-2 rounded-lg bg-[hsl(var(--muted))]/15 p-3">
          <p className="text-xs font-medium">Admin: link KPI to this profile</p>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm"
              value={assignTemplateId}
              onChange={e => setAssignTemplateId(e.target.value)}
            >
              <option value="">From template…</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={handleAssignTemplate}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm col-span-3 sm:col-span-1"
              placeholder="Custom KPI name"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
            />
            <input
              type="number"
              className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm"
              placeholder="Target"
              value={customTarget}
              onChange={e => setCustomTarget(e.target.value)}
            />
            <input
              type="number"
              className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm"
              placeholder="Weight %"
              value={customWeight}
              onChange={e => setCustomWeight(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-full"
            disabled={!customName.trim()}
            onClick={handleAssignCustom}
          >
            Add custom KPI
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-[hsl(var(--border))]/70 p-3 space-y-2">
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Period cycle</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm"
            value={activePeriodType}
            onChange={e => setActivePeriodType(e.target.value as KpiPeriodType)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Specific date range</option>
          </select>
          {activePeriodType === "custom" && (
            <>
              <input
                type="date"
                value={customRangeStart}
                onChange={e => setCustomRangeStart(e.target.value)}
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm"
              />
              <input
                type="date"
                value={customRangeEnd}
                onChange={e => setCustomRangeEnd(e.target.value)}
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm"
              />
            </>
          )}
        </div>
      </div>

      {kpis.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          No KPIs on this profile yet.
          {isAdmin ? " Assign templates above or from KPI Templates tab." : " Ask HR to assign KPIs."}
        </p>
      ) : (
        <div className="space-y-3">
          {kpis.map(k => {
            const entry = entries.find(e => e.staffKpiId === k.id)
            const actual = entry?.actual ?? 0
            const showApproved =
              k.lastApprovedPeriod === periodKey && isApproved
            const displayActual = showApproved ? k.approvedActual : actual
            const pct =
              k.targetValue > 0 ? Math.min(100, (displayActual / k.targetValue) * 100) : 0
            return (
              <div key={k.id} className="rounded-lg border border-[hsl(var(--border))]/60 p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Target: {formatKpiValue(k.targetValue, k.unit)} · Weight {k.weight}% · {periodLabel(k.periodType as KpiPeriodType)}
                    </p>
                    {k.approvedActual > 0 && k.lastApprovedPeriod && k.lastApprovedPeriod !== periodKey && (
                      <p className="text-[10px] text-emerald-600 mt-0.5">
                        Last approved: {formatKpiValue(k.approvedActual, k.unit)}
                      </p>
                    )}
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
                  <div className="h-full bg-[#1faca6] transition-all" style={{ width: `${pct}%` }} />
                </div>
                {canEdit ? (
                  <input
                    type="number"
                    className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm"
                    placeholder="Enter actual achieved this week"
                    value={actual || ""}
                    onChange={e => updateActual(k.id, Number(e.target.value) || 0)}
                  />
                ) : (
                  <p className="text-sm font-semibold tabular-nums">
                    {isApproved ? "Approved: " : "Submitted: "}
                    {formatKpiValue(displayActual, k.unit)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isRejected && adminReviewNote && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
          Admin: {adminReviewNote}
        </p>
      )}

      {(canSettle || isAdmin) && kpis.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[hsl(var(--border))]">
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">
            Settlement & approval
          </p>
          {canEdit && (
            <textarea
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm min-h-[56px]"
              placeholder="Notes for admin (optional)"
              value={employeeNotes}
              onChange={e => setEmployeeNotes(e.target.value)}
            />
          )}
          {!canEdit && employeeNotes && (
            <p className="text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">Note: </span>
              {employeeNotes}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => persist({ status: "draft" })}>
                  Save draft
                </Button>
                <Button
                  size="sm"
                  disabled={saving}
                  className="gap-1.5"
                  onClick={() => persist({ status: "submitted", revise: isRejected })}
                >
                  <Send className="h-3.5 w-3.5" />
                  {isRejected ? "Resubmit for approval" : "Send to admin for approval"}
                </Button>
              </>
            )}
            {isPending && canSettle && (
              <p className="text-xs text-blue-600 w-full">Waiting for admin approval. You cannot edit until reviewed.</p>
            )}
            {isAdmin && isPending && settlement && (
              <>
                <textarea
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm min-h-[40px]"
                  placeholder="Admin note (optional)"
                  value={adminReviewNote}
                  onChange={e => setAdminReviewNote(e.target.value)}
                />
                <Button size="sm" disabled={saving} onClick={() => handleReview("approved")}>
                  Approve & update KPIs
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                  disabled={saving}
                  onClick={() => handleReview("rejected")}
                >
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
