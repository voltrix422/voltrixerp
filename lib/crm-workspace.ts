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

export function isSalesAgentSubmission(ownerUserId?: string) {
  return !!ownerUserId
}

export function initialClientStatus(_workspace?: CrmWorkspaceScope): ClientStatus {
  return "active"
}

export function initialOrderStatus(workspace?: CrmWorkspaceScope): "pending_approval" | "approved" {
  return workspace?.mode === "sales_agent" ? "pending_approval" : "approved"
}

export function initialQuotationStatus(workspace?: CrmWorkspaceScope): "pending_approval" | "draft" {
  return workspace?.mode === "sales_agent" ? "pending_approval" : "draft"
}
