"use client"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { UsersManager } from "@/components/layout/users-panel"

export default function ManageUsersPage() {
  return (
    <>
      <Topbar
        title="Manage Users"
        description="Create accounts, set passwords, and control page access"
      />
      <ModuleGuard module="users">
        <UsersManager />
      </ModuleGuard>
    </>
  )
}
