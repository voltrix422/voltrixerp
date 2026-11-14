"use client"

import { Topbar } from "@/components/layout/topbar"
import { TodosDashboard } from "@/components/todos/todos-dashboard"
import { useAuth } from "@/components/auth-provider"

function todoGreeting(name: string) {
  const first = (name || "").trim().split(/\s+/)[0] || "there"
  const pretty = first.charAt(0).toUpperCase() + first.slice(1)
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, ${pretty}`
  if (hour < 17) return `Good afternoon, ${pretty}`
  return `Good evening, ${pretty}`
}

function todoDateLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

export default function TodosPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <Topbar title={todoGreeting(user.name)} description={todoDateLabel()} />
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-4 max-w-[1400px] mx-auto w-full">
          <TodosDashboard />
        </div>
      </div>
    </>
  )
}
