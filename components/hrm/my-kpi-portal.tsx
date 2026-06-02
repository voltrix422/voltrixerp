"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  computeWeightedScore,
  createStaffProfileFromUser,
  fetchSettlements,
  fetchStaffKpis,
  fetchStaffProfile,
} from "@/lib/hrm-kpis"
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
        let resolved = s
        if (!resolved && user?.id) {
          const created = await createStaffProfileFromUser(user.id)
          resolved = await fetchStaffProfile({ userId: user.id })
          if (!resolved && created?.id) {
            resolved = { id: created.id, name: user.name || user.email || "User", email: user.email || "" }
          }
        }
        setStaff(resolved)
        setNotFound(!resolved)
        if (!resolved) return
        const [kpis, settlements] = await Promise.all([
          fetchStaffKpis(resolved.id),
          fetchSettlements({ staffId: resolved.id }),
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

  const statusMeta = useMemo(() => {
    if (currentStatus === "approved") return { label: "Approved", tone: "text-emerald-600" }
    if (currentStatus === "submitted") return { label: "Pending", tone: "text-blue-600" }
    if (currentStatus === "rejected") return { label: "Revise", tone: "text-red-600" }
    return { label: "Draft", tone: "text-amber-600" }
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
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Could not load your KPI dashboard</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
          Please contact admin if this continues for login (
          <span className="font-medium">{user?.email}</span>).
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">My KPI Dashboard</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{staff.name}</p>
        </div>
        <p className={`text-xs font-semibold ${statusMeta.tone}`}>{statusMeta.label}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Assigned</p>
          <p className="text-xl font-bold tabular-nums">{kpiCount}</p>
        </div>
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Status</p>
          <p className={`text-xl font-bold ${statusMeta.tone}`}>{statusMeta.label}</p>
        </div>
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Score</p>
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
