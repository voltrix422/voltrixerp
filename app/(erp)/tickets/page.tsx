"use client"
import { useEffect, useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { TicketsManager } from "@/components/tickets/tickets-manager"
import { AfterSaleItemPanel } from "@/components/tickets/after-sale-item-panel"
import { LeadsManager } from "@/components/crm/leads-manager"

export default function TicketsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"cases" | "items" | "leads">("cases")
  const [ticketOptions, setTicketOptions] = useState<
    Array<{ id: string; ticketNumber: string; customerName: string; customerPhone?: string | null }>
  >([])

  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("crm-lead-detail-id")) {
      setTab("leads")
    }
  }, [])

  useEffect(() => {
    async function loadTickets() {
      try {
        const res = await fetch("/api/db/tickets")
        const data = await res.json()
        if (!Array.isArray(data)) return
        setTicketOptions(
          data.map((t: Record<string, unknown>) => ({
            id: String(t.id || ""),
            ticketNumber: String(t.ticketNumber || ""),
            customerName: String(t.customerName || ""),
            customerPhone: t.customerPhone ? String(t.customerPhone) : null,
          })),
        )
      } catch {
        // ignore
      }
    }
    void loadTickets()
  }, [tab])

  if (!user) return null

  const tabs: Array<{ id: typeof tab; label: string }> = [
    { id: "cases", label: "Cases" },
    { id: "items", label: "Item In / Out" },
    { id: "leads", label: "Leads" },
  ]

  return (
    <>
      <Topbar title="After Sale" description="Service cases, battery custody, and CRM leads" />
      <div className="flex-1 overflow-auto bg-[hsl(var(--background))]">
        <div className="p-4 max-w-7xl mx-auto">
          <div className="mb-5 rounded-2xl border border-[hsl(var(--border))] bg-gradient-to-br from-[#1a9f9a]/10 via-[hsl(var(--card))] to-[hsl(var(--card))] px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1a9f9a]">
              Voltrix service desk
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
              After Sale
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[hsl(var(--muted-foreground))] max-w-xl">
              Open cases for customer issues, log batteries that come in for service, and release them when work is done.
            </p>
          </div>

          <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-4 overflow-x-auto scrollbar-none">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-2.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
                  tab === t.id
                    ? "text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {t.label}
                {tab === t.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
                )}
              </button>
            ))}
          </div>

          {tab === "cases" && <TicketsManager />}
          {tab === "items" && (
            <AfterSaleItemPanel
              actorName={user.name || user.email || "After Sale"}
              tickets={ticketOptions}
            />
          )}
          {tab === "leads" && (
            <LeadsManager
              currentUser={user.name || user.email || "Staff"}
              currentUserId={user.id}
              userRole={user.role}
            />
          )}
        </div>
      </div>
    </>
  )
}
