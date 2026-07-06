export type Module = "dashboard" | "purchase" | "finance" | "crm" | "inventory" | "dispatches" | "website" | "docs" | "hrm" | "branches" | "tickets" | "warranty" | "pos"

export type UserRole = "superadmin" | "admin" | "user" | "sales_agent" | "sales_manager" | "view_only"

export interface User {
  id: string
  name: string
  email: string
  password: string
  role: UserRole
  modules: Module[]
  managerId?: string | null
  branchId?: string | null
  location?: string
  jobTitle?: string
  baseSalary?: number
  commissionPercent?: number
  notificationEmails?: string[]
  emailNotificationsEnabled?: boolean
}

export const ALL_MODULES: Module[] = ["dashboard", "purchase", "finance", "crm", "inventory", "dispatches", "website", "docs", "hrm", "branches", "tickets", "warranty", "pos"]

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
  warranty: "Warranty",
  pos: "POS",
}

/** Roles that superadmin can assign when creating/editing users. */
export const ASSIGNABLE_ROLES: UserRole[] = ["user", "admin", "sales_agent", "view_only"]

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "User",
  sales_agent: "Sales Agent",
  sales_manager: "Sales Manager",
  view_only: "View Only",
}

export function isViewOnlyUser(role: UserRole | string | undefined | null) {
  return role === "view_only"
}

export function canWriteErp(user?: { role?: string } | null) {
  return !!user && !isViewOnlyUser(user.role)
}

export function roleHasAllModules(role: UserRole | string | undefined | null) {
  return role === "superadmin" || role === "admin"
}

export function isErpAdmin(role: UserRole | string | undefined | null) {
  return role === "superadmin" || role === "admin"
}

export function isSuperadmin(role: UserRole | string | undefined | null) {
  return role === "superadmin"
}

export function modulesForRole(role: UserRole, selected: Module[]): Module[] {
  if (roleHasAllModules(role)) return [...ALL_MODULES]
  if (role === "sales_agent" && selected.length === 0) return ["crm"]
  return selected
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

  let notificationEmails: string[] = []
  if (row.notificationEmails) {
    try {
      notificationEmails = Array.isArray(row.notificationEmails)
        ? (row.notificationEmails as string[])
        : JSON.parse(row.notificationEmails as string)
    } catch {
      notificationEmails = []
    }
  }

  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    password: row.password as string,
    role: row.role as UserRole,
    modules,
    managerId: (row.managerId as string | null) ?? undefined,
    branchId: (row.branchId as string | null) ?? undefined,
    location: (row.location as string) ?? undefined,
    jobTitle: (row.jobTitle as string) ?? undefined,
    baseSalary: (row.baseSalary as number) ?? undefined,
    commissionPercent: (row.commissionPercent as number) ?? undefined,
    notificationEmails,
    emailNotificationsEnabled: row.emailNotificationsEnabled !== false,
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
    body: JSON.stringify({ email: email.trim(), password }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data) return null
  const user = mapRow(data)
  setSession(user)
  return user
}

export async function branchPosLoginAndSession(
  email: string,
  password: string,
  branchCode?: string,
): Promise<{ user: User | null; error?: string }> {
  const res = await fetch("/api/db/pos/branch-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode, email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { user: null, error: (data as { error?: string }).error || "Login failed" }
  }
  if (!data?.id) return { user: null, error: "Login failed" }
  const user = mapRow(data)
  setSession(user)
  return { user }
}
