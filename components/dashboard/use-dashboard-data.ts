"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchJson } from "@/lib/fetch-json"

export type DashboardApprovalCounts = {
  crmOrders: number
  purchaseOrders: number
  transfers: number
  pettyCash: number
  total: number
}

const EMPTY: DashboardApprovalCounts = {
  crmOrders: 0,
  purchaseOrders: 0,
  transfers: 0,
  pettyCash: 0,
  total: 0,
}

export function useDashboardApprovalCounts(enabled = true) {
  const [counts, setCounts] = useState<DashboardApprovalCounts>(EMPTY)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<DashboardApprovalCounts>("/api/dashboard/approval-counts", {
        timeoutMs: 15_000,
      })
      setCounts(data)
    } catch {
      /* keep last known counts */
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [enabled, refresh])

  return counts
}

export type DashboardOverviewData = {
  stats: {
    staff: number
    clients: number
    products: number
    quotations: number
    orders: number
    inventoryItems: number
    financeTotal: number
    totalPOValue: number
    deliveredValue: number
    deliveredCount: number
  }
  charts: {
    deliveredTrend: Array<{ day: string; amount: number; orderIds: string[] }>
    inventoryTrend: Array<{ day: string; quantity: number; names: string[] }>
    ticketTrend: Array<{ day: string; opened: number; closed: number }>
    pettyCashByEmployee: Array<{ name: string; amount: number; role: string }>
    deliveredTotal: number
  }
}

export function useDashboardOverview(days: 7 | 14 | 30, enabled = true) {
  const [data, setData] = useState<DashboardOverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return
    let mounted = true
    setLoading(true)

    fetchJson<DashboardOverviewData>(`/api/dashboard/overview?days=${days}`, { timeoutMs: 25_000 })
      .then((result) => {
        if (mounted) setData(result)
      })
      .catch((err) => {
        console.error("Dashboard overview load failed:", err)
        if (mounted) setData(null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [days, enabled])

  return { data, loading }
}
