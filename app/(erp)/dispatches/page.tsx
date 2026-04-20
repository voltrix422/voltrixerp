"use client"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import DispatchesManager, { DispatchesManagerRef } from "@/components/dispatches/dispatches-manager"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useState, useRef } from "react"

export default function DispatchesPage() {
  const [showForm, setShowForm] = useState(false)
  const managerRef = useRef<DispatchesManagerRef>(null)

  return (
    <ModuleGuard module="dispatches">
      <Topbar 
        title="Dispatches" 
        description="Manage delivery dispatches and tracking"
        action={
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-[#1faca6] hover:bg-[#17857f] text-white" onClick={() => managerRef.current?.openNewForm()}>
            <Plus className="h-3.5 w-3.5" /> New Dispatch
          </Button>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          <DispatchesManager ref={managerRef} showForm={showForm} setShowForm={setShowForm} />
        </div>
      </div>
    </ModuleGuard>
  )
}
