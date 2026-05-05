"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { ClientsList } from "@/components/crm/clients-list"
import { OrdersList } from "@/components/crm/orders-list"
import { useAuth } from "@/components/auth-provider"
import { FileText } from "lucide-react"

export default function CRMPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"quotations" | "orders" | "clients">("quotations")
  
  return (
    <ModuleGuard module="crm">
      <Topbar title="Customer relationship management" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b mb-4">
            <button
              onClick={() => setTab("quotations")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                tab === "quotations"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Quotations
              {tab === "quotations" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
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
          {tab === "quotations" && (
            <div className="text-center py-20">
              <FileText className="h-16 w-16 text-[hsl(var(--muted-foreground))] opacity-30 mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">Quotations Feature</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md mx-auto">
                Create professional quotations for your clients with product selection from inventory,
                custom pricing, tax calculations, and PDF generation.
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-4">
                Run <code className="px-2 py-1 bg-[hsl(var(--muted))] rounded">npx prisma db push</code> to create the database table.
              </p>
            </div>
          )}
          {tab === "clients" && <ClientsList currentUser={user?.name || "Unknown"} />}
          {tab === "orders" && <OrdersList currentUser={user?.name || "Unknown"} />}
        </div>
      </div>
    </ModuleGuard>
  )
}
