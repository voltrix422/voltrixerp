"use client"

import { Topbar } from "@/components/layout/topbar"
import { TodosDashboard } from "@/components/todos/todos-dashboard"
import { useAuth } from "@/components/auth-provider"

export default function TodosPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <Topbar
        title="To-do"
        description="Daily, weekly & monthly tasks · updates with attachments"
      />
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 max-w-7xl">
          <TodosDashboard />
        </div>
      </div>
    </>
  )
}
