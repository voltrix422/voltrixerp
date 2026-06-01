"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { fetchStaffProfile } from "@/lib/hrm-kpis"
import { StaffKpiSection } from "@/components/hrm/staff-kpi-section"

export function MyKpiPortal() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<{ id: string; name: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!user?.email && !user?.id) {
      setLoading(false)
      return
    }
    fetchStaffProfile({ email: user?.email, userId: user?.id })
      .then(s => {
        setStaff(s)
        setNotFound(!s)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [user?.email, user?.id])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  if (notFound || !staff) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center max-w-lg mx-auto">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">No staff profile linked</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
          Ask HR to add you in Staff Management with the same email as your login (
          <span className="font-medium">{user?.email}</span>).
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">My KPIs — {staff.name}</h2>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Update your actuals and send to admin for approval. Once approved, your KPI progress is updated on your profile.
        </p>
      </div>
      <StaffKpiSection
        staffId={staff.id}
        staffName={staff.name}
        isAdmin={false}
        actorName={user?.name ?? staff.name}
        canSettle
      />
    </div>
  )
}
