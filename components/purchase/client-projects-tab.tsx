"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Trash2,
  Upload,
  X,
  FileText,
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  FolderKanban,
  Pencil,
  Merge,
  RefreshCw,
} from "lucide-react"
import {
  addClientProjectTransaction,
  deleteClientProject,
  deleteClientProjectTransaction,
  getClientProjects,
  mergeClientProjects,
  saveClientProject,
  syncClientProjectsFromLedger,
  type ClientProject,
} from "@/lib/client-projects"
import { uploadFile } from "@/lib/upload"

const inputCls =
  "w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"

function fmtMoney(n: number) {
  return `Rs. ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
}

const Field = ({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) => (
  <div className="space-y-1 min-w-0">
    <label className="text-[11px] font-medium text-[hsl(var(--foreground))]">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">{hint}</p>}
  </div>
)

function statusBadge(status: ClientProject["status"]) {
  if (status === "completed") return <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Completed</Badge>
  if (status === "cancelled") return <Badge variant="secondary" className="text-[10px]">Cancelled</Badge>
  return <Badge variant="default" className="text-[10px]">Open</Badge>
}

export function ClientProjectsTab({ purchaseScopeId }: { purchaseScopeId: string }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "completed" | "cancelled">("all")

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formClient, setFormClient] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formBudget, setFormBudget] = useState("")
  const [formReceived, setFormReceived] = useState("")
  const [formReceivedDate, setFormReceivedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [formReceivedReceipt, setFormReceivedReceipt] = useState<File | null>(null)
  const [formNotes, setFormNotes] = useState("")
  const [savingForm, setSavingForm] = useState(false)

  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = useMemo(() => projects.find((p) => p.id === detailId) ?? null, [projects, detailId])

  const [txnType, setTxnType] = useState<"receipt" | "expense">("expense")
  const [txnAmount, setTxnAmount] = useState("")
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [txnDescription, setTxnDescription] = useState("")
  const [txnReceipt, setTxnReceipt] = useState<File | null>(null)
  const [savingTxn, setSavingTxn] = useState(false)

  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSelected, setMergeSelected] = useState<string[]>([])
  const [mergeTargetId, setMergeTargetId] = useState("")
  const [mergeCanonicalName, setMergeCanonicalName] = useState("")
  const [merging, setMerging] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setProjects(await getClientProjects(purchaseScopeId))
      setLoading(false)
    }
    void load()
  }, [purchaseScopeId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((project) => {
      if (statusFilter !== "all" && project.status !== statusFilter) return false
      if (!q) return true
      return (
        project.projectName.toLowerCase().includes(q) ||
        project.clientName.toLowerCase().includes(q) ||
        project.clientPhone.toLowerCase().includes(q) ||
        project.notes.toLowerCase().includes(q)
      )
    })
  }, [projects, search, statusFilter])

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, p) => ({
          budget: acc.budget + p.budget,
          received: acc.received + p.totalReceived,
          expenses: acc.expenses + p.totalExpenses,
          profit: acc.profit + p.profit,
          remaining: acc.remaining + p.remainingFromClient,
        }),
        { budget: 0, received: 0, expenses: 0, profit: 0, remaining: 0 },
      ),
    [filtered],
  )

  function resetTxnForm(defaultType: "receipt" | "expense" = "expense") {
    setTxnType(defaultType)
    setTxnAmount("")
    setTxnDate(new Date().toISOString().slice(0, 10))
    setTxnDescription("")
    setTxnReceipt(null)
  }

  function openDetail(id: string) {
    setDetailId(id)
    resetTxnForm()
  }

  function openCreateForm() {
    setEditingId(null)
    setFormName("")
    setFormClient("")
    setFormPhone("")
    setFormBudget("")
    setFormReceived("")
    setFormReceivedDate(new Date().toISOString().slice(0, 10))
    setFormReceivedReceipt(null)
    setFormNotes("")
    setShowForm(true)
  }

  function openEditForm(project: ClientProject) {
    setEditingId(project.id)
    setFormName(project.projectName)
    setFormClient(project.clientName)
    setFormPhone(project.clientPhone)
    setFormBudget(project.budget ? String(project.budget) : "")
    setFormReceived("")
    setFormReceivedDate(new Date().toISOString().slice(0, 10))
    setFormReceivedReceipt(null)
    setFormNotes(project.notes)
    setShowForm(true)
  }

  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!formName.trim()) {
      alert("Enter a project name.")
      return
    }
    setSavingForm(true)
    try {
      if (editingId) {
        const saved = await saveClientProject({
          id: editingId,
          purchaseScopeId,
          projectName: formName.trim(),
          clientName: formClient.trim(),
          clientPhone: formPhone.trim(),
          budget: parseFloat(formBudget) || 0,
          notes: formNotes.trim(),
          status: projects.find((p) => p.id === editingId)?.status ?? "open",
        })
        setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)))
      } else {
        const receivedAmount = parseFloat(formReceived) || 0
        let receiptUrl = ""
        let receiptName = ""
        if (receivedAmount > 0 && formReceivedReceipt) {
          receiptUrl = await uploadFile(formReceivedReceipt, "client-project-receipts")
          receiptName = formReceivedReceipt.name
        }
        const saved = await saveClientProject({
          purchaseScopeId,
          projectName: formName.trim(),
          clientName: formClient.trim(),
          clientPhone: formPhone.trim(),
          budget: parseFloat(formBudget) || 0,
          notes: formNotes.trim(),
          initialReceived: receivedAmount,
          initialReceivedDate: formReceivedDate || new Date().toISOString().slice(0, 10),
          initialReceivedReceiptUrl: receiptUrl,
          initialReceivedReceiptName: receiptName,
          createdBy: user.name,
        })
        setProjects((prev) => [saved, ...prev])
        openDetail(saved.id)
      }
      setShowForm(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save project.")
    } finally {
      setSavingForm(false)
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !detail) return
    const amount = parseFloat(txnAmount) || 0
    if (amount <= 0) {
      alert("Enter an amount greater than zero.")
      return
    }
    setSavingTxn(true)
    try {
      let receiptUrl = ""
      let receiptName = ""
      if (txnReceipt) {
        receiptUrl = await uploadFile(txnReceipt, "client-project-receipts")
        receiptName = txnReceipt.name
      }
      const updated = await addClientProjectTransaction(detail.id, {
        type: txnType,
        amount,
        date: txnDate,
        description: txnDescription.trim(),
        receiptUrl,
        receiptName,
        createdBy: user.name,
      })
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      resetTxnForm(txnType)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to record transaction.")
    } finally {
      setSavingTxn(false)
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    if (!detail) return
    if (!confirm("Delete this entry?")) return
    try {
      const updated = await deleteClientProjectTransaction(detail.id, transactionId)
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete entry.")
    }
  }

  async function handleSetStatus(project: ClientProject, status: ClientProject["status"]) {
    try {
      const updated = await saveClientProject({
        id: project.id,
        purchaseScopeId: project.purchaseScopeId,
        projectName: project.projectName,
        clientName: project.clientName,
        clientPhone: project.clientPhone,
        budget: project.budget,
        notes: project.notes,
        status,
      })
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update status.")
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("Delete this project and all its payments / expenses?")) return
    await deleteClientProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    if (detailId === id) setDetailId(null)
  }

  function openMergeDialog() {
    setMergeSelected([])
    setMergeTargetId("")
    setMergeCanonicalName("")
    setMergeOpen(true)
  }

  function toggleMergeSelect(id: string) {
    setMergeSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      if (mergeTargetId && !next.includes(mergeTargetId)) {
        setMergeTargetId(next[0] || "")
      } else if (!mergeTargetId && next.length > 0) {
        setMergeTargetId(next[0])
      }
      const target = projects.find((p) => p.id === (mergeTargetId && next.includes(mergeTargetId) ? mergeTargetId : next[0]))
      if (target && !mergeCanonicalName.trim()) setMergeCanonicalName(target.projectName)
      return next
    })
  }

  async function handleSyncFromLedger() {
    if (!user) return
    setSyncing(true)
    try {
      const result = await syncClientProjectsFromLedger(purchaseScopeId, user.name)
      setProjects(result.projects)
      alert(
        result.createdCount > 0
          ? `Added ${result.createdCount} project(s) from purchase ledger.`
          : "All ledger project names are already in Projects.",
      )
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to sync from ledger.")
    } finally {
      setSyncing(false)
    }
  }

  async function handleMergeProjects() {
    if (mergeSelected.length < 2) {
      alert("Select at least two projects to merge.")
      return
    }
    const targetId = mergeTargetId || mergeSelected[0]
    const sourceIds = mergeSelected.filter((id) => id !== targetId)
    if (sourceIds.length === 0) {
      alert("Pick a keep / target project.")
      return
    }
    const target = projects.find((p) => p.id === targetId)
    const canonical = mergeCanonicalName.trim() || target?.projectName || ""
    if (!canonical) {
      alert("Enter the final project name.")
      return
    }
    if (
      !confirm(
        `Merge ${sourceIds.length} project(s) into “${canonical}”?\n\nAll purchase ledger rows with these names will move to the final name.`,
      )
    ) {
      return
    }
    setMerging(true)
    try {
      const result = await mergeClientProjects({
        targetId,
        sourceIds,
        canonicalName: canonical,
      })
      setProjects((prev) => {
        const withoutSources = prev.filter((p) => !sourceIds.includes(p.id))
        return withoutSources.map((p) => (p.id === result.project.id ? result.project : p))
      })
      setMergeOpen(false)
      openDetail(result.project.id)
      alert(
        `Merged ${result.mergedCount} project(s). Updated ${result.ledgerUpdated} ledger entr${result.ledgerUpdated === 1 ? "y" : "ies"}.`,
      )
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to merge projects.")
    } finally {
      setMerging(false)
    }
  }

  const sortedTxns = detail
    ? [...detail.transactions].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
    : []

  const similarNameGroups = useMemo(() => {
    const groups = new Map<string, ClientProject[]>()
    for (const p of projects) {
      const key = p.projectName.trim().toLowerCase().replace(/\s+/g, " ")
      if (!key) continue
      const list = groups.get(key) || []
      list.push(p)
      groups.set(key, list)
    }
    return Array.from(groups.values()).filter((g) => g.length > 1)
  }, [projects])

  return (
    <div className="p-4 sm:p-6 pt-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Client projects</h2>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Track whole client jobs (e.g. solar system): budget, money received, expenses, and profit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer"
            onClick={() => void handleSyncFromLedger()}
            disabled={syncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Import from ledger"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer"
            onClick={openMergeDialog}
            disabled={projects.length < 2}
          >
            <Merge className="h-3.5 w-3.5" /> Merge projects
          </Button>
          <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={openCreateForm}>
            <Plus className="h-3.5 w-3.5" /> New project
          </Button>
        </div>
      </div>

      {similarNameGroups.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-[11px]">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            {similarNameGroups.length} duplicate name group{similarNameGroups.length === 1 ? "" : "s"} found
          </p>
          <p className="text-[hsl(var(--muted-foreground))] mt-0.5">
            Use <span className="font-medium">Merge projects</span> to combine them into one (ledger entries move with them).
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Budget (agreed)</p>
          <p className="text-sm font-semibold mt-0.5">{fmtMoney(totals.budget)}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Client paid</p>
          <p className="text-sm font-semibold text-[#1faca6] mt-0.5">{fmtMoney(totals.received)}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Expenses</p>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
            {fmtMoney(totals.expenses)}
          </p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Profit</p>
          <p
            className={`text-sm font-semibold mt-0.5 ${
              totals.profit >= 0 ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {fmtMoney(totals.profit)}
          </p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Still owed by clients</p>
          <p className="text-sm font-semibold text-amber-700 mt-0.5">{fmtMoney(totals.remaining)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project, client, phone..."
            className={`${inputCls} pl-8`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs"
        >
          <option value="all">All projects</option>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-xs text-[hsl(var(--muted-foreground))]">
          Loading projects...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center">
          <FolderKanban className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium">No client projects yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-md mx-auto">
            Create a project with a client budget (e.g. Rs. 10 lac for a full solar system). Add money
            received anytime (or start with zero), log expenses, and see your profit.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/25 text-left text-[10px] text-[hsl(var(--muted-foreground))]">
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium text-right">Budget</th>
                <th className="px-3 py-2 font-medium text-right">Client paid</th>
                <th className="px-3 py-2 font-medium text-right">Expenses</th>
                <th className="px-3 py-2 font-medium text-right">Profit</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((project) => (
                <tr
                  key={project.id}
                  className="hover:bg-[hsl(var(--muted))]/15 cursor-pointer"
                  onClick={() => openDetail(project.id)}
                >
                  <td className="px-3 py-2.5 font-medium">{project.projectName}</td>
                  <td className="px-3 py-2.5 text-[hsl(var(--muted-foreground))]">
                    {project.clientName || "—"}
                    {project.clientPhone ? (
                      <span className="block text-[10px]">{project.clientPhone}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(project.budget)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1faca6]">
                    {fmtMoney(project.totalReceived)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">
                    {fmtMoney(project.totalExpenses)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right tabular-nums font-semibold ${
                      project.profit >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {fmtMoney(project.profit)}
                  </td>
                  <td className="px-3 py-2.5">{statusBadge(project.status)}</td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] cursor-pointer"
                      onClick={() => openDetail(project.id)}
                    >
                      Open
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-[hsl(var(--card))]">
              <div>
                <h3 className="text-sm font-semibold">{editingId ? "Edit project" : "New client project"}</h3>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  Set the client budget and optional first payment
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 cursor-pointer"
                onClick={() => setShowForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleSaveProject} className="px-4 py-4 space-y-3">
              <Field label="Project name">
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. 10kW solar system — Ali House"
                  className={inputCls}
                  autoFocus
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Client name">
                  <input
                    value={formClient}
                    onChange={(e) => setFormClient(e.target.value)}
                    placeholder="Client name"
                    className={inputCls}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Optional"
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Client budget" hint="Agreed amount from client for the whole project (e.g. 10 lac)">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formBudget}
                  onChange={(e) => setFormBudget(e.target.value)}
                  placeholder="e.g. 1000000"
                  className={inputCls}
                  inputMode="decimal"
                />
              </Field>
              {!editingId && (
                <>
                  <Field
                    label="Amount received now"
                    hint="Optional — leave 0 if nothing paid yet; you can add payments later"
                  >
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formReceived}
                      onChange={(e) => setFormReceived(e.target.value)}
                      placeholder="e.g. 200000"
                      className={inputCls}
                      inputMode="decimal"
                    />
                  </Field>
                  <Field label="Payment date">
                    <input
                      type="date"
                      value={formReceivedDate}
                      onChange={(e) => setFormReceivedDate(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Payment proof" hint="Optional · image or PDF">
                    <label className="flex items-center gap-2 h-9 rounded-md border border-dashed px-3 cursor-pointer hover:bg-[hsl(var(--muted))]/25 transition-colors">
                      <Upload className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                      <span className="text-[11px] truncate">
                        {formReceivedReceipt ? formReceivedReceipt.name : "Click to attach"}
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => setFormReceivedReceipt(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </Field>
                </>
              )}
              <Field label="Notes">
                <input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional"
                  className={inputCls}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs cursor-pointer"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs cursor-pointer" disabled={savingForm}>
                  {savingForm ? "Saving..." : editingId ? "Save changes" : "Create project"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailId(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border bg-[hsl(var(--card))] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold truncate">{detail.projectName}</h3>
                  {statusBadge(detail.status)}
                </div>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                  {detail.clientName || "No client name"}
                  {detail.clientPhone ? ` · ${detail.clientPhone}` : ""}
                  {detail.notes ? ` · ${detail.notes}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => openEditForm(detail)}
                  title="Edit project"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => setDetailId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-y-auto px-4 py-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="rounded-md border bg-[hsl(var(--muted))]/10 px-2.5 py-2 text-center">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Budget</p>
                  <p className="text-sm font-semibold mt-0.5">{fmtMoney(detail.budget)}</p>
                </div>
                <div className="rounded-md border bg-[hsl(var(--muted))]/10 px-2.5 py-2 text-center">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Client paid</p>
                  <p className="text-sm font-semibold mt-0.5 text-[#1faca6]">
                    {fmtMoney(detail.totalReceived)}
                  </p>
                </div>
                <div className="rounded-md border bg-[hsl(var(--muted))]/10 px-2.5 py-2 text-center">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Expenses</p>
                  <p className="text-sm font-semibold mt-0.5 text-amber-700 dark:text-amber-400">
                    {fmtMoney(detail.totalExpenses)}
                  </p>
                </div>
                <div className="rounded-md border bg-[hsl(var(--muted))]/10 px-2.5 py-2 text-center">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Profit</p>
                  <p
                    className={`text-sm font-semibold mt-0.5 ${
                      detail.profit >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {fmtMoney(detail.profit)}
                  </p>
                </div>
                <div className="rounded-md border bg-[hsl(var(--muted))]/10 px-2.5 py-2 text-center">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Still owed</p>
                  <p className="text-sm font-semibold mt-0.5 text-amber-700">
                    {fmtMoney(detail.remainingFromClient)}
                  </p>
                </div>
              </div>

              {detail.status === "open" && (
                <form
                  onSubmit={handleAddTransaction}
                  className="rounded-lg border bg-[hsl(var(--muted))]/10 p-3 space-y-3"
                >
                  <div className="flex items-center gap-1 rounded-md border bg-[hsl(var(--background))] p-1 w-fit">
                    <button
                      type="button"
                      onClick={() => setTxnType("expense")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                        txnType === "expense"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : "text-[hsl(var(--muted-foreground))]"
                      }`}
                    >
                      Add expense
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxnType("receipt")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                        txnType === "receipt"
                          ? "bg-[#1faca6]/15 text-[#1faca6]"
                          : "text-[hsl(var(--muted-foreground))]"
                      }`}
                    >
                      Client payment
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Amount">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={txnAmount}
                        onChange={(e) => setTxnAmount(e.target.value)}
                        placeholder="e.g. 50,000"
                        className={inputCls}
                        inputMode="decimal"
                      />
                    </Field>
                    <Field label="Date">
                      <input
                        type="date"
                        value={txnDate}
                        onChange={(e) => setTxnDate(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label={txnType === "expense" ? "What was spent?" : "Payment note"}>
                    <input
                      value={txnDescription}
                      onChange={(e) => setTxnDescription(e.target.value)}
                      placeholder={
                        txnType === "expense" ? "e.g. Inverter purchase" : "e.g. Second installment"
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Receipt / proof" hint="Optional · image or PDF">
                    <label className="flex items-center gap-2 h-9 rounded-md border border-dashed px-3 cursor-pointer hover:bg-[hsl(var(--muted))]/25 transition-colors">
                      <Upload className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                      <span className="text-[11px] truncate">
                        {txnReceipt ? txnReceipt.name : "Click to attach"}
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => setTxnReceipt(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </Field>
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" className="h-8 text-xs cursor-pointer" disabled={savingTxn}>
                      {savingTxn
                        ? "Saving..."
                        : txnType === "expense"
                          ? "Add expense"
                          : "Add payment"}
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  History ({detail.transactions.length})
                </p>
                {sortedTxns.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] py-3 text-center border border-dashed rounded-md">
                    No payments or expenses yet.
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {sortedTxns.map((txn) => (
                      <li key={txn.id} className="flex items-center gap-3 px-3 py-2.5">
                        {txn.type === "receipt" ? (
                          <ArrowDownCircle className="h-4 w-4 text-[#1faca6] shrink-0" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {txn.description ||
                              (txn.type === "receipt" ? "Client payment" : "Expense")}
                          </p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                            {txn.date}
                            {txn.createdBy ? ` · ${txn.createdBy}` : ""}
                          </p>
                        </div>
                        {txn.receiptUrl && (
                          <a
                            href={txn.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-[#1faca6] hover:underline shrink-0"
                          >
                            <FileText className="h-3 w-3" /> Proof
                          </a>
                        )}
                        <span
                          className={`text-xs font-semibold tabular-nums shrink-0 ${
                            txn.type === "receipt"
                              ? "text-[#1faca6]"
                              : "text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {txn.type === "receipt" ? "+" : "−"}
                          {fmtMoney(txn.amount)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 shrink-0 cursor-pointer"
                          onClick={() => handleDeleteTransaction(txn.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-red-500 cursor-pointer"
                onClick={() => handleDeleteProject(detail.id)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete project
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {detail.status === "open" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs cursor-pointer"
                      onClick={() => handleSetStatus(detail, "completed")}
                    >
                      Mark completed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs cursor-pointer"
                      onClick={() => handleSetStatus(detail, "cancelled")}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs cursor-pointer"
                    onClick={() => handleSetStatus(detail, "open")}
                  >
                    Reopen
                  </Button>
                )}
                <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setDetailId(null)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mergeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => !merging && setMergeOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <div>
                <p className="text-sm font-semibold">Merge projects</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  Combine duplicates into one name · purchase ledger rows move with them
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={merging}
                onClick={() => setMergeOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-y-auto px-4 py-3 space-y-3 flex-1 min-h-0">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Select 2 or more projects, choose which one to keep, and set the final name.
              </p>

              <ul className="space-y-1.5 max-h-56 overflow-y-auto rounded-lg border p-2">
                {projects.map((p) => {
                  const checked = mergeSelected.includes(p.id)
                  return (
                    <li key={p.id}>
                      <label className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-[hsl(var(--muted))]/40 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          onChange={() => toggleMergeSelect(p.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-xs font-medium block truncate">{p.projectName}</span>
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                            {p.clientName || "No client"} · {fmtMoney(p.totalExpenses)} expenses
                          </span>
                        </span>
                        {checked && (
                          <button
                            type="button"
                            className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 cursor-pointer ${
                              mergeTargetId === p.id
                                ? "bg-[#1faca6] text-white border-[#1faca6]"
                                : "hover:bg-[hsl(var(--muted))]/50"
                            }`}
                            onClick={(e) => {
                              e.preventDefault()
                              setMergeTargetId(p.id)
                              setMergeCanonicalName(p.projectName)
                            }}
                          >
                            {mergeTargetId === p.id ? "Keep" : "Set keep"}
                          </button>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>

              <Field label="Final project name" hint="All selected ledger entries will use this name">
                <input
                  value={mergeCanonicalName}
                  onChange={(e) => setMergeCanonicalName(e.target.value)}
                  placeholder="e.g. Business Expo 2026"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="flex gap-2 px-4 py-3 border-t shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 cursor-pointer"
                disabled={merging}
                onClick={() => setMergeOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs flex-1 cursor-pointer"
                disabled={merging || mergeSelected.length < 2}
                onClick={() => void handleMergeProjects()}
              >
                {merging ? "Merging…" : `Merge ${mergeSelected.length || ""}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
