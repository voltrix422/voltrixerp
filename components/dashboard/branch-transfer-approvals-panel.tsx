"use client"

import { useEffect, useState } from "react"
import { BranchTransferApprovals } from "@/components/branches/branch-transfer-approvals"
import { fetchBranchTransferRequests, getBranches, type Branch } from "@/lib/branches"
import { useAuth } from "@/components/auth-provider"

export function DashboardBranchTransferApprovals() {
  const { user } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])

  useEffect(() => {
    getBranches().then(setBranches)
  }, [])

  return (
    <BranchTransferApprovals
      branches={branches}
      currentUser={user?.name || "Super admin"}
      variant="embedded"
    />
  )
}

export function useBranchTransferPendingCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const rows = await fetchBranchTransferRequests({ status: "pending" })
        setCount(rows.length)
      } catch {
        setCount(0)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  return count
}
