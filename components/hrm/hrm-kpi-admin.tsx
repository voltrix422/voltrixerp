"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  deleteKpiTemplate,
  fetchKpiTemplates,
  saveKpiTemplate,
  type KpiTemplate,
  type KpiUnit,
  type KpiPeriodType,
} from "@/lib/hrm-kpis"

const UNITS: { value: KpiUnit; label: string }[] = [
  { value: "currency", label: "Currency (Rs)" },
  { value: "count", label: "Count" },
  { value: "percent", label: "Percent (%)" },
]

const emptyForm = () => ({
  name: "",
  description: "",
  unit: "count" as KpiUnit,
  defaultTarget: "",
  defaultWeight: "",
  periodType: "weekly" as KpiPeriodType,
  active: true,
  sortOrder: "0",
})

export function HrmKpiAdmin({ createdBy }: { createdBy: string }) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<KpiTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<KpiTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTemplates(await fetchKpiTemplates())
    } catch {
      toast({ title: "Error", message: "Could not load KPI templates.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEdit(t: KpiTemplate) {
    setEditing(t)
    setForm({
      name: t.name,
      description: t.description,
      unit: t.unit,
      defaultTarget: String(t.defaultTarget),
      defaultWeight: String(t.defaultWeight),
      periodType: t.periodType,
      active: t.active,
      sortOrder: String(t.sortOrder),
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await saveKpiTemplate({
        id: editing?.id,
        name: form.name.trim(),
        description: form.description.trim(),
        unit: form.unit,
        defaultTarget: Number(form.defaultTarget) || 0,
        defaultWeight: Number(form.defaultWeight) || 0,
        periodType: form.periodType,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
        createdBy: editing ? undefined : createdBy,
      })
      toast({ title: "Saved", message: "KPI template saved.", type: "success" })
      setShowForm(false)
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this KPI template? Assigned staff KPIs keep their data.")) return
    try {
      await deleteKpiTemplate(id)
      toast({ title: "Deleted", message: "Template removed.", type: "success" })
      load()
    } catch {
      toast({ title: "Error", message: "Could not delete template.", type: "error" })
    }
  }

  const totalWeight = templates.filter(t => t.active).reduce((s, t) => s + t.defaultWeight, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">KPI Templates</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Define weekly KPIs here, then assign them to employees on their staff profile.
            Active template weights: <span className="font-semibold">{totalWeight}%</span>
            {totalWeight > 0 && totalWeight !== 100 && (
              <span className="text-amber-600 ml-1">(should total 100%)</span>
            )}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 h-8" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> New KPI
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No KPI templates yet. Create templates for sales targets, visits, calls, etc.
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/30 text-xs text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="text-left px-4 py-2 font-medium">KPI</th>
                <th className="text-left px-4 py-2 font-medium">Target</th>
                <th className="text-left px-4 py-2 font-medium">Weight</th>
                <th className="text-left px-4 py-2 font-medium">Period</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className="border-t border-[hsl(var(--border))]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[hsl(var(--foreground))]">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{t.description}</p>
                    )}
                    {!t.active && (
                      <span className="text-[10px] text-amber-600 font-medium">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {t.unit === "currency"
                      ? `Rs ${t.defaultTarget.toLocaleString()}`
                      : t.defaultTarget.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{t.defaultWeight}%</td>
                  <td className="px-4 py-3 capitalize">{t.periodType}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-3"
            onClick={e => e.stopPropagation()}
            onSubmit={handleSave}
          >
            <p className="text-sm font-semibold">{editing ? "Edit KPI" : "New KPI Template"}</p>
            <input
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
              placeholder="KPI name (e.g. Weekly Sales Target)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
            <textarea
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm min-h-[60px]"
              placeholder="Description (optional)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value as KpiUnit }))}
              >
                {UNITS.map(u => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                value={form.periodType}
                onChange={e => setForm(f => ({ ...f, periodType: e.target.value as KpiPeriodType }))}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                placeholder="Default target"
                value={form.defaultTarget}
                onChange={e => setForm(f => ({ ...f, defaultTarget: e.target.value }))}
              />
              <input
                type="number"
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                placeholder="Weight %"
                value={form.defaultWeight}
                onChange={e => setForm(f => ({ ...f, defaultWeight: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
