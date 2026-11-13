"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft,
  CalendarClock,
  CheckSquare,
  ChevronRight,
  Download,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/components/auth-provider"
import { getUsers, roleHasAllModules, type User } from "@/lib/auth"
import { uploadFiles } from "@/lib/upload"
import {
  TODO_CADENCE_OPTIONS,
  addTodoUpdate,
  approveTodo,
  cadenceLabel,
  createTodo,
  deleteTodo,
  extendTodoDue,
  formatReminderTime,
  isRecurringCadence,
  listTodos,
  rejectTodo,
  setTodoReminder,
  statusLabel,
  type Todo,
  type TodoCadence,
  type TodoStatus,
} from "@/lib/todos"
import { isoToDatetimeLocal } from "@/lib/todo-due"
import { downloadTodosOverviewPdf } from "@/lib/generate-todos-overview-pdf"

function fmtWhen(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

function statusClass(status: string) {
  if (status === "done") return "bg-emerald-500/12 text-emerald-700"
  if (status === "pending_approval") return "bg-violet-500/12 text-violet-800"
  if (status === "in_progress") return "bg-sky-500/12 text-sky-800"
  return "bg-amber-500/12 text-amber-800"
}

const appleField =
  "w-full h-8 rounded-[9px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[12px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
const appleTextarea =
  "w-full rounded-[9px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 py-2 text-[12px] tracking-tight resize-none focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
const appleSelect =
  "w-full h-8 appearance-none rounded-[9px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] pl-2.5 pr-7 text-[12px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 cursor-pointer"

function draftStatus(row: Todo): TodoStatus {
  if (row.status === "done" || row.status === "pending_approval" || row.status === "open" || row.status === "in_progress") {
    return row.status
  }
  return "in_progress"
}

function isOverdue(todo: Todo) {
  if (todo.status === "done" || !todo.dueAt) return false
  const due = new Date(todo.dueAt)
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now()
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

function assignedDayKey(todo: Todo) {
  if (!todo.assignedAt) return ""
  const d = new Date(todo.assignedAt)
  if (Number.isNaN(d.getTime())) return ""
  return ymdLocal(d)
}

function readTodoQueryId() {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get("todo")?.trim() || ""
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
    <div className="flex flex-wrap gap-1.5">
      {files.map((f, i) => (
        <div
          key={f.preview}
          className="relative h-11 w-11 rounded-[8px] overflow-hidden border border-black/[0.06] bg-[#f2f2f7] flex items-center justify-center"
        >
          {f.file.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <Paperclip className="h-3.5 w-3.5 text-[#86868b]" />
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/55 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="h-2.5 w-2.5" strokeWidth={2.5} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="h-11 w-11 rounded-[8px] border border-dashed border-black/[0.12] flex items-center justify-center text-[#86868b] hover:bg-black/[0.03] cursor-pointer"
        aria-label="Add attachment"
      >
        <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
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
  const [exportingPdf, setExportingPdf] = useState(false)
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
    reminderTime: "09:00",
    assigneeUserId: "",
  })
  const [reminderDraft, setReminderDraft] = useState("")
  const [extendDraft, setExtendDraft] = useState("")
  const [reviewNote, setReviewNote] = useState("")

  const [updateForm, setUpdateForm] = useState({
    message: "",
    status: "in_progress" as TodoStatus,
  })
  const [attachFiles, setAttachFiles] = useState<LocalFile[]>([])

  const load = useCallback(async (opts?: { silent?: boolean; selectId?: string }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const mine = !isAdmin || view === "mine"
      const [rows, userRows] = await Promise.all([
        listTodos(mine ? { mineForUserId: user?.id } : undefined),
        isAdmin ? getUsers().catch(() => [] as User[]) : Promise.resolve([] as User[]),
      ])
      setTodos(rows)
      setUsers(userRows)
      const wantId = opts?.selectId || readTodoQueryId()
      setSelectedId((prev) => {
        if (wantId && rows.some((t) => t.id === wantId)) return wantId
        if (prev && rows.some((t) => t.id === prev)) return prev
        return rows[0]?.id ?? null
      })
      if (wantId) {
        const hit = rows.find((t) => t.id === wantId)
        if (hit) {
          setSelectedPersonId(hit.assigneeUserId)
          setMobileDetail(true)
        }
      }
    } catch (err) {
      if (!opts?.silent) {
        toast({
          title: "Could not load to-dos",
          message: err instanceof Error ? err.message : "Try again",
          type: "error",
        })
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [toast, user?.id, view, isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onRefresh = () => {
      void load({ silent: true, selectId: readTodoQueryId() })
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") onRefresh()
    }
    window.addEventListener("focus", onRefresh)
    window.addEventListener("voltrix-todos-refresh", onRefresh)
    document.addEventListener("visibilitychange", onVisible)
    const interval = window.setInterval(onRefresh, 45000)
    return () => {
      window.removeEventListener("focus", onRefresh)
      window.removeEventListener("voltrix-todos-refresh", onRefresh)
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(interval)
    }
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
        if (isRecurringCadence(t.cadence)) {
          if (t.status === "done") {
            const doneKey = t.completedAt ? ymdLocal(new Date(t.completedAt)) : todoDayKey(t)
            return doneKey === todayKey
          }
          return true
        }
        if (t.status === "done") {
          return todoDayKey(t) === todayKey
        }
        // Assigned today, due today, overdue, or no due date — all stay on Today
        if (assignedDayKey(t) === todayKey) return true
        const day = todoDayKey(t)
        if (day === todayKey) return true
        if (!t.dueAt) return true
        if (t.dueAt) {
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
      { userId: string; name: string; items: Todo[]; open: number; pending: number; done: number }
    >()
    for (const t of filteredTodos) {
      const key = t.assigneeUserId || t.assigneeName
      const existing = map.get(key)
      const pending = t.status === "pending_approval" ? 1 : 0
      const done = t.status === "done" ? 1 : 0
      const open = done || pending ? 0 : 1
      if (existing) {
        existing.items.push(t)
        existing.open += open
        existing.pending += pending
        existing.done += done
      } else {
        map.set(key, {
          userId: t.assigneeUserId,
          name: t.assigneeName,
          items: [t],
          open,
          pending,
          done,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredTodos])

  const teamMode = Boolean(isAdmin && view === "all")

  const selected = useMemo(() => {
    // Always prefer the explicitly opened task from the full list so silent
    // refresh / Today filters cannot yank the open detail closed.
    if (selectedId) {
      return todos.find((t) => t.id === selectedId) ?? null
    }
    if (teamMode && selectedPersonId) {
      const person = peopleGroups.find((p) => p.userId === selectedPersonId)
      return person?.items[0] ?? null
    }
    if (teamMode) return peopleGroups[0]?.items[0] ?? null
    return filteredTodos[0] ?? null
  }, [teamMode, selectedPersonId, peopleGroups, selectedId, filteredTodos, todos])

  const selectedPerson = useMemo(() => {
    if (!teamMode) return null
    const fromGroups =
      (selectedPersonId && peopleGroups.find((p) => p.userId === selectedPersonId)) ||
      (!selectedPersonId ? peopleGroups[0] : null) ||
      null
    if (fromGroups) {
      // Keep a pinned open task visible even if the active tab filters it out.
      if (selected && selected.assigneeUserId === fromGroups.userId) {
        if (!fromGroups.items.some((t) => t.id === selected.id)) {
          return { ...fromGroups, items: [selected, ...fromGroups.items] }
        }
      }
      return fromGroups
    }
    if (selected && selected.assigneeUserId) {
      return {
        userId: selected.assigneeUserId,
        name: selected.assigneeName,
        items: [selected],
        open: selected.status === "done" || selected.status === "pending_approval" ? 0 : 1,
        pending: selected.status === "pending_approval" ? 1 : 0,
        done: selected.status === "done" ? 1 : 0,
      }
    }
    return null
  }, [teamMode, selectedPersonId, peopleGroups, selected])

  const stats = useMemo(() => {
    const open = filteredTodos.filter((t) => t.status === "open").length
    const progress = filteredTodos.filter((t) => t.status === "in_progress").length
    const pending = filteredTodos.filter((t) => t.status === "pending_approval").length
    const done = filteredTodos.filter((t) => t.status === "done").length
    return { count: filteredTodos.length, open, progress, pending, done }
  }, [filteredTodos])

  /** Full bird's-eye set: respects person + date filters, includes every status (not Today/Done tabs). */
  const exportTodos = useMemo(() => {
    return todos.filter((t) => {
      if (filterUserId !== "all" && t.assigneeUserId !== filterUserId) return false
      if (dateFrom || dateTo) return inDateRange(t, dateFrom, dateTo)
      return true
    })
  }, [todos, filterUserId, dateFrom, dateTo])

  async function handleExportPdf() {
    if (!isAdmin) return
    if (exportTodos.length === 0) {
      toast({ title: "Nothing to export", message: "No to-dos match the current filters.", type: "error" })
      return
    }
    setExportingPdf(true)
    try {
      const person =
        filterUserId !== "all"
          ? users.find((u) => u.id === filterUserId)?.name || "Selected user"
          : "All people"
      const range =
        dateFrom || dateTo
          ? `Date ${dateFrom || "…"} → ${dateTo || "…"}`
          : "All dates"
      await downloadTodosOverviewPdf(exportTodos, {
        exportedBy: user?.name || "Admin",
        filterLabel: `${person} · ${range} · ${exportTodos.length} to-do${exportTodos.length === 1 ? "" : "s"}`,
      })
      toast({ title: "PDF downloaded", message: "Bird's-eye to-do overview ready.", type: "success" })
    } catch (err) {
      toast({
        title: "Export failed",
        message: err instanceof Error ? err.message : "Could not create PDF",
        type: "error",
      })
    } finally {
      setExportingPdf(false)
    }
  }

  useEffect(() => {
    // Keep a user-opened task pinned even if the active filter hides it.
    if (selectedId && todos.some((t) => t.id === selectedId)) {
      if (teamMode) {
        const row = todos.find((t) => t.id === selectedId)
        if (row?.assigneeUserId && row.assigneeUserId !== selectedPersonId) {
          setSelectedPersonId(row.assigneeUserId)
        }
      }
      return
    }
    if (teamMode) {
      const person =
        (selectedPersonId && peopleGroups.find((p) => p.userId === selectedPersonId)) ||
        peopleGroups[0] ||
        null
      setSelectedPersonId(person?.userId ?? null)
      setSelectedId(person?.items[0]?.id ?? null)
      return
    }
    setSelectedId(filteredTodos[0]?.id ?? null)
  }, [teamMode, peopleGroups, selectedPersonId, filteredTodos, selectedId, todos])

  useEffect(() => {
    setReminderDraft(selected?.reminderTime || "")
    setExtendDraft(isoToDatetimeLocal(selected?.dueAt))
    setReviewNote("")
  }, [selected?.id, selected?.reminderTime, selected?.dueAt])

  function openPerson(userId: string) {
    const person = peopleGroups.find((p) => p.userId === userId)
    setSelectedPersonId(userId)
    setSelectedId(person?.items[0]?.id ?? null)
    setMobileDetail(true)
    setUpdateForm({
      message: "",
      status: person?.items[0] ? draftStatus(person.items[0]) : "in_progress",
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
      status: draftStatus(row),
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
        reminderTime: form.cadence === "once" ? "" : form.reminderTime,
        assigneeUserId: assignee.id,
        assigneeName: assignee.name,
        assignedBy: user?.name || "",
        assignedById: user?.id,
      })
      toast({ title: "To-do assigned", message: `Sent to ${assignee.name}`, type: "success" })
      setShowCreate(false)
      setForm({ title: "", description: "", cadence: "daily", dueAt: "", reminderTime: "09:00", assigneeUserId: "" })
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
      const updated = await addTodoUpdate({
        id: selected.id,
        message: updateForm.message.trim(),
        status: updateForm.status,
        attachmentUrls,
        createdBy: user?.name || "",
        createdByUserId: user?.id,
      })
      const submitted =
        updateForm.status === "done" || updateForm.status === "pending_approval"
      toast({
        title: submitted
          ? updated.status === "pending_approval"
            ? "Submitted for approval"
            : "Marked done"
          : "Update saved",
        message: updated.latePenalty?.applied
          ? `Late submission · −${updated.latePenalty.points} HRM point${updated.latePenalty.points === 1 ? "" : "s"}`
          : submitted && updated.status === "pending_approval"
            ? "An admin will review this before it is marked done."
            : undefined,
        type: updated.latePenalty?.applied ? "warning" : "success",
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

  async function saveReminder(todo: Todo) {
    if (!isRecurringCadence(todo.cadence)) return
    setSaving(true)
    try {
      await setTodoReminder(todo.id, reminderDraft)
      toast({ title: "Reminder saved", message: formatReminderTime(reminderDraft) || "Reminder cleared", type: "success" })
      await load()
    } catch (err) {
      toast({
        title: "Could not save reminder",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function submitApprove(todo: Todo) {
    setSaving(true)
    try {
      const updated = await approveTodo({
        id: todo.id,
        message: reviewNote.trim(),
        createdBy: user?.name || "",
        createdByUserId: user?.id,
      })
      toast({
        title: "To-do approved",
        message: updated.latePenalty?.applied
          ? `Late · −${updated.latePenalty.points} HRM points`
          : undefined,
        type: updated.latePenalty?.applied ? "warning" : "success",
      })
      setReviewNote("")
      await load()
    } catch (err) {
      toast({
        title: "Approve failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function submitReject(todo: Todo) {
    setSaving(true)
    try {
      const updated = await rejectTodo({
        id: todo.id,
        message: reviewNote.trim(),
        createdBy: user?.name || "",
        createdByUserId: user?.id,
      })
      toast({
        title: "Sent back",
        message: updated.latePenalty?.waived
          ? `Late penalty waived (+${updated.latePenalty.points} pts)`
          : "Assignee can update and resubmit.",
        type: "success",
      })
      setReviewNote("")
      await load()
    } catch (err) {
      toast({
        title: "Could not send back",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function submitExtend(todo: Todo) {
    if (!extendDraft) {
      toast({ title: "Pick a new due date", type: "error" })
      return
    }
    setSaving(true)
    try {
      const updated = await extendTodoDue({
        id: todo.id,
        dueAt: extendDraft,
        createdBy: user?.name || "",
        createdByUserId: user?.id,
      })
      toast({
        title: "Due date extended",
        message: updated.latePenalty?.waived
          ? `Late penalty waived (+${updated.latePenalty.points} pts)`
          : `New due ${fmtWhen(updated.dueAt)}`,
        type: "success",
      })
      await load()
    } catch (err) {
      toast({
        title: "Could not extend",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  function cadenceLine(row: Todo) {
    const reminder = formatReminderTime(row.reminderTime)
    return `${cadenceLabel(row.cadence)}${reminder ? ` · ${reminder}` : ""}${row.dueAt ? ` · ${fmtWhen(row.dueAt)}` : ""}`
  }

  function renderFlags(todo: Todo) {
    const chips: { key: string; label: string; className: string }[] = []
    if (todo.status === "pending_approval") {
      chips.push({
        key: "pending",
        label: todo.submittedAt ? `Pending · ${fmtWhen(todo.submittedAt)}` : "Pending approval",
        className: "bg-violet-500/12 text-violet-800",
      })
    }
    if (todo.latePenaltyPoints > 0) {
      chips.push({
        key: "late",
        label: `Late −${todo.latePenaltyPoints}`,
        className: "bg-amber-500/12 text-amber-900",
      })
    }
    if (isOverdue(todo) && todo.status !== "pending_approval") {
      chips.push({ key: "overdue", label: "Overdue", className: "bg-red-500/12 text-red-800" })
    }
    if (!chips.length) return null
    return (
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c.key}
            className={`h-6 inline-flex items-center rounded-full px-2 text-[10px] font-semibold tracking-tight ${c.className}`}
          >
            {c.label}
          </span>
        ))}
      </div>
    )
  }

  function renderAdminReview(todo: Todo) {
    if (!isAdmin || todo.status === "done") return null
    return (
      <div className="rounded-[12px] border border-[#0071e3]/20 bg-[#0071e3]/[0.04] px-3 py-2.5 space-y-2">
        {todo.status === "pending_approval" && (
          <>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              className={appleTextarea}
              placeholder="Note (optional)"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="h-8 inline-flex items-center rounded-full px-3 text-[11px] font-semibold bg-[#1d1d1f] text-white hover:bg-black disabled:opacity-40 cursor-pointer"
                disabled={saving}
                onClick={() => void submitApprove(todo)}
              >
                Approve
              </button>
              <button
                type="button"
                className="h-8 inline-flex items-center rounded-full px-3 text-[11px] font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.04] disabled:opacity-40 cursor-pointer"
                disabled={saving}
                onClick={() => void submitReject(todo)}
              >
                Send back
              </button>
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="datetime-local"
            value={extendDraft}
            onChange={(e) => setExtendDraft(e.target.value)}
            className={`${appleField} min-w-[11rem] flex-1`}
          />
          <button
            type="button"
            className="h-8 inline-flex items-center gap-1 rounded-full px-3 text-[11px] font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.04] disabled:opacity-40 cursor-pointer"
            disabled={saving}
            onClick={() => void submitExtend(todo)}
          >
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} />
            Extend
          </button>
        </div>
      </div>
    )
  }

  function statusOptions(admin: boolean) {
    return (
      <>
        <option value="open">Open</option>
        <option value="in_progress">In progress</option>
        <option value="pending_approval">Submit for approval</option>
        {admin ? <option value="done">Done (admin)</option> : null}
      </>
    )
  }

  function renderReminder(todo: Todo) {
    if (!isRecurringCadence(todo.cadence) || !canUpdate(todo)) return null
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="time"
          value={reminderDraft}
          onChange={(e) => setReminderDraft(e.target.value)}
          className={`${appleField} w-auto`}
        />
        <button
          type="button"
          className="h-8 inline-flex items-center rounded-full px-3 text-[11px] font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.04] disabled:opacity-40 cursor-pointer"
          disabled={saving}
          onClick={() => void saveReminder(todo)}
        >
          Reminder
        </button>
      </div>
    )
  }

  function renderActivity(todo: Todo) {
    if (todo.updates.length === 0) {
      return <p className="text-[11px] text-[#86868b]">No activity</p>
    }
    return (
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-none pr-0.5">
        {todo.updates.map((u) => (
          <div
            key={u.id}
            className="rounded-[10px] border border-black/[0.06] bg-[#fafafa]/90 dark:bg-white/[0.02] px-2.5 py-2 space-y-1.5"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${statusClass(u.status)}`}
              >
                {statusLabel(u.status)}
              </span>
              <span className="text-[10px] text-[#86868b]">
                {fmtWhen(u.createdAt)}
                {u.createdBy ? ` · ${u.createdBy}` : ""}
              </span>
            </div>
            {u.message ? <p className="text-[12px] whitespace-pre-wrap leading-snug">{u.message}</p> : null}
            {u.attachmentUrls.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {u.attachmentUrls.map((url) => {
                  const isImg = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)
                  return (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-12 w-12 rounded-[8px] border border-black/[0.06] overflow-hidden flex items-center justify-center bg-[#f2f2f7]"
                    >
                      {isImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Paperclip className="h-3.5 w-3.5 text-[#86868b]" />
                      )}
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  function renderUpdateForm(todo: Todo) {
    if (!canUpdate(todo) || todo.status === "done") return null
    return (
      <form onSubmit={submitUpdate} className="rounded-[12px] border border-black/[0.06] bg-white/90 dark:bg-[hsl(var(--card))] p-2.5 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)] gap-2">
          <select
            value={updateForm.status}
            onChange={(e) =>
              setUpdateForm((f) => ({
                ...f,
                status: e.target.value as TodoStatus,
              }))
            }
            className={appleSelect}
          >
            {statusOptions(Boolean(isAdmin))}
          </select>
          <textarea
            value={updateForm.message}
            onChange={(e) => setUpdateForm((f) => ({ ...f, message: e.target.value }))}
            rows={2}
            className={appleTextarea}
            placeholder="Note…"
          />
        </div>
        <FileUploader
          files={attachFiles}
          onAdd={(list) => addFiles(list, setAttachFiles)}
          onRemove={(i) => removeFile(i, setAttachFiles)}
        />
        <button
          type="submit"
          disabled={saving}
          className="h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold bg-[#1d1d1f] text-white hover:bg-black disabled:opacity-40 cursor-pointer"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" strokeWidth={1.75} />}
          {updateForm.status === "pending_approval"
            ? "Submit"
            : updateForm.status === "done"
              ? "Done"
              : "Save"}
        </button>
      </form>
    )
  }

  const applePill =
    "h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.04] disabled:opacity-40 cursor-pointer"
  const segActive =
    "bg-white text-[#1d1d1f] shadow-sm dark:bg-[hsl(var(--card))] dark:text-[hsl(var(--foreground))]"
  const segIdle = "text-[#6e6e73] hover:text-[#1d1d1f]"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="inline-flex items-center gap-2 min-w-0">
          <span className="h-8 w-8 rounded-[10px] bg-[#0071e3]/10 inline-flex items-center justify-center shrink-0">
            <CheckSquare className="h-4 w-4 text-[#0071e3]" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] leading-tight">
              To-do
            </h2>
            <p className="text-[11px] text-[#86868b] tabular-nums">
              {stats.count} · {stats.open} open · {stats.pending} pending · {stats.done} done
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {isAdmin && (
            <>
              <button
                type="button"
                className={applePill}
                disabled={exportingPdf || loading}
                onClick={() => void handleExportPdf()}
              >
                {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" strokeWidth={1.75} />}
                PDF
              </button>
              <button
                type="button"
                className="h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight bg-[#1d1d1f] hover:bg-black text-white cursor-pointer"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Assign
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-full bg-[#e8e8ed] dark:bg-white/10 p-0.5">
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
              className={`px-3 py-1.5 text-[11px] font-semibold tracking-tight rounded-full transition-colors cursor-pointer ${
                period === tab.id ? segActive : segIdle
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="inline-flex items-center gap-0.5 rounded-full bg-[#e8e8ed] dark:bg-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setView("all")}
              className={`px-3 py-1.5 text-[11px] font-semibold tracking-tight rounded-full transition-colors cursor-pointer ${
                view === "all" ? segActive : segIdle
              }`}
            >
              Team
            </button>
            <button
              type="button"
              onClick={() => {
                setView("mine")
                setFilterUserId("all")
              }}
              className={`px-3 py-1.5 text-[11px] font-semibold tracking-tight rounded-full transition-colors cursor-pointer ${
                view === "mine" ? segActive : segIdle
              }`}
            >
              Mine
            </button>
          </div>
        )}
        {isAdmin && view === "all" && (
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="h-8 rounded-full border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-3 text-[11px] font-semibold tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 min-w-[9rem]"
          >
            <option value="all">Everyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 rounded-full border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[11px] font-medium tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
          />
          <span className="text-[10px] text-[#aeaeb2]">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 rounded-full border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[11px] font-medium tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
          />
          {(dateFrom || dateTo || filterUserId !== "all") && (
            <button
              type="button"
              className="h-8 px-2.5 rounded-full text-[11px] font-semibold text-[#0071e3] cursor-pointer hover:bg-[#0071e3]/08"
              onClick={() => {
                setDateFrom("")
                setDateTo("")
                setFilterUserId("all")
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[#86868b]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filteredTodos.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-black/[0.08] py-16 text-center text-[13px] text-[#86868b]">
          No to-dos
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] gap-3 min-h-[58vh]">
          <div className={`space-y-1.5 ${mobileDetail ? "hidden lg:block" : "block"}`}>
            {teamMode ? (
              <>
                {peopleGroups.map((person) => {
                  const active = selectedPersonId === person.userId
                  return (
                    <button
                      key={person.userId}
                      type="button"
                      onClick={() => openPerson(person.userId)}
                      className={`w-full text-left rounded-[14px] border px-3 py-2.5 transition-colors cursor-pointer ${
                        active
                          ? "border-[#0071e3]/35 bg-[#0071e3]/08 ring-1 ring-[#0071e3]/20"
                          : "border-black/[0.06] bg-white/90 dark:bg-[hsl(var(--card))] hover:bg-black/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold tracking-tight truncate text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                            {person.name}
                          </p>
                          <p className="text-[11px] text-[#86868b] tabular-nums mt-0.5">
                            {person.items.length}
                            <span className="text-amber-700"> · {person.open}</span>
                            {person.pending > 0 ? (
                              <span className="text-violet-700"> · {person.pending}</span>
                            ) : null}
                            <span className="text-emerald-700"> · {person.done}</span>
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#c7c7cc]" strokeWidth={1.75} />
                      </div>
                    </button>
                  )
                })}
              </>
            ) : (
              <>
                {filteredTodos.map((row) => {
                  const active = selectedId === row.id
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => openTodo(row)}
                      className={`w-full text-left rounded-[14px] border px-3 py-2.5 transition-colors cursor-pointer ${
                        active
                          ? "border-[#0071e3]/35 bg-[#0071e3]/08 ring-1 ring-[#0071e3]/20"
                          : "border-black/[0.06] bg-white/90 dark:bg-[hsl(var(--card))] hover:bg-black/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-[13px] font-semibold tracking-tight truncate">{row.title}</p>
                            <span
                              className={`shrink-0 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${statusClass(row.status)}`}
                            >
                              {statusLabel(row.status)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#86868b] mt-0.5 truncate">{cadenceLine(row)}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#c7c7cc]" strokeWidth={1.75} />
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </div>

          <div
            className={`rounded-[16px] border border-black/[0.06] bg-[#fafafa]/90 dark:bg-white/[0.02] p-3 sm:p-4 ${
              mobileDetail ? "block" : "hidden lg:block"
            }`}
          >
            {mobileDetail && (
              <button
                type="button"
                className="mb-2 h-8 inline-flex items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-[#0071e3] hover:bg-[#0071e3]/08 lg:hidden cursor-pointer"
                onClick={() => setMobileDetail(false)}
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> List
              </button>
            )}

            {teamMode && selectedPerson ? (
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                    {selectedPerson.name}
                  </h2>
                  <span className="text-[11px] text-[#86868b] tabular-nums shrink-0">
                    {selectedPerson.items.length}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[calc(100vh-14rem)] overflow-y-auto scrollbar-none">
                  {selectedPerson.items.map((row) => {
                    const active = selected?.id === row.id
                    return (
                      <div
                        key={row.id}
                        className={`rounded-[12px] border overflow-hidden bg-white/95 dark:bg-[hsl(var(--card))] ${
                          active
                            ? "border-[#0071e3]/35 ring-1 ring-[#0071e3]/20"
                            : "border-black/[0.06]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(row.id)
                            setUpdateForm({
                              message: "",
                              status: draftStatus(row),
                            })
                            attachFiles.forEach((f) => {
                              if (f.file.type.startsWith("image/")) URL.revokeObjectURL(f.preview)
                            })
                            setAttachFiles([])
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-black/[0.02] cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-[13px] font-semibold tracking-tight truncate">{row.title}</p>
                            <span
                              className={`shrink-0 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${statusClass(row.status)}`}
                            >
                              {statusLabel(row.status)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#86868b] mt-0.5 truncate">{cadenceLine(row)}</p>
                        </button>

                        {active && selected && (
                          <div className="border-t border-black/[0.06] px-3 py-2.5 space-y-2 bg-[#f5f5f7]/70 dark:bg-white/[0.02]">
                            <div className="flex items-center justify-between gap-2">
                              {selected.description ? (
                                <p className="text-[12px] text-[#6e6e73] line-clamp-2 min-w-0">
                                  {selected.description}
                                </p>
                              ) : (
                                <span />
                              )}
                              <button
                                type="button"
                                className="h-7 shrink-0 inline-flex items-center gap-1 rounded-full px-2 text-[10px] font-semibold text-red-600 hover:bg-red-500/10 cursor-pointer"
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
                                <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                              </button>
                            </div>

                            {renderFlags(selected)}
                            {renderReminder(selected)}
                            {renderAdminReview(selected)}
                            {renderUpdateForm(selected)}
                            {renderActivity(selected)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : selected ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="text-[15px] font-semibold tracking-tight">{selected.title}</h2>
                      <span
                        className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${statusClass(selected.status)}`}
                      >
                        {statusLabel(selected.status)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#86868b] mt-0.5 truncate">
                      {selected.assigneeName} · {cadenceLine(selected)}
                    </p>
                    {selected.description ? (
                      <p className="text-[12px] mt-2 rounded-[10px] bg-[#f2f2f7] dark:bg-white/[0.04] px-2.5 py-2 whitespace-pre-wrap leading-snug">
                        {selected.description}
                      </p>
                    ) : null}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="h-7 shrink-0 inline-flex items-center gap-1 rounded-full px-2 text-[10px] font-semibold text-red-600 hover:bg-red-500/10 cursor-pointer"
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
                      <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                    </button>
                  )}
                </div>

                {renderFlags(selected)}
                {renderReminder(selected)}
                {renderAdminReview(selected)}
                {renderUpdateForm(selected)}
                {renderActivity(selected)}
              </div>
            ) : (
              <div className="flex h-full min-h-[36vh] items-center justify-center text-[13px] text-[#86868b]">
                Select a task
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-md p-0 sm:p-3"
            onClick={() => setShowCreate(false)}
          >
            <form
              onSubmit={submitCreate}
              className="apple-sheet-in w-full sm:max-w-md max-h-[92vh] rounded-t-[18px] sm:rounded-[18px] border border-black/[0.06] bg-white dark:bg-[hsl(var(--card))] shadow-[0_16px_48px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/[0.06] shrink-0">
                <p className="text-[15px] font-semibold tracking-tight">Assign</p>
                <button
                  type="button"
                  className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                  onClick={() => setShowCreate(false)}
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none p-4 space-y-2.5">
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={appleField}
                  required
                  placeholder="Title"
                />
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className={appleTextarea}
                  placeholder="Details"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={form.cadence}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cadence: e.target.value as TodoCadence }))
                    }
                    className={appleSelect}
                  >
                    {TODO_CADENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    value={form.dueAt}
                    onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                    className={appleField}
                    placeholder="Due"
                  />
                </div>
                {form.cadence !== "once" && (
                  <input
                    type="time"
                    value={form.reminderTime}
                    onChange={(e) => setForm((f) => ({ ...f, reminderTime: e.target.value }))}
                    className={appleField}
                    required
                  />
                )}
                <select
                  value={form.assigneeUserId}
                  onChange={(e) => setForm((f) => ({ ...f, assigneeUserId: e.target.value }))}
                  className={appleSelect}
                  required
                >
                  <option value="">Assignee</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="shrink-0 border-t border-black/[0.06] px-4 py-3 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  className="h-8 inline-flex items-center rounded-full px-3 text-[11px] font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.04] cursor-pointer"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold bg-[#1d1d1f] text-white hover:bg-black disabled:opacity-40 cursor-pointer"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Assign
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </div>
  )
}
