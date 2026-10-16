"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { CashRequestForm } from "@/components/finance/cash-request-form"
import { CashRequestHistory } from "@/components/finance/cash-request-history"
import { fetchCashRequests, type CashRequest } from "@/lib/finance-cash-requests"

export function EmployeeCashRequests({
  staffId,
  userId,
  requesterName,
  requesterEmail,
  department,
  canRequest,
}: {
  staffId?: string | null
  userId: string
  requesterName: string
  requesterEmail?: string
  department?: string
  canRequest: boolean
}) {
  const [rows, setRows] = useState<CashRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchCashRequests(staffId ? { staffId } : { userId })
      setRows(list)
    } finally {
      setLoading(false)
    }
  }, [staffId, userId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      {canRequest && (
        <CashRequestForm
          staffId={staffId}
          userId={userId}
          requesterName={requesterName}
          requesterEmail={requesterEmail}
          department={department}
          onCreated={(row) => setRows((prev) => [row, ...prev])}
        />
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading requests…
        </div>
      ) : (
        <CashRequestHistory rows={rows} />
      )}
    </div>
  )
}
