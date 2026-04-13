"use client"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { DocsManager } from "@/components/docs/docs-manager"
import { useAuth } from "@/components/auth-provider"

export default function DocsPage() {
  const { user } = useAuth()

  return (
    <ModuleGuard module="docs">
      <Topbar title="Documentation" description="Manage company documents and files" />
      <div className="flex-1 overflow-auto p-6">
        <DocsManager currentUser={user?.email || "Unknown"} />
      </div>
    </ModuleGuard>
  )
}
