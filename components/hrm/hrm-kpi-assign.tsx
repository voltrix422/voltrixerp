"use client"

import { useCallback, useEffect, useState } from "react"
import { Link2, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  assignStaffKpi,
  createStaffProfileFromUser,
  fetchKpiTemplates,
  type KpiPeriodType,
  type KpiTemplate,
} from "@/lib/hrm-kpis"
import { getUsers, type User } from "@/lib/auth"

export function HrmKpiAssign({ assignedBy }: { assignedBy: string }) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<KpiTemplate[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [customPeriodType, setCustomPeriodType] = useState<KpiPeriodType>("weekly")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tpls, userList] = await Promise.all([
        fetchKpiTemplates(),
        getUsers(),
      ])
      setTemplates(tpls.filter(t => t.active))
      setUsers(userList)
    } catch {
      toast({ title: "Error", message: "Could not load users or KPIs.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  function selectUser(userId: string) {
    setSelectedUserId(userId)
    if (!userId) setTemplateId("")
  }

  async function handleAssign() {
    if (!selectedUserId || !templateId) return
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    setSaving(true)
    try {
      const created = await createStaffProfileFromUser(selectedUserId)
      await assignStaffKpi({
        staffId: created.id,
        templateId: tpl.id,
        name: tpl.name,
        unit: tpl.unit,
        targetValue: tpl.defaultTarget,
        weight: tpl.defaultWeight,
        periodType: tpl.periodType,
        assignedBy,
      })
      toast({
        title: "Linked",
        message: `${tpl.name} assigned to this user. They will see it in KPI Dashboard.`,
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
    if (!selectedUserId || !templateId || !customStartDate || !customEndDate) return
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    if (customEndDate < customStartDate) {
      toast({ title: "Invalid date range", message: "End date must be after start date.", type: "error" })
      return
    }
    setSaving(true)
    try {
      const created = await createStaffProfileFromUser(selectedUserId)
      await assignStaffKpi({
        staffId: created.id,
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
        <h3 className="text-sm font-semibold">Link KPI to employee profile</h3>
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Select from <strong>User Accounts</strong> and assign KPI templates directly. Profile linking is automatic in
        backend, so no separate profile step is needed.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">User account</label>
          <select
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
            value={selectedUserId}
            onChange={e => selectUser(e.target.value)}
          >
            <option value="">Select user ID/email…</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.id.slice(0, 8)} — {u.name} ({u.email}) [{u.role}]
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Staff profile (linked)</label>
          <div className="h-[42px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 px-3 text-sm flex items-center text-[hsl(var(--muted-foreground))]">
            Auto-linked from selected User Account
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">KPI template</label>
          <select
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
            value={templateId}
            onChange={e => setTemplateId(e.target.value)}
            disabled={!selectedUserId}
          >
            <option value="">Select KPI…</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} (target {t.defaultTarget}, {t.defaultWeight}%)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Period type override</label>
          <select
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
            value={customPeriodType}
            onChange={e => setCustomPeriodType(e.target.value as KpiPeriodType)}
            disabled={!selectedUserId}
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
        disabled={!selectedUserId || !templateId || saving}
        onClick={handleAssign}
      >
        <Plus className="h-3.5 w-3.5" /> Assign KPI to selected user
      </Button>

      {customPeriodType === "custom" && (
        <div className="rounded-md border border-[hsl(var(--border))] p-3 space-y-2">
          <p className="text-xs font-medium">Specific date range KPI</p>
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
            disabled={!selectedUserId || !templateId || !customStartDate || !customEndDate || saving}
            onClick={handleAssignCustomRangeKpi}
          >
            Assign with date range
          </Button>
        </div>
      )}
    </div>
  )
}
