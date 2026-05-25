"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, RefreshCw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ACCOUNTING_MENU, VIEW_TITLES, type AcctView } from "@/components/accounting/menu"
import { AccountingViews } from "@/components/accounting/accounting-views"
import { AccountingErrorBoundary } from "@/components/accounting/accounting-error-boundary"

type ModuleStatus = {
  seeded: boolean
  needsMigration: boolean
  error: string
  hint: string
}

export function AccountingApp() {
  const [view, setView] = useState<AcctView>("dashboard")
  const [refreshKey, setRefreshKey] = useState(0)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<ModuleStatus>({
    seeded: false,
    needsMigration: false,
    error: "",
    hint: "",
  })

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/accounting/dashboard")
      const text = await res.text()
      let data: Record<string, unknown> = {}
      try {
        data = JSON.parse(text) as Record<string, unknown>
      } catch {
        setStatus({
          seeded: false,
          needsMigration: true,
          error: "Server returned invalid response. Rebuild and run database migration.",
          hint: "npx prisma migrate deploy",
        })
        return
      }
      if (!res.ok) {
        setStatus({
          seeded: false,
          needsMigration: Boolean(data.needsMigration),
          error: String(data.error ?? "API error"),
          hint: String(data.hint ?? ""),
        })
        return
      }
      setStatus({
        seeded: Boolean(data.seeded),
        needsMigration: false,
        error: "",
        hint: "",
      })
    } catch (e) {
      setStatus({
        seeded: false,
        needsMigration: false,
        error: (e as Error).message,
        hint: "",
      })
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus, refreshKey])

  async function handleInitialize() {
    const res = await fetch("/api/accounting/init", { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      setStatus(s => ({
        ...s,
        error: data.error ?? "Initialize failed",
        needsMigration: Boolean(data.needsMigration),
        hint: data.hint ?? "",
      }))
      return
    }
    setRefreshKey(k => k + 1)
    checkStatus()
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[520px] -mx-2 md:mx-0 rounded-xl border overflow-hidden bg-[hsl(var(--card))]">
      <aside className="w-[220px] shrink-0 border-r bg-[hsl(var(--background))] overflow-y-auto">
        <div className="p-3 border-b">
          <p className="text-xs font-bold tracking-wide text-[#1faca6]">ACCOUNTING</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">Double-entry · PKR</p>
        </div>
        <nav className="p-2 space-y-1">
          {ACCOUNTING_MENU.map(group => {
            const isCollapsed = collapsed[group.id] ?? false
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => setCollapsed(c => ({ ...c, [group.id]: !isCollapsed }))}
                  className="flex w-full items-center gap-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {group.label}
                </button>
                {!isCollapsed &&
                  group.items.map(item => {
                    const Icon = item.icon
                    const active = view === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setView(item.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                          active
                            ? "bg-[#1faca6]/15 text-[#1faca6]"
                            : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-left">{item.label}</span>
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 gap-2">
          <div>
            <h2 className="text-base font-semibold">{VIEW_TITLES[view]}</h2>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Odoo-style accounting module</p>
          </div>
          <div className="flex gap-2">
            {!status.seeded && !status.needsMigration && (
              <Button size="sm" className="h-8 bg-[#1faca6] hover:bg-[#1faca6]/90" onClick={handleInitialize}>
                Initialize
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {(status.needsMigration || status.error) && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-500/10 px-3 py-2 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-amber-900">{status.needsMigration ? "Database migration required" : "Setup issue"}</p>
              <p className="text-amber-800 mt-0.5">{status.error}</p>
              {status.hint && <p className="text-amber-700 mt-1 font-mono">{status.hint}</p>}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          <AccountingErrorBoundary onReset={() => setRefreshKey(k => k + 1)} key={`${view}-${refreshKey}`}>
            <AccountingViews
              view={view}
              refreshKey={refreshKey}
              moduleSeeded={status.seeded}
              onInitialize={handleInitialize}
            />
          </AccountingErrorBoundary>
        </div>
      </main>
    </div>
  )
}
