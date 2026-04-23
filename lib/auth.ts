export type Module = "dashboard" | "purchase" | "finance" | "crm" | "inventory" | "dispatches" | "website" | "docs" | "hrm" | "branches" | "tickets"

export interface User {
  id: string
  name: string
  email: string
  password: string
  role: "superadmin" | "user"
  modules: Module[]
}

export const ALL_MODULES: Module[] = ["dashboard", "purchase", "finance", "crm", "inventory", "dispatches", "website", "docs", "hrm", "branches", "tickets"]

export const MODULE_LABELS: Record<Module, string> = {
  dashboard: "Dashboard",
  purchase: "Purchase",
  finance: "Finance",
  crm: "CRM",
  inventory: "Inventory",
  dispatches: "Dispatches",
  website: "Website",
  docs: "Documentation",
  hrm: "HRM",
  branches: "Branches",
  tickets: "Tickets",
}

const SESSION_KEY = "erp_session"

export function getSession(): User | null {
  if (typeof window === "undefined") return null
  const s = localStorage.getItem(SESSION_KEY)
  return s ? JSON.parse(s) : null
}

export function setSession(user: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

function mapRow(row: Record<string, unknown>): User {
  // Parse modules from JSON - it might be a string or already an array
  let modules: Module[] = []
  if (row.modules) {
    try {
      if (typeof row.modules === 'string') {
        modules = JSON.parse(row.modules as string)
      } else {
        modules = row.modules as Module[]
      }
    } catch (e) {
      modules = []
    }
  }

  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    password: row.password as string,
    role: row.role as "superadmin" | "user",
    modules,
  }
}

export async function getUsers(): Promise<User[]> {
  const res = await fetch("/api/db/users")
  if (!res.ok) return []
  const data = await res.json()
  return data.map(mapRow)
}

export async function saveUser(user: User): Promise<void> {
  await fetch("/api/db/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  })
}

export async function deleteUser(id: string): Promise<void> {
  await fetch("/api/db/users", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export async function login(email: string, password: string): Promise<User | null> {
  const res = await fetch("/api/db/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data) return null
  const user = mapRow(data)
  setSession(user)
  return user
}
