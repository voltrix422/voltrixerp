"use client"

import { useEffect, useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { EmployeeCashRequests } from "@/components/finance/employee-cash-requests"
import { isInvestorUser } from "@/lib/auth"

export default function FinanceCashRequestsPage() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<{
    id: string
    name: string
    email: string
    department?: string
  } | null>(null)

  useEffect(() => {
    if (!user?.email && !user?.id) return
    const q = new URLSearchParams()
    if (user.email) q.set("email", user.email)
    if (user.id) q.set("userId", user.id)
    fetch(`/api/hrm/staff/by-email?${q.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.id) setStaff(data)
      })
      .catch(() => {})
  }, [user?.email, user?.id])

  if (!user || isInvestorUser(user.role)) return null

  return (
    <>
      <Topbar title="Request cash" description="Ask admin for cash at least one day before you need it" />
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-4 md:p-6 max-w-3xl">
          <EmployeeCashRequests
            staffId={staff?.id}
            userId={user.id}
            requesterName={staff?.name || user.name}
            requesterEmail={staff?.email || user.email}
            department={staff?.department}
            canRequest
          />
        </div>
      </div>
    </>
  )
}
