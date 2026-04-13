import { supabase } from "@/lib/supabase"

export type Module = "dashboard" | "purchase" | "finance" | "crm" | "inventory" | "website" | "docs"

export interface User {
  id: string
  name: string
  email: string
  password: string
  role: "superadmin" | "user"
  modules: Module[]
}

export const ALL_MODULES: Module[] = ["dashboard", "purchase", "finance", "crm", "inventory", "website", "docs"]

export const MODULE_LABELS: Record<Module, string> = {
  dashboard: "Dashboard",
  purchase: "Purchase",
  finance: "Finance",
  crm: "CRM",
  inventory: "Inventory",
  website: "Website",
  docs: "Documentation",
}

const SESSION_KEY = "erp_session"

// ── Session (still localStorage — just the logged-in user) ───────
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

// ── Users — Supabase ─────────────────────────────────────────────
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase.from("erp_users").select("*").order("id")
  if (error) { console.error(error); return [] }
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    modules: row.modules as Module[],
  }))
}

export async function saveUser(user: User): Promise<void> {
  await supabase.from("erp_users").upsert({
    id: user.id,
    name: user.name,
    email: user.email,
    password: user.password,
    role: user.role,
    modules: user.modules,
  })
}

export async function deleteUser(id: string): Promise<void> {
  await supabase.from("erp_users").delete().eq("id", id)
}

export async function login(email: string, password: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("erp_users")
    .select("*")
    .eq("email", email)
    .eq("password", password)
    .single()
  if (error || !data) return null
  const user: User = {
    id: data.id,
    name: data.name,
    email: data.email,
    password: data.password,
    role: data.role,
    modules: data.modules as Module[],
  }
  setSession(user)
  return user
}
