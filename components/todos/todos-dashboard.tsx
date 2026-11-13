"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Paperclip,
  Plus,
  SlidersHorizontal,
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

function fmtShort(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function statusClass(status: string) {
  if (status === "done") return "bg-emerald-500/12 text-emerald-700"
  if (status === "pending_approval") return "bg-violet-500/12 text-violet-800"
  if (status === "in_progress") return "bg-sky-500/12 text-sky-800"
  return "bg-amber-500/12 text-amber-800"
}

function shortStatus(status: string) {
  if (status === "in_progress") return "Progress"
  if (status === "pending_approval") return "Pending"
  if (status === "done") return "Done"
  return "Open"
}

const appleField =
  "w-full h-8 rounded-[9px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[12px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
const appleTextarea =
  "w-full rounded-[9px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 py-2 text-[12px] tracking-tight resize-none focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
const appleSelect =
  "w-full h-8 appearance-none rounded-[9px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] pl-2.5 pr-7 text-[12px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 cursor-pointer"
const appleDateField =
  "w-full h-8 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] pl-8 pr-2.5 text-[12px] font-medium tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 [color-scheme:light] dark:[color-scheme:dark]"

function AppleSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative min-w-0">
      <select className={className} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]"
        strokeWidth={2.25}
      />
    </div>
  )
}

function AppleDateInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative min-w-0">
      <CalendarDays
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]"
        strokeWidth={1.75}
      />
      <input type="date" className={className} {...props} />
    </div>
  )
}

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

type PeriodTab = "today" | "all" | "archive"

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
          className="relative h-9 w-9 rounded-[8px] overflow-hidden border border-black/[0.06] bg-[#f2f2f7] flex items-center justify-center"
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
        className="h-9 w-9 rounded-[8px] border border-dashed border-black/[0.12] flex items-center justify-center text-[#86868b] hover:bg-black/[0.03] cursor-pointer"
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
  const [showFilters, setShowFilters] = useState(false)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!showFilters) {
      setFilterPos(null)
      return
    }
    function place() {
      const btn = filterBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const panelW = Math.min(320, window.innerWidth - 24)
      const left = Math.min(Math.max(12, r.right - panelW), window.innerWidth - panelW - 12)
      const top = Math.min(r.bottom + 8, window.innerHeight - 24)
      setFilterPos({ top, left })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [showFilters])

  useEffect(() => {
    if (!showFilters) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (filtersRef.current?.contains(t) || filterBtnRef.current?.contains(t)) return
      setShowFilters(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [showFilters])

  const todayKey = ymdLocal(new Date())

  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      if (filterUserId !== "all" && t.assigneeUserId !== filterUserId) return false

      // Done lives only in Archive
      if (period === "archive") {
        if (t.status !== "done") return false
        if (dateFrom || dateTo) return inDateRange(t, dateFrom, dateTo)
        return true
      }
      if (t.status === "done") return false

      if (dateFrom || dateTo) return inDateRange(t, dateFrom, dateTo)

      if (period === "today") {
        if (isRecurringCadence(t.cadence)) return true
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

  const archiveCount = useMemo(() => todos.filter((t) => t.status === "done").length, [todos])

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

  function listMeta(row: Todo) {
    const bits: string[] = []
    if (isRecurringCadence(row.cadence)) {
      bits.push(cadenceLabel(row.cadence).replace(" (recurring)", ""))
      const reminder = formatReminderTime(row.reminderTime)
      if (reminder) bits.push(reminder)
    }
    const due = fmtShort(row.dueAt)
    if (due) bits.push(due)
    return bits.join(" · ")
  }

  const hasActiveFilters = Boolean(dateFrom || dateTo || filterUserId !== "all")

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
      <div className="space-y-1.5">
        {todo.status === "pending_approval" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className={`${appleField} flex-1 min-w-[8rem]`}
              placeholder="Note"
            />
            <button
              type="button"
              className="h-7 inline-flex items-center rounded-full px-2.5 text-[10px] font-semibold bg-[#1d1d1f] text-white hover:bg-black disabled:opacity-40 cursor-pointer"
              disabled={saving}
              onClick={() => void submitApprove(todo)}
            >
              Approve
            </button>
            <button
              type="button"
              className="h-7 inline-flex items-center rounded-full px-2.5 text-[10px] font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.04] disabled:opacity-40 cursor-pointer"
              disabled={saving}
              onClick={() => void submitReject(todo)}
            >
              Back
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="datetime-local"
            value={extendDraft}
            onChange={(e) => setExtendDraft(e.target.value)}
            className={`${appleField} min-w-[10rem] flex-1`}
          />
          <button
            type="button"
            className="h-7 inline-flex items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.04] disabled:opacity-40 cursor-pointer"
            disabled={saving}
            onClick={() => void submitExtend(todo)}
          >
            <CalendarClock className="h-3 w-3" strokeWidth={1.75} />
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
          className="h-7 inline-flex items-center rounded-full px-2.5 text-[10px] font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.04] disabled:opacity-40 cursor-pointer"
          disabled={saving}
          onClick={() => void saveReminder(todo)}
        >
          Reminder
        </button>
      </div>
    )
  }

  function renderDetailBody(todo: Todo) {
    return (
      <div className="space-y-2">
        {todo.description ? (
          <p className="text-[12px] text-[#6e6e73] leading-snug line-clamp-3 whitespace-pre-wrap">
            {todo.description}
          </p>
        ) : null}
        {renderFlags(todo)}
        {renderReminder(todo)}
        {renderAdminReview(todo)}
        {renderUpdateForm(todo)}
        {renderActivity(todo)}
      </div>
    )
  }

  function renderActivity(todo: Todo) {
    const useful = todo.updates.filter((u) => u.message?.trim() || u.attachmentUrls.length > 0)
    if (useful.length === 0) return null
    return (
      <div className="space-y-1 max-h-[140px] overflow-y-auto scrollbar-none">
        {useful.slice(0, 8).map((u) => (
          <div key={u.id} className="flex gap-2 min-w-0">
            <span className="text-[10px] text-[#aeaeb2] tabular-nums shrink-0 pt-0.5 w-[3.25rem]">
              {fmtShort(u.createdAt) || "—"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] leading-snug text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                {u.createdBy ? (
                  <span className="font-semibold text-[#6e6e73]">{u.createdBy} </span>
                ) : null}
                {u.message?.trim() || "Attachment"}
              </p>
              {u.attachmentUrls.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {u.attachmentUrls.map((url) => {
                    const isImg = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)
                    return (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="h-9 w-9 rounded-[7px] border border-black/[0.06] overflow-hidden flex items-center justify-center bg-[#f2f2f7]"
                      >
                        {isImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Paperclip className="h-3 w-3 text-[#86868b]" />
                        )}
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderUpdateForm(todo: Todo) {
    if (!canUpdate(todo) || todo.status === "done") return null
    return (
      <form onSubmit={submitUpdate} className="space-y-1.5">
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-1.5">
          <AppleSelect
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
          </AppleSelect>
          <input
            value={updateForm.message}
            onChange={(e) => setUpdateForm((f) => ({ ...f, message: e.target.value }))}
            className={appleField}
            placeholder="Note…"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <FileUploader
            files={attachFiles}
            onAdd={(list) => addFiles(list, setAttachFiles)}
            onRemove={(i) => removeFile(i, setAttachFiles)}
          />
          <button
            type="submit"
            disabled={saving}
            className="ml-auto h-7 inline-flex items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold bg-[#1d1d1f] text-white hover:bg-black disabled:opacity-40 cursor-pointer"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {updateForm.status === "pending_approval"
              ? "Submit"
              : updateForm.status === "done"
                ? "Done"
                : "Save"}
          </button>
        </div>
      </form>
    )
  }

  const applePill =
    "h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.04] disabled:opacity-40 cursor-pointer"
  const segActive =
    "bg-white text-[#1d1d1f] shadow-sm dark:bg-[hsl(var(--card))] dark:text-[hsl(var(--foreground))]"
  const segIdle = "text-[#6e6e73] hover:text-[#1d1d1f]"

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex items-center gap-1.5 min-w-0 mr-1">
          <span className="h-7 w-7 rounded-[9px] bg-[#0071e3]/10 inline-flex items-center justify-center shrink-0">
            <CheckSquare className="h-3.5 w-3.5 text-[#0071e3]" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              To-do
            </p>
            <p className="text-[10px] text-[#86868b] tabular-nums">
              {period === "archive"
                ? `${stats.count} archived`
                : `${stats.count} · ${stats.open + stats.progress} active`}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-full bg-[#e8e8ed] dark:bg-white/10 p-0.5">
          {(
            [
              { id: "today" as const, label: "Today" },
              { id: "all" as const, label: "All" },
              { id: "archive" as const, label: "Archive" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriod(tab.id)}
              className={`px-2.5 py-1 text-[11px] font-semibold tracking-tight rounded-full transition-colors cursor-pointer ${
                period === tab.id ? segActive : segIdle
              }`}
            >
              {tab.label}
              {tab.id === "archive" && archiveCount > 0 ? (
                <span className="ml-1 text-[10px] tabular-nums opacity-70">{archiveCount}</span>
              ) : null}
            </button>
          ))}
        </div>

        {isAdmin && (
          <div className="inline-flex items-center gap-0.5 rounded-full bg-[#e8e8ed] dark:bg-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setView("all")}
              className={`px-2.5 py-1 text-[11px] font-semibold tracking-tight rounded-full transition-colors cursor-pointer ${
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
              className={`px-2.5 py-1 text-[11px] font-semibold tracking-tight rounded-full transition-colors cursor-pointer ${
                view === "mine" ? segActive : segIdle
              }`}
            >
              Mine
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto">
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
                className="h-8 inline-flex items-center gap-1 rounded-full px-3 text-[11px] font-semibold tracking-tight bg-[#1d1d1f] hover:bg-black text-white cursor-pointer"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Assign
              </button>
            </>
          )}
          <button
            ref={filterBtnRef}
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`relative h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              showFilters
                ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                : "text-[#86868b] hover:bg-black/[0.05] dark:hover:bg-white/10 hover:text-[#1d1d1f]"
            }`}
            aria-label="Filters"
            aria-expanded={showFilters}
            title="Filters"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            {hasActiveFilters && !showFilters && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#007aff]" />
            )}
          </button>
        </div>
      </div>

      {showFilters &&
        filterPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={filtersRef}
            className="fixed z-[95] w-[min(20rem,calc(100vw-1.5rem))] rounded-[18px] border border-black/[0.06] bg-white/92 dark:bg-[hsl(var(--card))]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-3 space-y-2"
            style={{ top: filterPos.top, left: filterPos.left }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold tracking-tight">Filters</p>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom("")
                      setDateTo("")
                      setFilterUserId("all")
                    }}
                    className="text-[11px] font-semibold text-[#0071e3] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                  aria-label="Close filters"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>
            </div>
            {isAdmin && view === "all" && (
              <AppleSelect
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className={appleSelect}
              >
                <option value="all">Everyone</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </AppleSelect>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <AppleDateInput
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={appleDateField}
              />
              <AppleDateInput
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={appleDateField}
              />
            </div>
          </div>,
          document.body,
        )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#86868b]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filteredTodos.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-black/[0.08] py-12 text-center text-[13px] text-[#86868b]">
          {period === "archive" ? "Archive empty" : "No to-dos"}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] gap-2.5 min-h-[52vh]">
          <div
            className={`rounded-[14px] border border-black/[0.06] bg-white/90 dark:bg-[hsl(var(--card))] overflow-hidden ${
              mobileDetail ? "hidden lg:block" : "block"
            }`}
          >
            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto scrollbar-none divide-y divide-black/[0.05]">
              {teamMode
                ? peopleGroups.map((person) => {
                    const active = selectedPersonId === person.userId
                    return (
                      <button
                        key={person.userId}
                        type="button"
                        onClick={() => openPerson(person.userId)}
                        className={`w-full text-left px-3 py-2 transition-colors cursor-pointer ${
                          active ? "bg-[#0071e3]/08" : "hover:bg-black/[0.02]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-semibold tracking-tight truncate">{person.name}</p>
                            <p className="text-[10px] text-[#86868b] tabular-nums">
                              {person.items.length}
                              {person.pending > 0 ? ` · ${person.pending} pending` : ""}
                            </p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#c7c7cc]" strokeWidth={1.75} />
                        </div>
                      </button>
                    )
                  })
                : filteredTodos.map((row) => {
                    const active = selectedId === row.id
                    const meta = listMeta(row)
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => openTodo(row)}
                        className={`w-full text-left px-3 py-2 transition-colors cursor-pointer ${
                          active ? "bg-[#0071e3]/08" : "hover:bg-black/[0.02]"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-[12px] font-semibold tracking-tight truncate flex-1">{row.title}</p>
                          <span
                            className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusClass(row.status)}`}
                          >
                            {shortStatus(row.status)}
                          </span>
                        </div>
                        {meta ? <p className="text-[10px] text-[#86868b] mt-0.5 truncate">{meta}</p> : null}
                      </button>
                    )
                  })}
            </div>
          </div>

          <div
            className={`rounded-[14px] border border-black/[0.06] bg-[#fafafa]/90 dark:bg-white/[0.02] p-3 ${
              mobileDetail ? "block" : "hidden lg:block"
            }`}
          >
            {mobileDetail && (
              <button
                type="button"
                className="mb-2 h-7 inline-flex items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-[#0071e3] hover:bg-[#0071e3]/08 lg:hidden cursor-pointer"
                onClick={() => setMobileDetail(false)}
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> List
              </button>
            )}

            {teamMode && selectedPerson ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-[14px] font-semibold tracking-tight">{selectedPerson.name}</h2>
                  <span className="text-[10px] text-[#86868b] tabular-nums">{selectedPerson.items.length}</span>
                </div>
                <div className="space-y-1 max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-none">
                  {selectedPerson.items.map((row) => {
                    const active = selected?.id === row.id
                    const meta = listMeta(row)
                    return (
                      <div
                        key={row.id}
                        className={`rounded-[10px] border overflow-hidden bg-white/95 dark:bg-[hsl(var(--card))] ${
                          active ? "border-[#0071e3]/35 ring-1 ring-[#0071e3]/15" : "border-black/[0.06]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(row.id)
                            setUpdateForm({ message: "", status: draftStatus(row) })
                            attachFiles.forEach((f) => {
                              if (f.file.type.startsWith("image/")) URL.revokeObjectURL(f.preview)
                            })
                            setAttachFiles([])
                          }}
                          className="w-full text-left px-2.5 py-2 hover:bg-black/[0.02] cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-[12px] font-semibold tracking-tight truncate flex-1">{row.title}</p>
                            <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusClass(row.status)}`}>
                              {shortStatus(row.status)}
                            </span>
                          </div>
                          {meta ? <p className="text-[10px] text-[#86868b] mt-0.5 truncate">{meta}</p> : null}
                        </button>
                        {active && selected && (
                          <div className="border-t border-black/[0.06] px-2.5 py-2 space-y-2 bg-[#f5f5f7]/70 dark:bg-white/[0.02]">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                className="h-6 w-6 inline-flex items-center justify-center rounded-full text-red-600 hover:bg-red-500/10 cursor-pointer"
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
                            {renderDetailBody(selected)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : selected ? (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="text-[14px] font-semibold tracking-tight truncate">{selected.title}</h2>
                      <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusClass(selected.status)}`}>
                        {shortStatus(selected.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#86868b] mt-0.5 truncate">
                      {[selected.assigneeName, listMeta(selected)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-full text-red-600 hover:bg-red-500/10 cursor-pointer"
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
                {renderDetailBody(selected)}
              </div>
            ) : (
              <div className="flex h-full min-h-[28vh] items-center justify-center text-[13px] text-[#86868b]">
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
                  <AppleSelect
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
                  </AppleSelect>
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
                <AppleSelect
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
                </AppleSelect>
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
