"use client"

import { Topbar } from "@/components/layout/topbar"
import { TodosDashboard } from "@/components/todos/todos-dashboard"
import { useAuth } from "@/components/auth-provider"

export default function TodosPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <Topbar title="To-do" description="Reminders" />
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-4 max-w-[1400px] mx-auto w-full">
          <TodosDashboard />
        </div>
      </div>
    </>
  )
}
