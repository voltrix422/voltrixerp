"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { HrmManager } from "@/components/hrm/hrm-manager"

export default function HrmPage() {
  const [tab, setTab] = useState<"staff" | "performance">("staff")
  
  return (
    <ModuleGuard module="hrm">
      <Topbar title="Human Resource Management" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b mb-4">
            <button
              onClick={() => setTab("staff")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                tab === "staff"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Staff Management
              {tab === "staff" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            <button
              onClick={() => setTab("performance")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                tab === "performance"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Performance
              {tab === "performance" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          {tab === "staff" && <HrmManager />}
          {tab === "performance" && (
            <div className="text-center py-16 border-2 border-dashed border-[hsl(var(--border))]/30 rounded-xl bg-[hsl(var(--card))]">
              <div className="h-12 w-12 rounded-full bg-[hsl(var(--muted))]/30 flex items-center justify-center mx-auto mb-3">
                <svg className="h-6 w-6 text-[hsl(var(--muted-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Performance Analytics</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Track staff performance, attendance, and metrics</p>
            </div>
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
