"use client"

import { useCallback, useEffect, useState } from "react"
import { Link2, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  assignStaffKpi,
  fetchKpiTemplates,
  type KpiPeriodType,
  type KpiTemplate,
} from "@/lib/hrm-kpis"

type StaffOption = {
  id: string
  name: string
  email: string
  role?: string
  department?: string
}

export function HrmKpiAssign({ assignedBy }: { assignedBy: string }) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<KpiTemplate[]>([])
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStaffId, setSelectedStaffId] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [customPeriodType, setCustomPeriodType] = useState<KpiPeriodType>("weekly")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tpls, staffRes] = await Promise.all([
        fetchKpiTemplates(),
        fetch("/api/hrm/staff"),
      ])
      const staff = staffRes.ok ? await staffRes.json() : []
      setTemplates(tpls.filter(t => t.active))
      setStaffList(
        (Array.isArray(staff) ? staff : []).map((s: StaffOption) => ({
          id: s.id,
          name: s.name,
          email: s.email || "",
          role: s.role,
          department: s.department,
        }))
      )
    } catch {
      toast({ title: "Error", message: "Could not load staff or KPIs.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  function selectStaff(staffId: string) {
    setSelectedStaffId(staffId)
    if (!staffId) setTemplateId("")
  }

  async function handleAssign() {
    if (!selectedStaffId || !templateId) return
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    setSaving(true)
    try {
      await assignStaffKpi({
        staffId: selectedStaffId,
        templateId: tpl.id,
        name: tpl.name,
        unit: tpl.unit,
        targetValue: tpl.defaultTarget,
        weight: tpl.defaultWeight,
        periodType: tpl.periodType,
        assignedBy,
      })
      const person = staffList.find(s => s.id === selectedStaffId)
      toast({
        title: "Assigned",
        message: `${tpl.name} assigned to ${person?.name || "staff"}.`,
        type: "success",
      })
      setTemplateId("")
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Assign failed",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignCustomRangeKpi() {
    if (!selectedStaffId || !templateId || !customStartDate || !customEndDate) return
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    if (customEndDate < customStartDate) {
      toast({ title: "Invalid date range", message: "End date must be after start date.", type: "error" })
      return
    }
    setSaving(true)
    try {
      await assignStaffKpi({
        staffId: selectedStaffId,
        templateId: tpl.id,
        name: tpl.name,
        unit: tpl.unit,
        targetValue: tpl.defaultTarget,
        weight: tpl.defaultWeight,
        periodType: customPeriodType === "custom" ? "custom" : tpl.periodType,
        notes: `Range: ${customStartDate} to ${customEndDate}`,
        assignedBy,
      })
      toast({
        title: "Assigned",
        message: `${tpl.name} assigned with date range ${customStartDate} to ${customEndDate}.`,
        type: "success",
      })
      setTemplateId("")
      setCustomStartDate("")
      setCustomEndDate("")
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Assign failed",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-4 mt-6">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-[#1faca6]" />
        <h3 className="text-sm font-semibold">Assign KPI</h3>
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Assign templates to people from <span className="font-medium">HRM → Staff</span> only — not Manage Users.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Staff member</label>
          <select
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
            value={selectedStaffId}
            onChange={e => selectStaff(e.target.value)}
          >
            <option value="">Select staff…</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.department ? ` · ${s.department}` : ""}
                {s.email ? ` (${s.email})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">KPI template</label>
          <select
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
            value={templateId}
            onChange={e => setTemplateId(e.target.value)}
            disabled={!selectedStaffId}
          >
            <option value="">Select KPI…</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} (target {t.defaultTarget}, {t.defaultWeight}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Cycle</label>
          <select
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
            value={customPeriodType}
            onChange={e => setCustomPeriodType(e.target.value as KpiPeriodType)}
            disabled={!selectedStaffId}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Specific date range</option>
          </select>
        </div>
      </div>

      <Button
        size="sm"
        className="gap-1.5"
        disabled={!selectedStaffId || !templateId || saving}
        onClick={handleAssign}
      >
        <Plus className="h-3.5 w-3.5" /> Assign
      </Button>

      {customPeriodType === "custom" && (
        <div className="rounded-md border border-[hsl(var(--border))] p-3 space-y-2">
          <p className="text-xs font-medium">Date range</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
            />
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedStaffId || !templateId || !customStartDate || !customEndDate || saving}
            onClick={handleAssignCustomRangeKpi}
          >
            Assign range KPI
          </Button>
        </div>
      )}
    </div>
  )
}
