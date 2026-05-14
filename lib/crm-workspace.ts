import type { User } from "@/lib/auth"

export type CrmWorkspaceMode = "main" | "sales_agent"

export type CrmWorkspaceScope = {
  mode: CrmWorkspaceMode
  ownerUserId?: string
  readOnly?: boolean
}

export function isSalesAgentUser(user?: User | null) {
  return user?.role === "sales_agent"
}

export function canAccessCrmMain(user?: User | null) {
  return !!user && user.role !== "sales_agent"
}

export function canAccessSalesAgentsArea(user?: User | null) {
  return !!user && (user.role === "superadmin" || user.role === "sales_agent")
}

export function matchesOwnerRecord(ownerUserId: string | undefined, scopeUserId?: string) {
  if (!scopeUserId) return true
  return ownerUserId === scopeUserId
}

export function resolveOwnerUserId(scopeUserId: string | undefined, currentUserId?: string) {
  return scopeUserId || currentUserId
}
