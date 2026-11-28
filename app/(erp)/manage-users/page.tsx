"use client"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { UsersManager } from "@/components/layout/users-panel"

export default function ManageUsersPage() {
  return (
    <>
      <Topbar
        title="Manage Users"
        description="Filter by portal · staff, investors, installments, Money to China"
      />
      <ModuleGuard module="users">
        <UsersManager />
      </ModuleGuard>
    </>
  )
}
