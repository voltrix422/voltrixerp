"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { ClientsList } from "@/components/crm/clients-list"
import { OrdersList } from "@/components/crm/orders-list"
import { useAuth } from "@/components/auth-provider"

export default function CRMPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"clients" | "orders">("orders")
  
  return (
    <ModuleGuard module="crm">
      <Topbar title="Customer relationship management" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b mb-4">
            <button
              onClick={() => setTab("orders")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                tab === "orders"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Orders
              {tab === "orders" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            <button
              onClick={() => setTab("clients")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                tab === "clients"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Clients
              {tab === "clients" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          {tab === "clients" && <ClientsList currentUser={user?.name || "Unknown"} />}
          {tab === "orders" && <OrdersList currentUser={user?.name || "Unknown"} />}
        </div>
      </div>
    </ModuleGuard>
  )
}
