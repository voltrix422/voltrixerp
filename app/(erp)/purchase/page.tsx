"use client"
import { useEffect, useMemo, useState } from "react"
import { ModuleGuard } from "@/components/layout/module-guard"
import { Topbar } from "@/components/layout/topbar"
import { PurchaseLedgerManager } from "@/components/purchase/purchase-ledger-manager"
import { SuppliersTab } from "@/components/purchase/suppliers-tab"
import { BookOpen, Users, FolderLock } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { normalizePurchaseScopes, roleHasAllModules } from "@/lib/auth"

export default function PurchasePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"ledger" | "suppliers">("ledger")
  const allowedScopes = useMemo(() => {
    if (roleHasAllModules(user?.role)) return []
    return normalizePurchaseScopes(user?.purchaseScopes)
  }, [user?.purchaseScopes, user?.role])
  const isAdminLike = roleHasAllModules(user?.role)
  const [scopeId, setScopeId] = useState<string>((normalizePurchaseScopes(user?.purchaseScopes)[0] || "P1"))
  const hasPurchaseAccess = isAdminLike || allowedScopes.length > 0
  useEffect(() => {
    if (!isAdminLike && allowedScopes.length > 0 && !allowedScopes.includes(scopeId)) {
      setScopeId(allowedScopes[0])
    }
  }, [allowedScopes, isAdminLike, scopeId])

  const tabs = [
    { key: "ledger" as const, label: "Purchase Ledger", icon: BookOpen },
    { key: "suppliers" as const, label: "Suppliers", icon: Users },
  ]

  return (
    <ModuleGuard module="purchase">
      <Topbar title="Purchase" description="Purchase ledger, suppliers, and payment tracking" />
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto w-full">
          <div className="px-6 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg border bg-[hsl(var(--muted))]/20 p-1">
                {tabs.map(t => {
                  const Icon = t.icon
                  const active = tab === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
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
              <div className="inline-flex items-center gap-2">
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Purchase ID</span>
                <input
                  value={scopeId}
                  onChange={e => setScopeId(e.target.value.toUpperCase().trim())}
                  list={allowedScopes.length > 0 ? "purchase-scopes" : undefined}
                  className="h-8 w-24 rounded-md border bg-[hsl(var(--background))] px-2 text-xs"
                />
                {allowedScopes.length > 0 && (
                  <datalist id="purchase-scopes">
                    {allowedScopes.map(scope => <option key={scope} value={scope} />)}
                  </datalist>
                )}
              </div>
            </div>
          </div>

          {!hasPurchaseAccess ? (
            <div className="p-6">
              <div className="rounded-lg border border-dashed px-6 py-10 text-center">
                <FolderLock className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                <p className="text-sm font-medium">No Purchase IDs assigned</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Ask admin to assign at least one Purchase ID (P1, P2, etc.).</p>
              </div>
            </div>
          ) : tab === "ledger" ? (
            <div className="p-6 pt-4">
              <PurchaseLedgerManager purchaseScopeId={scopeId || "P1"} />
            </div>
          ) : (
            <SuppliersTab purchaseScopeId={scopeId || "P1"} />
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
