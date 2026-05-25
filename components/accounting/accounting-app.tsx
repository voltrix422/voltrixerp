"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ACCOUNTING_MENU, VIEW_TITLES, type AcctView } from "@/components/accounting/menu"
import { AccountingViews } from "@/components/accounting/accounting-views"

export function AccountingApp() {
  const [view, setView] = useState<AcctView>("dashboard")
  const [refreshKey, setRefreshKey] = useState(0)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[520px] -mx-2 md:mx-0 rounded-xl border overflow-hidden bg-[hsl(var(--card))]">
      {/* Odoo-style app menu */}
      <aside className="w-[220px] shrink-0 border-r bg-[hsl(var(--background))] overflow-y-auto">
        <div className="p-3 border-b">
          <p className="text-xs font-bold tracking-wide text-[#1faca6]">ACCOUNTING</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">Full double-entry module</p>
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

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold">{VIEW_TITLES[view]}</h2>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Odoo Accounting · Independent ledger · PKR
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setRefreshKey(k => k + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <AccountingViews view={view} refreshKey={refreshKey} />
        </div>
      </main>
    </div>
  )
}
