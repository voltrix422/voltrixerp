"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { computeWeightedScore, fetchSettlements, fetchStaffKpis, fetchStaffProfile } from "@/lib/hrm-kpis"
import { StaffKpiSection } from "@/components/hrm/staff-kpi-section"

export function MyKpiPortal() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<{ id: string; name: string; email: string } | null>(null)
  const [kpiCount, setKpiCount] = useState(0)
  const [currentStatus, setCurrentStatus] = useState("draft")
  const [currentScore, setCurrentScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!user?.email && !user?.id) {
      setLoading(false)
      return
    }
    fetchStaffProfile({ email: user?.email, userId: user?.id })
      .then(async (s) => {
        setStaff(s)
        setNotFound(!s)
        if (!s) return
        const [kpis, settlements] = await Promise.all([
          fetchStaffKpis(s.id),
          fetchSettlements({ staffId: s.id }),
        ])
        const active = kpis.filter(k => k.active)
        setKpiCount(active.length)
        const latest = settlements[0]
        if (latest) {
          setCurrentStatus(latest.status)
          setCurrentScore(latest.weightedScore ?? computeWeightedScore(latest.entries))
        } else {
          setCurrentStatus("draft")
          setCurrentScore(0)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [user?.email, user?.id])

  const statusLabel = useMemo(() => {
    if (currentStatus === "approved") return "Approved"
    if (currentStatus === "submitted") return "Waiting approval"
    if (currentStatus === "rejected") return "Needs revision"
    return "Draft"
  }, [currentStatus])

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
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">My KPI Dashboard — {staff.name}</h2>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Update your actuals and send to admin for approval. Once approved, your KPI progress is updated on your profile.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Assigned KPIs</p>
          <p className="text-xl font-bold tabular-nums">{kpiCount}</p>
        </div>
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Current status</p>
          <p className="text-xl font-bold">{statusLabel}</p>
        </div>
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Latest score</p>
          <p className="text-xl font-bold tabular-nums">{currentScore}%</p>
        </div>
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
