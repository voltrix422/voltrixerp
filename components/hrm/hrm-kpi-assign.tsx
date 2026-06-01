"use client"

import { useCallback, useEffect, useState } from "react"
import { Link2, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { getStaff, type Staff } from "@/lib/staff"
import {
  assignStaffKpi,
  fetchKpiTemplates,
  linkStaffToUser,
  type KpiTemplate,
} from "@/lib/hrm-kpis"
import { getUsers, type User } from "@/lib/auth"

export function HrmKpiAssign({ assignedBy }: { assignedBy: string }) {
  const { toast } = useToast()
  const [staff, setStaff] = useState<Staff[]>([])
  const [templates, setTemplates] = useState<KpiTemplate[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [staffId, setStaffId] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [linkUserId, setLinkUserId] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [staffList, tpls, userList] = await Promise.all([
        getStaff(),
        fetchKpiTemplates(),
        getUsers(),
      ])
      setStaff(staffList.filter(s => s.status === "active"))
      setTemplates(tpls.filter(t => t.active))
      setUsers(userList)
    } catch {
      toast({ title: "Error", message: "Could not load staff or KPIs.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const selectedStaff = staff.find(s => s.id === staffId)

  async function handleAssign() {
    if (!staffId || !templateId) return
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    setSaving(true)
    try {
      await assignStaffKpi({
        staffId,
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
        message: `${tpl.name} assigned to profile. Employee will see it under My KPIs.`,
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

  async function handleLinkUser() {
    if (!staffId) return
    setSaving(true)
    try {
      await linkStaffToUser(staffId, linkUserId || null)
      toast({ title: "Linked", message: "ERP login linked to staff profile.", type: "success" })
    } catch {
      toast({ title: "Error", message: "Could not link user.", type: "error" })
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
        Select a staff profile, optionally link their ERP login, then assign KPIs. They update and submit
        for your approval from <strong>My KPIs</strong> or their staff profile.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Staff profile</label>
          <select
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
            value={staffId}
            onChange={e => {
              setStaffId(e.target.value)
              setLinkUserId("")
            }}
          >
            <option value="">Select employee…</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.role} ({s.email})
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
            disabled={!staffId}
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

      <Button
        size="sm"
        className="gap-1.5"
        disabled={!staffId || !templateId || saving}
        onClick={handleAssign}
      >
        <Plus className="h-3.5 w-3.5" /> Assign KPI to profile
      </Button>

      {staffId && (
        <div className="pt-3 border-t border-[hsl(var(--border))] space-y-2">
          <label className="text-xs text-[hsl(var(--muted-foreground))] block">
            Link ERP login user {selectedStaff ? `(${selectedStaff.email})` : ""}
          </label>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
              value={linkUserId}
              onChange={e => setLinkUserId(e.target.value)}
            >
              <option value="">Match by email only</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" disabled={saving} onClick={handleLinkUser}>
              Link user
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
