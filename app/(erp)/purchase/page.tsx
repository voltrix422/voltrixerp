"use client"
import { useState, useEffect } from "react"
import { ModuleGuard } from "@/components/layout/module-guard"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { POsTab } from "@/components/purchase/pos-tab"
import { SuppliersTab } from "@/components/purchase/suppliers-tab"

export default function PurchasePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"pos" | "suppliers">("pos")

  return (
    <ModuleGuard module="purchase">
      <Topbar title="Purchase" description="Manage purchase orders and suppliers" />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex gap-0 border-b px-6 bg-[hsl(var(--background))]">
          {(["pos", "suppliers"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? "border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {t === "pos" ? "Purchase Orders" : "Suppliers"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {tab === "pos" ? <POsTab user={user} /> : <SuppliersTab />}
        </div>
      </div>
    </ModuleGuard>
  )
}
