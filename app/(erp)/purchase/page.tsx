"use client"
import { useEffect, useMemo, useState } from "react"
import { ModuleGuard } from "@/components/layout/module-guard"
import { Topbar } from "@/components/layout/topbar"
import { PurchaseLedgerManager } from "@/components/purchase/purchase-ledger-manager"
import { SuppliersTab } from "@/components/purchase/suppliers-tab"
import { AdvanceAccountsTab } from "@/components/purchase/advance-accounts-tab"
import { ClientProjectsTab } from "@/components/purchase/client-projects-tab"
import { ImportedPurchasesTab } from "@/components/purchase/imported-purchases-tab"
import { BookOpen, Users, Wallet, FolderKanban, FolderLock, Ship } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { normalizePurchaseScopes, roleHasAllModules } from "@/lib/auth"
import { getPurchaseScopes, purchaseScopeLabel, type PurchaseScope } from "@/lib/purchase-scopes"

export default function PurchasePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"ledger" | "imports" | "suppliers" | "advances" | "projects">("ledger")
  const [allScopes, setAllScopes] = useState<PurchaseScope[]>([])
  const isAdminLike = roleHasAllModules(user?.role)
  const allowedScopes = useMemo(() => {
    if (isAdminLike) return allScopes.map(s => s.id)
    return normalizePurchaseScopes(user?.purchaseScopes)
  }, [allScopes, isAdminLike, user?.purchaseScopes])
  const [scopeId, setScopeId] = useState("P1")
  const hasPurchaseAccess = isAdminLike || allowedScopes.length > 0

  useEffect(() => {
    void getPurchaseScopes().then(setAllScopes)
  }, [])

  useEffect(() => {
    if (allowedScopes.length === 0) return
    if (!allowedScopes.includes(scopeId)) {
      setScopeId(allowedScopes[0])
    }
  }, [allowedScopes, scopeId])

  const activeScopeName = purchaseScopeLabel(scopeId, allScopes)

  const tabs = [
    { key: "ledger" as const, label: "Purchase Ledger", icon: BookOpen },
    { key: "imports" as const, label: "Imported Purchases", icon: Ship },
    { key: "suppliers" as const, label: "Suppliers", icon: Users },
    { key: "advances" as const, label: "Advances", icon: Wallet },
    { key: "projects" as const, label: "Client Projects", icon: FolderKanban },
  ]

  return (
    <ModuleGuard module="purchase">
      <Topbar
        title="Purchase"
        description={activeScopeName
          ? `Purchase ledger for ${activeScopeName}`
          : "Purchase ledger, suppliers, and payment tracking"}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto w-full">
          <div className="px-4 pt-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
              <div className="inline-flex w-full sm:w-auto items-center gap-1 rounded-lg border bg-[hsl(var(--muted))]/20 p-1 overflow-x-auto">
                {tabs.map(t => {
                  const Icon = t.icon
                  const active = tab === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                          : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[11px] text-[hsl(var(--muted-foreground))] shrink-0">Purchase ledger</span>
                <select
                  value={scopeId}
                  onChange={e => setScopeId(e.target.value)}
                  className="h-9 sm:h-8 flex-1 sm:min-w-[160px] rounded-md border bg-[hsl(var(--background))] px-2 text-xs"
                >
                  {allowedScopes.map(id => (
                    <option key={id} value={id}>
                      {purchaseScopeLabel(id, allScopes)} ({id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!hasPurchaseAccess ? (
            <div className="p-4 sm:p-6">
              <div className="rounded-lg border border-dashed px-4 sm:px-6 py-10 text-center">
                <FolderLock className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                <p className="text-sm font-medium">No purchase ledgers assigned</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Ask admin to assign at least one purchase ledger (Main Office, Attock, Wah Cantt, etc.).
                </p>
              </div>
            </div>
          ) : tab === "ledger" ? (
            <div className="p-4 sm:p-6 pt-4">
              <PurchaseLedgerManager purchaseScopeId={scopeId || "P1"} />
            </div>
          ) : tab === "imports" ? (
            <ImportedPurchasesTab purchaseScopeId={scopeId || "P1"} />
          ) : tab === "advances" ? (
            <AdvanceAccountsTab purchaseScopeId={scopeId || "P1"} />
          ) : tab === "projects" ? (
            <ClientProjectsTab purchaseScopeId={scopeId || "P1"} />
          ) : (
            <SuppliersTab purchaseScopeId={scopeId || "P1"} />
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
