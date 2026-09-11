export type TodoCadence = "daily" | "weekly" | "monthly" | "once"
export type TodoStatus = "open" | "in_progress" | "done"

export type TodoUpdate = {
  id: string
  todoId: string
  message: string
  status: TodoStatus | string
  attachmentUrls: string[]
  createdBy: string
  createdByUserId: string | null
  createdAt: string
}

export type Todo = {
  id: string
  title: string
  description: string
  cadence: TodoCadence | string
  dueAt: string | null
  assigneeUserId: string
  assigneeName: string
  status: TodoStatus | string
  assignedBy: string
  assignedById: string | null
  assignedAt: string
  completedAt: string | null
  completedBy: string
  createdAt: string
  updatedAt: string
  updates: TodoUpdate[]
}

function urls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((u) => String(u ?? "").trim()).filter(Boolean)
}

function mapUpdate(row: Record<string, unknown>): TodoUpdate {
  return {
    id: String(row.id || ""),
    todoId: String(row.todoId || ""),
    message: String(row.message || ""),
    status: String(row.status || "in_progress"),
    attachmentUrls: urls(row.attachmentUrls),
    createdBy: String(row.createdBy || ""),
    createdByUserId: row.createdByUserId ? String(row.createdByUserId) : null,
    createdAt: String(row.createdAt || ""),
  }
}

function mapTodo(row: Record<string, unknown>): Todo {
  const updates = Array.isArray(row.updates)
    ? row.updates.map((u) => mapUpdate(u as Record<string, unknown>))
    : []
  return {
    id: String(row.id || ""),
    title: String(row.title || ""),
    description: String(row.description || ""),
    cadence: String(row.cadence || "once"),
    dueAt: row.dueAt ? String(row.dueAt) : null,
    assigneeUserId: String(row.assigneeUserId || ""),
    assigneeName: String(row.assigneeName || ""),
    status: String(row.status || "open"),
    assignedBy: String(row.assignedBy || ""),
    assignedById: row.assignedById ? String(row.assignedById) : null,
    assignedAt: String(row.assignedAt || ""),
    completedAt: row.completedAt ? String(row.completedAt) : null,
    completedBy: String(row.completedBy || ""),
    createdAt: String(row.createdAt || ""),
    updatedAt: String(row.updatedAt || ""),
    updates,
  }
}

export async function listTodos(params?: {
  mineForUserId?: string
  status?: string
}): Promise<Todo[]> {
  const qs = new URLSearchParams()
  if (params?.mineForUserId) qs.set("userId", params.mineForUserId)
  if (params?.status) qs.set("status", params.status)
  const res = await fetch(`/api/db/todos?${qs}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load todos")
  const data = await res.json()
  return Array.isArray(data) ? data.map((r) => mapTodo(r)) : []
}

export async function createTodo(input: {
  title: string
  description?: string
  cadence: TodoCadence
  dueAt?: string | null
  assigneeUserId: string
  assigneeName: string
  assignedBy?: string
  assignedById?: string
}): Promise<Todo> {
  const res = await fetch("/api/db/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", ...input }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to create todo")
  return mapTodo(data)
}

export async function addTodoUpdate(input: {
  id: string
  message?: string
  status: TodoStatus
  attachmentUrls?: string[]
  createdBy?: string
  createdByUserId?: string
}): Promise<Todo> {
  const res = await fetch("/api/db/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update", ...input }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to update todo")
  return mapTodo(data)
}

export async function deleteTodo(id: string): Promise<void> {
  const res = await fetch("/api/db/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Failed to delete todo")
}

export const TODO_CADENCE_OPTIONS: { value: TodoCadence; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "once", label: "One-time" },
]

export function cadenceLabel(c: string) {
  return TODO_CADENCE_OPTIONS.find((o) => o.value === c)?.label || c
}

export function statusLabel(s: string) {
  if (s === "in_progress") return "in progress"
  if (s === "done") return "done"
  return "open"
}
