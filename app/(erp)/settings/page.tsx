"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { AccountSettings } from "@/components/settings/account-settings"
import { ActiveVisitorsPanel } from "@/components/settings/active-visitors-panel"
import { useAuth } from "@/components/auth-provider"
import { isErpAdmin, isViewOnlyUser } from "@/lib/auth"
import { TicketsManager } from "@/components/tickets/tickets-manager"

export default function SettingsPage() {
  const { user } = useAuth()
  const isAdmin = isErpAdmin(user?.role)
  const isViewOnly = isViewOnlyUser(user?.role)
  const [tab, setTab] = useState<"account" | "visitors" | "tickets">("account")

  return (
    <>
      <Topbar title="Settings" description="Manage your account, visitors, and ERP support tickets" />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex gap-0 border-b mb-6">
            <button
              onClick={() => setTab("account")}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                tab === "account" ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Account Settings
              {tab === "account" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
            </button>
            {!isViewOnly && (
              <button
                onClick={() => setTab("visitors")}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  tab === "visitors" ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                Active Visitors
                {tab === "visitors" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setTab("tickets")}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  tab === "tickets" ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                ERP Tickets
                {tab === "tickets" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
              </button>
            )}
          </div>

          {tab === "account" && <AccountSettings />}
          {!isViewOnly && tab === "visitors" && (
            <div className="rounded-lg border bg-[hsl(var(--card))]">
              <ActiveVisitorsPanel />
            </div>
          )}
          {isAdmin && tab === "tickets" && <TicketsManager />}
        </div>
      </div>
    </>
  )
}
