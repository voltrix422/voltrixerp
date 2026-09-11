"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import {
  ArrowLeft,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/components/auth-provider"
import { getUsers, roleHasAllModules, type User } from "@/lib/auth"
import { uploadFiles } from "@/lib/upload"
import {
  TODO_CADENCE_OPTIONS,
  addTodoUpdate,
  cadenceLabel,
  createTodo,
  deleteTodo,
  listTodos,
  statusLabel,
  type Todo,
  type TodoCadence,
  type TodoStatus,
} from "@/lib/todos"

function fmtWhen(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

function statusClass(status: string) {
  if (status === "done") return "bg-emerald-500/15 text-emerald-700"
  if (status === "in_progress") return "bg-sky-500/15 text-sky-800"
  return "bg-amber-500/15 text-amber-800"
}

function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Prefer due date; else assigned date — local calendar day. */
function todoDayKey(todo: Todo) {
  const raw = todo.dueAt || todo.assignedAt
  if (!raw) return ""
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ""
  return ymdLocal(d)
}

function inDateRange(todo: Todo, from: string, to: string) {
  if (!from && !to) return true
  const key = todoDayKey(todo)
  if (!key) return false
  if (from && key < from) return false
  if (to && key > to) return false
  return true
}

type PeriodTab = "today" | "all" | "done"

type LocalFile = { file: File; preview: string }

function FileUploader({
  files,
  onAdd,
  onRemove,
}: {
  files: LocalFile[]
  onAdd: (list: FileList | null) => void
  onRemove: (index: number) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
        Supporting attachments
      </p>
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <div
            key={f.preview}
            className="relative h-14 w-14 rounded-lg overflow-hidden border bg-[hsl(var(--muted))]/20 flex items-center justify-center"
          >
            {f.file.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <Paperclip className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            )}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="h-14 w-14 rounded-lg border border-dashed flex flex-col items-center justify-center gap-0.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/30"
        >
          <Upload className="h-4 w-4" />
          <span className="text-[9px]">Add</span>
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          multiple
          className="hidden"
          onChange={(e) => {
            onAdd(e.target.files)
            e.target.value = ""
          }}
        />
      </div>
    </div>
  )
}

export function TodosDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = roleHasAllModules(user?.role)

  const [view, setView] = useState<"mine" | "all">(isAdmin ? "all" : "mine")
  const [period, setPeriod] = useState<PeriodTab>("today")
  const [filterUserId, setFilterUserId] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [todos, setTodos] = useState<Todo[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const [form, setForm] = useState({
    title: "",
    description: "",
    cadence: "daily" as TodoCadence,
    dueAt: "",
    assigneeUserId: "",
  })

  const [updateForm, setUpdateForm] = useState({
    message: "",
    status: "in_progress" as TodoStatus,
  })
  const [attachFiles, setAttachFiles] = useState<LocalFile[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const mine = !isAdmin || view === "mine"
      const [rows, userRows] = await Promise.all([
        listTodos(mine ? { mineForUserId: user?.id } : undefined),
        isAdmin ? getUsers().catch(() => [] as User[]) : Promise.resolve([] as User[]),
      ])
      setTodos(rows)
      setUsers(userRows)
      setSelectedId((prev) => {
        if (prev && rows.some((t) => t.id === prev)) return prev
        return rows[0]?.id ?? null
      })
    } catch (err) {
      toast({
        title: "Could not load to-dos",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }, [toast, user?.id, view, isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  const todayKey = ymdLocal(new Date())

  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      if (filterUserId !== "all" && t.assigneeUserId !== filterUserId) return false

      if (period === "done" && t.status !== "done") return false
      if (period !== "done" && period === "today" && t.status === "done" && todoDayKey(t) !== todayKey) {
        // hide older completed from Today unless date range includes them
        if (!(dateFrom || dateTo)) return false
      }

      if (dateFrom || dateTo) {
        return inDateRange(t, dateFrom, dateTo) && (period !== "done" || t.status === "done")
      }

      if (period === "today") {
        const day = todoDayKey(t)
        if (day === todayKey) return true
        // overdue open / in-progress still on Today
        if (t.status !== "done" && t.dueAt) {
          const due = new Date(t.dueAt)
          if (!Number.isNaN(due.getTime()) && ymdLocal(due) < todayKey) return true
        }
        return false
      }

      return true
    })
  }, [todos, filterUserId, period, dateFrom, dateTo, todayKey])

  const peopleGroups = useMemo(() => {
    const map = new Map<
      string,
      { userId: string; name: string; items: Todo[]; open: number; done: number }
    >()
    for (const t of filteredTodos) {
      const key = t.assigneeUserId || t.assigneeName
      const existing = map.get(key)
      if (existing) {
        existing.items.push(t)
        if (t.status === "done") existing.done += 1
        else existing.open += 1
      } else {
        map.set(key, {
          userId: t.assigneeUserId,
          name: t.assigneeName,
          items: [t],
          open: t.status === "done" ? 0 : 1,
          done: t.status === "done" ? 1 : 0,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredTodos])

  const teamMode = Boolean(isAdmin && view === "all")

  const selectedPerson = useMemo(() => {
    if (!teamMode) return null
    if (selectedPersonId) {
      return peopleGroups.find((p) => p.userId === selectedPersonId) ?? null
    }
    return peopleGroups[0] ?? null
  }, [teamMode, selectedPersonId, peopleGroups])

  const selected = useMemo(() => {
    if (teamMode && selectedPerson) {
      return (
        selectedPerson.items.find((t) => t.id === selectedId) ??
        selectedPerson.items[0] ??
        null
      )
    }
    return (
      filteredTodos.find((t) => t.id === selectedId) ??
      todos.find((t) => t.id === selectedId) ??
      null
    )
  }, [teamMode, selectedPerson, selectedId, filteredTodos, todos])

  const stats = useMemo(() => {
    const open = filteredTodos.filter((t) => t.status === "open").length
    const progress = filteredTodos.filter((t) => t.status === "in_progress").length
    const done = filteredTodos.filter((t) => t.status === "done").length
    return { count: filteredTodos.length, open, progress, done }
  }, [filteredTodos])

  useEffect(() => {
    if (teamMode) {
      if (selectedPersonId && peopleGroups.some((p) => p.userId === selectedPersonId)) {
        const person = peopleGroups.find((p) => p.userId === selectedPersonId)
        if (person && selectedId && person.items.some((t) => t.id === selectedId)) return
        setSelectedId(person?.items[0]?.id ?? null)
        return
      }
      const first = peopleGroups[0]
      setSelectedPersonId(first?.userId ?? null)
      setSelectedId(first?.items[0]?.id ?? null)
      return
    }
    if (selectedId && filteredTodos.some((t) => t.id === selectedId)) return
    setSelectedId(filteredTodos[0]?.id ?? null)
  }, [teamMode, peopleGroups, selectedPersonId, filteredTodos, selectedId])

  function openPerson(userId: string) {
    const person = peopleGroups.find((p) => p.userId === userId)
    setSelectedPersonId(userId)
    setSelectedId(person?.items[0]?.id ?? null)
    setMobileDetail(true)
    setUpdateForm({
      message: "",
      status: person?.items[0]?.status === "done" ? "done" : "in_progress",
    })
    attachFiles.forEach((f) => {
      if (f.file.type.startsWith("image/")) URL.revokeObjectURL(f.preview)
    })
    setAttachFiles([])
  }

  function addFiles(list: FileList | null, setter: Dispatch<SetStateAction<LocalFile[]>>) {
    if (!list?.length) return
    const next = Array.from(list).map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : `${file.name}-${file.size}`,
    }))
    setter((prev) => [...prev, ...next].slice(0, 10))
  }

  function removeFile(index: number, setter: Dispatch<SetStateAction<LocalFile[]>>) {
    setter((prev) => {
      const copy = [...prev]
      const [removed] = copy.splice(index, 1)
      if (removed?.file.type.startsWith("image/")) URL.revokeObjectURL(removed.preview)
      return copy
    })
  }

  function openTodo(row: Todo) {
    setSelectedId(row.id)
    setMobileDetail(true)
    setUpdateForm({
      message: "",
      status: row.status === "done" ? "done" : "in_progress",
    })
    attachFiles.forEach((f) => {
      if (f.file.type.startsWith("image/")) URL.revokeObjectURL(f.preview)
    })
    setAttachFiles([])
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    const assignee = users.find((u) => u.id === form.assigneeUserId)
    if (!form.title.trim() || !assignee) {
      toast({ title: "Missing fields", message: "Title and assignee are required.", type: "error" })
      return
    }
    setSaving(true)
    try {
      const created = await createTodo({
        title: form.title.trim(),
        description: form.description.trim(),
        cadence: form.cadence,
        dueAt: form.dueAt || null,
        assigneeUserId: assignee.id,
        assigneeName: assignee.name,
        assignedBy: user?.name || "",
        assignedById: user?.id,
      })
      toast({ title: "To-do assigned", message: `Sent to ${assignee.name}`, type: "success" })
      setShowCreate(false)
      setForm({ title: "", description: "", cadence: "daily", dueAt: "", assigneeUserId: "" })
      await load()
      setSelectedPersonId(assignee.id)
      setSelectedId(created.id)
      setMobileDetail(true)
    } catch (err) {
      toast({
        title: "Assign failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function submitUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const attachmentUrls = attachFiles.length
        ? await uploadFiles(
            attachFiles.map((f) => f.file),
            "todo-attachments",
          )
        : []
      await addTodoUpdate({
        id: selected.id,
        message: updateForm.message.trim(),
        status: updateForm.status,
        attachmentUrls,
        createdBy: user?.name || "",
        createdByUserId: user?.id,
      })
      toast({
        title: updateForm.status === "done" ? "Marked done" : "Update saved",
        type: "success",
      })
      attachFiles.forEach((f) => {
        if (f.file.type.startsWith("image/")) URL.revokeObjectURL(f.preview)
      })
      setAttachFiles([])
      setUpdateForm({ message: "", status: updateForm.status })
      await load()
    } catch (err) {
      toast({
        title: "Update failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  const canUpdate = (row: Todo) => {
    if (isAdmin) return true
    return Boolean(user?.id && row.assigneeUserId === user.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#1faca6]">
            <ClipboardList className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-wide">To-do list</p>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">
            {isAdmin
              ? "Assign tasks to people. Open a person to see all their to-dos for the selected day/range."
              : "Your assigned tasks. Update progress and attach supporting files."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <div className="rounded-lg border px-3 py-1.5 bg-[hsl(var(--card))]">
            <span className="text-[hsl(var(--muted-foreground))]">Total </span>
            <strong>{stats.count}</strong>
          </div>
          <div className="rounded-lg border px-3 py-1.5 bg-[hsl(var(--card))]">
            <span className="text-[hsl(var(--muted-foreground))]">Open </span>
            <strong className="text-amber-700">{stats.open}</strong>
          </div>
          <div className="rounded-lg border px-3 py-1.5 bg-[hsl(var(--card))]">
            <span className="text-[hsl(var(--muted-foreground))]">In progress </span>
            <strong className="text-sky-700">{stats.progress}</strong>
          </div>
          <div className="rounded-lg border px-3 py-1.5 bg-[hsl(var(--card))]">
            <span className="text-[hsl(var(--muted-foreground))]">Done </span>
            <strong className="text-emerald-700">{stats.done}</strong>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border overflow-hidden text-xs">
          {(
            [
              { id: "today" as const, label: "Today" },
              { id: "all" as const, label: "All" },
              { id: "done" as const, label: "Done" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriod(tab.id)}
              className={`px-3 py-2 ${
                period === tab.id ? "bg-[#1faca6] text-white" : "bg-[hsl(var(--card))]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="inline-flex rounded-lg border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setView("all")}
              className={`px-3 py-2 ${view === "all" ? "bg-[hsl(var(--muted))]" : "bg-[hsl(var(--card))]"}`}
            >
              Team
            </button>
            <button
              type="button"
              onClick={() => {
                setView("mine")
                setFilterUserId("all")
              }}
              className={`px-3 py-2 ${view === "mine" ? "bg-[hsl(var(--muted))]" : "bg-[hsl(var(--card))]"}`}
            >
              Mine
            </button>
          </div>
        )}
        {isAdmin && view === "all" && (
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="h-9 rounded-lg border bg-[hsl(var(--card))] px-2 text-xs min-w-[160px]"
          >
            <option value="all">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        {isAdmin && (
          <Button
            size="sm"
            className="ml-auto h-9 text-xs gap-1 bg-[#1faca6] hover:bg-[#17857f] text-white"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Assign to-do
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-[hsl(var(--card))] px-3 py-2.5">
        <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Date range</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 rounded-md border px-2 text-xs"
        />
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 rounded-md border px-2 text-xs"
        />
        {(dateFrom || dateTo || filterUserId !== "all") && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-[10px]"
            onClick={() => {
              setDateFrom("")
              setDateTo("")
              setFilterUserId("all")
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filteredTodos.length === 0 ? (
        <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-16">
          {period === "today" ? "No to-dos for this date filter." : "No to-dos match these filters."}
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] gap-4 min-h-[60vh]">
          <div className={`space-y-2 ${mobileDetail ? "hidden lg:block" : "block"}`}>
            {teamMode ? (
              <>
                <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                  People · {period === "today" ? "today" : period}
                  {dateFrom || dateTo ? " · date filter" : ""} — tap a name · {peopleGroups.length}
                </p>
                {peopleGroups.map((person) => {
                  const active = selectedPersonId === person.userId
                  return (
                    <button
                      key={person.userId}
                      type="button"
                      onClick={() => openPerson(person.userId)}
                      className={`w-full text-left rounded-xl border px-3.5 py-3 transition-colors ${
                        active
                          ? "border-[#1faca6] bg-[#1faca6]/8 ring-1 ring-[#1faca6]/30"
                          : "hover:bg-[hsl(var(--muted))]/25"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{person.name}</p>
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                            {person.items.length} to-do{person.items.length === 1 ? "" : "s"}
                            {" · "}
                            <span className="text-amber-700">{person.open} open</span>
                            {" · "}
                            <span className="text-emerald-700">{person.done} done</span>
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] mt-1" />
                      </div>
                    </button>
                  )
                })}
              </>
            ) : (
              <>
                <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                  Your to-dos — tap to open · {filteredTodos.length}
                </p>
                {filteredTodos.map((row) => {
                  const active = selectedId === row.id
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => openTodo(row)}
                      className={`w-full text-left rounded-xl border px-3.5 py-3 transition-colors ${
                        active
                          ? "border-[#1faca6] bg-[#1faca6]/8 ring-1 ring-[#1faca6]/30"
                          : "hover:bg-[hsl(var(--muted))]/25"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold truncate">{row.title}</p>
                            <span
                              className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusClass(row.status)}`}
                            >
                              {statusLabel(row.status)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                            {cadenceLabel(row.cadence)}
                            {row.dueAt ? ` · due ${fmtWhen(row.dueAt)}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] mt-1" />
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </div>

          <div
            className={`rounded-2xl border bg-[hsl(var(--background))] p-4 sm:p-6 ${
              mobileDetail ? "block" : "hidden lg:block"
            }`}
          >
            {mobileDetail && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-3 h-8 text-xs gap-1 lg:hidden -ml-2"
                onClick={() => setMobileDetail(false)}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to list
              </Button>
            )}

            {teamMode && selectedPerson ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{selectedPerson.name}</h2>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                    {selectedPerson.items.length} to-do
                    {selectedPerson.items.length === 1 ? "" : "s"}
                    {period === "today" ? " for today" : period === "done" ? " done" : ""}
                    {dateFrom || dateTo ? " in selected date range" : ""}
                  </p>
                </div>

                <div className="space-y-3">
                  {selectedPerson.items.map((row) => {
                    const active = selected?.id === row.id
                    return (
                      <div
                        key={row.id}
                        className={`rounded-xl border overflow-hidden ${
                          active ? "border-[#1faca6] ring-1 ring-[#1faca6]/25" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(row.id)
                            setUpdateForm({
                              message: "",
                              status: row.status === "done" ? "done" : "in_progress",
                            })
                            attachFiles.forEach((f) => {
                              if (f.file.type.startsWith("image/")) URL.revokeObjectURL(f.preview)
                            })
                            setAttachFiles([])
                          }}
                          className="w-full text-left px-3.5 py-3 hover:bg-[hsl(var(--muted))]/20"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{row.title}</p>
                            <span
                              className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusClass(row.status)}`}
                            >
                              {statusLabel(row.status)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                            {cadenceLabel(row.cadence)}
                            {row.dueAt ? ` · due ${fmtWhen(row.dueAt)}` : ""}
                            {" · "}assigned {fmtWhen(row.assignedAt)}
                            {row.assignedBy ? ` · ${row.assignedBy}` : ""}
                          </p>
                          {row.description ? (
                            <p className="text-[12px] mt-1.5 text-[hsl(var(--muted-foreground))] line-clamp-2">
                              {row.description}
                            </p>
                          ) : null}
                        </button>

                        {active && selected && (
                          <div className="border-t px-3.5 py-3 space-y-3 bg-[hsl(var(--card))]">
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs text-red-600"
                                onClick={() => {
                                  if (!confirm("Delete this to-do?")) return
                                  void deleteTodo(selected.id)
                                    .then(() => load())
                                    .catch((err) =>
                                      toast({
                                        title: "Delete failed",
                                        message: err instanceof Error ? err.message : "Try again",
                                        type: "error",
                                      }),
                                    )
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            </div>

                            {canUpdate(selected) && selected.status !== "done" && (
                              <form onSubmit={submitUpdate} className="space-y-3">
                                <p className="text-sm font-semibold">Update this to-do</p>
                                <div>
                                  <label className="text-[11px] font-medium">Status</label>
                                  <select
                                    value={updateForm.status}
                                    onChange={(e) =>
                                      setUpdateForm((f) => ({
                                        ...f,
                                        status: e.target.value as TodoStatus,
                                      }))
                                    }
                                    className="mt-1 w-full h-10 rounded-md border px-3 text-sm"
                                  >
                                    <option value="open">Open</option>
                                    <option value="in_progress">In progress</option>
                                    <option value="done">Done</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[11px] font-medium">Progress note</label>
                                  <textarea
                                    value={updateForm.message}
                                    onChange={(e) =>
                                      setUpdateForm((f) => ({ ...f, message: e.target.value }))
                                    }
                                    rows={3}
                                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm resize-none"
                                    placeholder="What did you do / what’s left…"
                                  />
                                </div>
                                <FileUploader
                                  files={attachFiles}
                                  onAdd={(list) => addFiles(list, setAttachFiles)}
                                  onRemove={(i) => removeFile(i, setAttachFiles)}
                                />
                                <Button
                                  type="submit"
                                  disabled={saving}
                                  className="h-10 bg-[#1faca6] hover:bg-[#17857f] text-white gap-1.5"
                                >
                                  {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckSquare className="h-4 w-4" />
                                  )}
                                  Save update
                                </Button>
                              </form>
                            )}

                            <div className="space-y-2">
                              <p className="text-xs font-semibold">Activity & attachments</p>
                              {selected.updates.length === 0 ? (
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                  No updates yet.
                                </p>
                              ) : (
                                selected.updates.map((u) => (
                                  <div key={u.id} className="rounded-lg border px-3 py-2 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusClass(u.status)}`}
                                      >
                                        {statusLabel(u.status)}
                                      </span>
                                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                        {fmtWhen(u.createdAt)}
                                        {u.createdBy ? ` · ${u.createdBy}` : ""}
                                      </span>
                                    </div>
                                    {u.message ? (
                                      <p className="text-sm whitespace-pre-wrap">{u.message}</p>
                                    ) : null}
                                    {u.attachmentUrls.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {u.attachmentUrls.map((url) => {
                                          const isImg = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)
                                          return (
                                            <a
                                              key={url}
                                              href={url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="h-14 w-14 rounded-lg border overflow-hidden flex items-center justify-center bg-[hsl(var(--muted))]/20"
                                            >
                                              {isImg ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                  src={url}
                                                  alt=""
                                                  className="h-full w-full object-cover"
                                                />
                                              ) : (
                                                <Paperclip className="h-4 w-4" />
                                              )}
                                            </a>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : selected ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{selected.title}</h2>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${statusClass(selected.status)}`}
                      >
                        {statusLabel(selected.status)}
                      </span>
                    </div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                      For <strong>{selected.assigneeName}</strong> · {cadenceLabel(selected.cadence)}
                      {selected.dueAt ? ` · due ${fmtWhen(selected.dueAt)}` : ""}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      Assigned {fmtWhen(selected.assignedAt)}
                      {selected.assignedBy ? ` by ${selected.assignedBy}` : ""}
                    </p>
                    {selected.description ? (
                      <p className="text-sm mt-3 rounded-lg bg-[hsl(var(--muted))]/30 px-3 py-2 whitespace-pre-wrap">
                        {selected.description}
                      </p>
                    ) : null}
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-red-600"
                      onClick={() => {
                        if (!confirm("Delete this to-do?")) return
                        void deleteTodo(selected.id)
                          .then(() => {
                            setSelectedId(null)
                            setMobileDetail(false)
                            return load()
                          })
                          .catch((err) =>
                            toast({
                              title: "Delete failed",
                              message: err instanceof Error ? err.message : "Try again",
                              type: "error",
                            }),
                          )
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                </div>

                {canUpdate(selected) && selected.status !== "done" && (
                  <form
                    onSubmit={submitUpdate}
                    className="rounded-xl border bg-[hsl(var(--card))] p-4 space-y-3"
                  >
                    <p className="text-sm font-semibold">Update this to-do</p>
                    <div>
                      <label className="text-[11px] font-medium">Status</label>
                      <select
                        value={updateForm.status}
                        onChange={(e) =>
                          setUpdateForm((f) => ({
                            ...f,
                            status: e.target.value as TodoStatus,
                          }))
                        }
                        className="mt-1 w-full h-10 rounded-md border px-3 text-sm"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium">Progress note</label>
                      <textarea
                        value={updateForm.message}
                        onChange={(e) => setUpdateForm((f) => ({ ...f, message: e.target.value }))}
                        rows={3}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm resize-none"
                        placeholder="What did you do / what’s left…"
                      />
                    </div>
                    <FileUploader
                      files={attachFiles}
                      onAdd={(list) => addFiles(list, setAttachFiles)}
                      onRemove={(i) => removeFile(i, setAttachFiles)}
                    />
                    <Button
                      type="submit"
                      disabled={saving}
                      className="h-10 bg-[#1faca6] hover:bg-[#17857f] text-white gap-1.5"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckSquare className="h-4 w-4" />
                      )}
                      Save update
                    </Button>
                  </form>
                )}

                <div className="space-y-3">
                  <p className="text-xs font-semibold">Activity & attachments</p>
                  {selected.updates.length === 0 ? (
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      No updates yet.
                    </p>
                  ) : (
                    selected.updates.map((u) => (
                      <div key={u.id} className="rounded-xl border px-3 py-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusClass(u.status)}`}
                          >
                            {statusLabel(u.status)}
                          </span>
                          <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                            {fmtWhen(u.createdAt)}
                            {u.createdBy ? ` · ${u.createdBy}` : ""}
                          </span>
                        </div>
                        {u.message ? (
                          <p className="text-sm whitespace-pre-wrap">{u.message}</p>
                        ) : null}
                        {u.attachmentUrls.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {u.attachmentUrls.map((url) => {
                              const isImg = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)
                              return (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="h-16 w-16 rounded-lg border overflow-hidden flex items-center justify-center bg-[hsl(var(--muted))]/20"
                                >
                                  {isImg ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <Paperclip className="h-4 w-4" />
                                  )}
                                </a>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[40vh] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                Select a person to see their to-dos.
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={submitCreate}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] p-4 space-y-3 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Assign to-do</p>
            <div>
              <label className="text-[11px] font-medium">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                required
                placeholder="e.g. Call suppliers for weekly rates"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium">Details</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm resize-none"
                placeholder="What they should do…"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium">Cadence *</label>
                <select
                  value={form.cadence}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cadence: e.target.value as TodoCadence }))
                  }
                  className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                >
                  {TODO_CADENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium">Due (optional)</label>
                <input
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                  className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium">Assign to *</label>
              <select
                value={form.assigneeUserId}
                onChange={(e) => setForm((f) => ({ ...f, assigneeUserId: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                required
              >
                <option value="">Select user…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.email ? ` · ${u.email}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={saving}
                className="h-9 bg-[#1faca6] hover:bg-[#17857f] text-white"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
              </Button>
              <Button type="button" variant="outline" className="h-9" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
