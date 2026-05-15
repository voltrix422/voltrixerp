import type { User } from "@/lib/auth"
import type { ClientStatus } from "@/lib/crm"

export type CrmWorkspaceMode = "main" | "sales_agent"

export type CrmWorkspaceScope = {
  mode: CrmWorkspaceMode
  ownerUserId?: string
  readOnly?: boolean
}

export function isSalesAgentUser(user?: User | null) {
  return user?.role === "sales_agent"
}

export function isSalesManagerUser(user?: User | null) {
  return user?.role === "sales_manager"
}

export function canManageAllSalesAgents(user?: User | null) {
  return user?.role === "superadmin"
}

export function canAccessCrmMain(user?: User | null) {
  return !!user && user.role !== "sales_agent"
}

export function canAccessSalesAgentsArea(user?: User | null) {
  return !!user && (user.role === "superadmin" || user.role === "sales_manager" || user.role === "sales_agent")
}

export function isSalesAgentsAdminView(user?: User | null) {
  return user?.role === "superadmin" || user?.role === "sales_manager"
}

export function matchesOwnerRecord(ownerUserId: string | undefined, scopeUserId?: string) {
  if (!scopeUserId) return true
  return ownerUserId === scopeUserId
}

export function resolveOwnerUserId(scopeUserId: string | undefined, currentUserId?: string) {
  return scopeUserId || currentUserId
}

export function isSalesAgentSubmission(ownerUserId?: string) {
  return !!ownerUserId
}

export function initialClientStatus(_workspace?: CrmWorkspaceScope): ClientStatus {
  return "active"
}

export function initialOrderStatus(_workspace?: CrmWorkspaceScope): "pending_approval" {
  return "pending_approval"
}

export function initialQuotationStatus(_workspace?: CrmWorkspaceScope): "draft" {
  return "draft"
}

export function orderStatusForQuotationConversion(): "pending_approval" {
  return "pending_approval"
}
