"use client"
import { useEffect, useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { TicketsManager } from "@/components/tickets/tickets-manager"
import { LeadsManager } from "@/components/crm/leads-manager"

export default function TicketsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"tickets" | "leads">("tickets")

  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("crm-lead-detail-id")) {
      setTab("leads")
    }
  }, [])

  if (!user) return null

  return (
    <>
      <Topbar title="Tickets" description="Manage support tickets and CRM leads" />
      <div className="flex-1 overflow-auto bg-[hsl(var(--background))]">
        <div className="p-4 max-w-7xl">
          <div className="flex items-center gap-1 border-b mb-4 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setTab("tickets")}
              className={`px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
                tab === "tickets"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Support Tickets
              {tab === "tickets" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("leads")}
              className={`px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
                tab === "leads"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Leads
              {tab === "leads" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          </div>

          {tab === "tickets" && <TicketsManager />}
          {tab === "leads" && (
            <LeadsManager
              currentUser={user.name || "Unknown"}
              currentUserId={user.id}
              userRole={user.role}
            />
          )}
        </div>
      </div>
    </>
  )
}
