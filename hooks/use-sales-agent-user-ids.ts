"use client"

import { useEffect, useState } from "react"
import { getUsers } from "@/lib/auth"

export function useSalesAgentUserIds() {
  const [salesAgentUserIds, setSalesAgentUserIds] = useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    let cancelled = false
    getUsers()
      .then(users => {
        if (cancelled) return
        setSalesAgentUserIds(
          new Set(users.filter(u => u.role === "sales_agent").map(u => u.id))
        )
      })
      .catch(() => {
        if (!cancelled) setSalesAgentUserIds(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [])

  return salesAgentUserIds
}
