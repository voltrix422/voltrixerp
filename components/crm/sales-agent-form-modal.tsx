"use client"

import { useEffect, useState } from "react"
import {
  createSalesAgent,
  createSalesManager,
  promoteToSalesManager,
  updateSalesAgent,
  JOB_TITLE_LABELS,
  type SalesAgentProfile,
  type SalesJobTitle,
  type SalesManagerOption,
} from "@/lib/sales-agents"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Eye, EyeOff, UserCog, UserPlus, X } from "lucide-react"

export type AgentFormState = {
  name: string
  email: string
  password: string
  managerId: string
  location: string
  jobTitle: SalesJobTitle
  baseSalary: string
  commissionPercent: string
  compensationNote: string
}

type Props = {
  open: boolean
  editing: SalesAgentProfile | null
  managers: SalesManagerOption[]
  otherAgents: SalesAgentProfile[]
  updatedBy: string
  onClose: () => void
  onSaved: () => void
  onManagersChange: () => void
}

const inputClass =
  "w-full h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"

const labelClass = "text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 block"

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

export function SalesAgentFormModal({
  open,
  editing,
  managers,
  otherAgents,
  updatedBy,
  onClose,
  onSaved,
  onManagersChange,
}: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(true)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [managerMode, setManagerMode] = useState<"existing" | "new" | "promote">("existing")
  const [newManager, setNewManager] = useState({ name: "", email: "", password: "" })
  const [promoteAgentId, setPromoteAgentId] = useState("")

  const [form, setForm] = useState<AgentFormState>({
    name: "",
    email: "",
    password: "",
    managerId: "",
    location: "",
    jobTitle: "field_sales_officer",
    baseSalary: "25000",
    commissionPercent: "0.5",
    compensationNote: "",
  })

  useEffect(() => {
    if (!open) return

    setManagerMode("existing")
    setNewManager({ name: "", email: "", password: "" })
    setPromoteAgentId("")
    setShowPassword(true)

    if (editing) {
      setLoadingPassword(true)
      setForm({
        name: editing.name,
        email: editing.email,
        password: "",
        managerId: editing.managerId || "",
        location: editing.location || "",
        jobTitle: editing.jobTitle,
        baseSalary: String(editing.baseSalary),
        commissionPercent: String(editing.commissionPercent),
        compensationNote: "",
      })
      fetch("/api/db/users")
        .then(r => r.json())
        .then((users: { id: string; password?: string }[]) => {
          const u = users.find(x => x.id === editing.id)
          setForm(f => ({ ...f, password: u?.password ?? "" }))
        })
        .catch(() => {})
        .finally(() => setLoadingPassword(false))
    } else {
      setForm({
        name: "",
        email: "",
        password: "",
        managerId: "",
        location: "",
        jobTitle: "field_sales_officer",
        baseSalary: "25000",
        commissionPercent: "0.5",
        compensationNote: "",
      })
    }
  }, [open, editing])

  if (!open) return null

  async function resolveManagerId(): Promise<string | null> {
    if (managerMode === "existing") {
      return form.managerId || null
    }
    if (managerMode === "new") {
      if (!newManager.name.trim() || !newManager.email.trim() || !newManager.password.trim()) {
        throw new Error("Enter manager name, email, and password.")
      }
      const mgr = await createSalesManager({
        name: newManager.name.trim(),
        email: newManager.email.trim(),
        password: newManager.password,
      })
      onManagersChange()
      return mgr.id
    }
    if (managerMode === "promote") {
      if (!promoteAgentId) throw new Error("Select an agent to promote to manager.")
      const mgr = await promoteToSalesManager(promoteAgentId)
      onManagersChange()
      return mgr.id
    }
    return form.managerId || null
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: "Missing details", message: "Name and email are required.", type: "error" })
      return
    }
    if (!editing && !form.password.trim()) {
      toast({ title: "Missing password", message: "Set a login password.", type: "error" })
      return
    }

    setSaving(true)
    try {
      const managerId = await resolveManagerId()

      if (editing) {
        await updateSalesAgent(editing.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          managerId,
          location: form.location.trim(),
          jobTitle: form.jobTitle,
          baseSalary: Number(form.baseSalary),
          commissionPercent: Number(form.commissionPercent),
          compensationNote: form.compensationNote || "Rate updated",
          updatedBy,
        })
        toast({ title: "Saved", message: `${form.name} updated.`, type: "success" })
      } else {
        await createSalesAgent({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          managerId: managerId || undefined,
          location: form.location.trim(),
          jobTitle: form.jobTitle,
          baseSalary: Number(form.baseSalary),
          commissionPercent: Number(form.commissionPercent),
        })
        toast({ title: "Created", message: `${form.name} can sign in now.`, type: "success" })
      }
      onSaved()
      onClose()
    } catch (e) {
      toast({
        title: "Error",
        message: e instanceof Error ? e.message : "Save failed.",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  const promotableAgents = otherAgents.filter(a => !editing || a.id !== editing.id)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b bg-[#1faca6]/5 shrink-0">
          <div>
            <p className="text-base font-bold">{editing ? "Edit agent" : "New sales agent"}</p>
            {editing && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{editing.email}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1faca6] mb-3">
              Account
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full name *">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field label="Email *">
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </Field>
              <Field label="Password *" className="sm:col-span-2">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`${inputClass} pr-10`}
                    placeholder={editing ? "Login password" : "Set password"}
                    value={form.password}
                    disabled={loadingPassword}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[hsl(var(--muted-foreground))] cursor-pointer"
                    onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {loadingPassword && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Loading password…</p>
                )}
              </Field>
            </div>
          </section>

          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1faca6] mb-3">
              Manager
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(
                [
                  ["existing", "Assign manager", UserCog],
                  ["new", "New manager", UserPlus],
                  ["promote", "Promote agent", UserPlus],
                ] as const
              ).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setManagerMode(mode)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
                    managerMode === mode
                      ? "bg-[#1faca6] text-white border-[#1faca6]"
                      : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[#1faca6]/40"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            {managerMode === "existing" && (
              <Field label="Reporting manager">
                <select
                  className={inputClass}
                  value={form.managerId}
                  onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))}
                >
                  <option value="">No manager</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.role === "superadmin" || m.role === "admin" ? " (Admin)" : " (Sales manager)"}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {managerMode === "new" && (
              <div className="rounded-lg border border-dashed border-[#1faca6]/40 bg-[#1faca6]/5 p-3 space-y-3">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Creates a new sales manager login and assigns them to this agent.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Manager name">
                    <input
                      className={inputClass}
                      value={newManager.name}
                      onChange={e => setNewManager(m => ({ ...m, name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Manager email">
                    <input
                      type="email"
                      className={inputClass}
                      value={newManager.email}
                      onChange={e => setNewManager(m => ({ ...m, email: e.target.value }))}
                    />
                  </Field>
                  <Field label="Manager password" className="sm:col-span-2">
                    <input
                      type="text"
                      className={inputClass}
                      value={newManager.password}
                      onChange={e => setNewManager(m => ({ ...m, password: e.target.value }))}
                    />
                  </Field>
                </div>
              </div>
            )}

            {managerMode === "promote" && (
              <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Changes the selected agent&apos;s role to sales manager. They will no longer appear
                  as a field agent.
                </p>
                <select
                  className={inputClass}
                  value={promoteAgentId}
                  onChange={e => setPromoteAgentId(e.target.value)}
                >
                  <option value="">Select agent to promote…</option>
                  {promotableAgents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1faca6] mb-3">
              Job & compensation
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Location / territory">
                <input
                  className={inputClass}
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                />
              </Field>
              <Field label="Job title">
                <select
                  className={inputClass}
                  value={form.jobTitle}
                  onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value as SalesJobTitle }))}
                >
                  {Object.entries(JOB_TITLE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Base salary (Rs)">
                <input
                  type="number"
                  className={inputClass}
                  value={form.baseSalary}
                  onChange={e => setForm(f => ({ ...f, baseSalary: e.target.value }))}
                />
              </Field>
              <Field label="Commission % per order">
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={form.commissionPercent}
                  onChange={e => setForm(f => ({ ...f, commissionPercent: e.target.value }))}
                />
              </Field>
              {editing && (
                <Field label="Compensation change note" className="sm:col-span-2">
                  <input
                    className={inputClass}
                    placeholder="Optional note for history"
                    value={form.compensationNote}
                    onChange={e => setForm(f => ({ ...f, compensationNote: e.target.value }))}
                  />
                </Field>
              )}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-[hsl(var(--muted))]/10 shrink-0">
          <Button variant="outline" size="sm" className="h-9 text-xs cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-9 text-xs bg-[#1faca6] hover:bg-[#1a9b96] text-white cursor-pointer"
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Create agent"}
          </Button>
        </div>
      </div>
    </div>
  )
}
