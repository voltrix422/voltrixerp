"use client"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { TicketsManager } from "@/components/tickets/tickets-manager"

export default function TicketsPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <Topbar title="Tickets" description="Manage support tickets" />
      <div className="flex-1 overflow-auto bg-[hsl(var(--background))]">
        <div className="p-4 max-w-7xl">
          <TicketsManager />
        </div>
      </div>
    </>
  )
}
