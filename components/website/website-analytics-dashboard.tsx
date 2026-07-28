"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Loader2, RefreshCw, Users, Eye, Clock, Activity, TrendingUp, TrendingDown,
  LayoutDashboard, FileText, Sparkles, Radio, Share2, ExternalLink, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDuration, localDateISO, localDaysAgoISO } from "@/lib/website-analytics"

type PageRow = {
  path: string
  label: string
  views: number
  uniqueVisitors: number
  avgDwellMs: number
  totalDwellMs: number
}

type FeatureRow = {
  key: string
  label: string
  hits: number
  uniqueVisitors: number
  avgDwellMs: number
  totalDwellMs: number
}

type AnalyticsPayload = {
  from: string
  to: string
  fromDate?: string
  toDate?: string
  trackingSince?: string | null
  lifetime?: boolean
  summary: {
    uniqueVisitors: number
    sessions: number
    totalViews: number
    avgDwellMs: number
    activeNow: number
    pagesTracked?: number
  }
  activeNow: Array<{
    visitorId: string
    path: string
    label: string
    lastSeenAt: string
    userAgent: string
  }>
  pages?: PageRow[]
  mostVisited: PageRow[]
  leastVisited: PageRow[]
  features: FeatureRow[]
  daily: Array<{ date: string; views: number; uniqueVisitors: number }>
  referrers: Array<{ source: string; views: number }>
  devices?: Array<{ device: string; views: number }>
}

type Section = "overview" | "pages" | "features" | "live" | "sources"
type RangeMode = "today" | "yesterday" | "last2" | "week" | "month" | "days7" | "days30" | "lifetime" | "custom"

const SECTIONS: Array<{ id: Section; label: string; icon: typeof LayoutDashboard; hint: string }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, hint: "Visitors & trends" },
  { id: "pages", label: "Pages", icon: FileText, hint: "Most & least visited" },
  { id: "features", label: "Features", icon: Sparkles, hint: "Time on sections" },
  { id: "live", label: "Live now", icon: Radio, hint: "Active visitors" },
  { id: "sources", label: "Sources", icon: Share2, hint: "Referrers & devices" },
]

function startOfWeekISO(d = new Date()): string {
  const x = new Date(d)
  const day = x.getDay() // 0 Sun
  const diff = day === 0 ? 6 : day - 1 // Monday start
  x.setDate(x.getDate() - diff)
  return localDateISO(x)
}

function startOfMonthISO(d = new Date()): string {
  return localDateISO(new Date(d.getFullYear(), d.getMonth(), 1))
}

function formatUa(ua: string) {
  if (!ua) return "Unknown"
  if (/Mobile|Android|iPhone/i.test(ua)) return "Mobile"
  if (/iPad|Tablet/i.test(ua)) return "Tablet"
  return "Desktop"
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string | number
  hint?: string
  icon: typeof Users
}) {
  return (
    <div className="rounded-xl border bg-[hsl(var(--card))] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold mt-1 tabular-nums tracking-tight">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className="h-9 w-9 rounded-lg bg-[#1faca6]/10 text-[#1faca6] flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function PageTable({
  rows,
  from,
  to,
  empty,
}: {
  rows: PageRow[]
  from: string
  to: string
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">{empty}</p>
  }
  const max = Math.max(...rows.map((r) => r.views), 1)
  return (
    <div className="overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-3 py-2.5">Page</th>
            <th className="text-right font-medium px-3 py-2.5">Views</th>
            <th className="text-right font-medium px-3 py-2.5">People</th>
            <th className="text-right font-medium px-3 py-2.5">Avg time</th>
            <th className="text-right font-medium px-3 py-2.5 w-28" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((p) => (
            <tr key={p.path} className="hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2.5">
                <p className="font-medium">{p.label}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{p.path}</p>
                <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden max-w-[220px]">
                  <div
                    className="h-full rounded-full bg-[#1faca6]"
                    style={{ width: `${Math.max(4, (p.views / max) * 100)}%` }}
                  />
                </div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-medium">{p.views.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{p.uniqueVisitors.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {formatDuration(p.avgDwellMs)}
              </td>
              <td className="px-3 py-2.5 text-right">
                <Link
                  href={`/website/analytics/detail?path=${encodeURIComponent(p.path)}&from=${from}&to=${to}`}
                  className="inline-flex items-center gap-1 text-xs text-[#1faca6] hover:underline"
                >
                  Details <ChevronRight className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function WebsiteAnalyticsDashboard() {
  const [section, setSection] = useState<Section>("overview")
  const [rangeMode, setRangeMode] = useState<RangeMode>("today")
  const [from, setFrom] = useState(() => localDateISO())
  const [to, setTo] = useState(() => localDateISO())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [error, setError] = useState("")
  const [pageSearch, setPageSearch] = useState("")
  const [chartOnlyTraffic, setChartOnlyTraffic] = useState(true)
  const reqIdRef = useRef(0)

  const load = useCallback(async (rangeFrom: string, rangeTo: string, mode: RangeMode) => {
    const reqId = ++reqIdRef.current
    setLoading(true)
    setError("")
    // Clear KPIs immediately so the UI visibly updates on every filter click
    setData(null)
    try {
      const qs =
        mode === "lifetime"
          ? "lifetime=1"
          : `from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`
      const res = await fetch(`/api/db/website-analytics?${qs}`)
      if (!res.ok) throw new Error("Failed to load")
      const json = (await res.json()) as AnalyticsPayload
      if (reqId !== reqIdRef.current) return
      setData(json)
    } catch (e) {
      if (reqId !== reqIdRef.current) return
      setError(e instanceof Error ? e.message : "Failed to load analytics")
      setData(null)
    } finally {
      if (reqId === reqIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(from, to, rangeMode)
    // initial load only — later loads go through applyPreset / applyCustom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => void load(from, to, rangeMode), 30000)
    return () => window.clearInterval(t)
  }, [from, to, rangeMode, load])

  function applyPreset(mode: RangeMode) {
    const today = localDateISO()
    let nextFrom = today
    let nextTo = today
    if (mode === "today") {
      nextFrom = today
      nextTo = today
    } else if (mode === "yesterday") {
      nextFrom = localDaysAgoISO(1)
      nextTo = localDaysAgoISO(1)
    } else if (mode === "last2") {
      nextFrom = localDaysAgoISO(1)
      nextTo = today
    } else if (mode === "week") {
      nextFrom = startOfWeekISO()
      nextTo = today
    } else if (mode === "month") {
      nextFrom = startOfMonthISO()
      nextTo = today
    } else if (mode === "days7") {
      nextFrom = localDaysAgoISO(6)
      nextTo = today
    } else if (mode === "days30") {
      nextFrom = localDaysAgoISO(29)
      nextTo = today
    } else if (mode === "lifetime") {
      nextFrom = "lifetime"
      nextTo = today
    }
    setRangeMode(mode)
    setFrom(nextFrom === "lifetime" ? (data?.trackingSince || today) : nextFrom)
    setTo(nextTo)
    void load(nextFrom === "lifetime" ? "lifetime" : nextFrom, nextTo, mode)
  }

  function applyCustom(nextFrom: string, nextTo: string) {
    setRangeMode("custom")
    setFrom(nextFrom)
    setTo(nextTo)
    void load(nextFrom, nextTo, "custom")
  }

  const maxDaily = useMemo(() => {
    const rows = chartOnlyTraffic
      ? (data?.daily || []).filter((d) => d.views > 0)
      : data?.daily || []
    return Math.max(...rows.map((d) => d.uniqueVisitors), 1)
  }, [data, chartOnlyTraffic])

  const chartDays = useMemo(() => {
    const rows = data?.daily || []
    if (!chartOnlyTraffic) return rows
    const withTraffic = rows.filter((d) => d.views > 0)
    return withTraffic.length > 0 ? withTraffic : rows
  }, [data, chartOnlyTraffic])

  const allPages = data?.pages || data?.mostVisited || []
  const filteredPages = useMemo(() => {
    const q = pageSearch.trim().toLowerCase()
    if (!q) return allPages
    return allPages.filter(
      (p) => p.path.toLowerCase().includes(q) || p.label.toLowerCase().includes(q),
    )
  }, [allPages, pageSearch])

  const presets: Array<{ mode: RangeMode; label: string }> = [
    { mode: "today", label: "Today" },
    { mode: "yesterday", label: "Yesterday" },
    { mode: "last2", label: "Last 2 days" },
    { mode: "week", label: "This week" },
    { mode: "month", label: "This month" },
    { mode: "days7", label: "7 days" },
    { mode: "days30", label: "30 days" },
    { mode: "lifetime", label: "Lifetime" },
  ]

  const rangeLabel =
    rangeMode === "lifetime"
      ? `Lifetime${data?.trackingSince ? ` (since ${data.trackingSince})` : ""}`
      : `${from} → ${to}`

  const daysInRange = data?.daily?.length || 0
  const daysWithTraffic = data?.daily?.filter((d) => d.views > 0).length || 0
  const detailFrom = rangeMode === "lifetime" ? (data?.trackingSince || from) : from
  const detailTo = to

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Analytics section sidebar */}
      <aside className="hidden sm:flex w-[200px] shrink-0 flex-col border-r bg-muted/20">
        <div className="px-3 py-3 border-b">
          <p className="text-xs font-semibold">Analytics</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Public website only</p>
        </div>
        <nav className="p-2 space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            const active = section === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  "w-full flex items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                  active
                    ? "bg-[#1faca6]/12 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", active && "text-[#1faca6]")} />
                <span>
                  <span className="block text-sm font-medium leading-none">{s.label}</span>
                  <span className="block text-[10px] mt-1 opacity-70">{s.hint}</span>
                </span>
              </button>
            )
          })}
        </nav>
        <div className="mt-auto p-3 border-t text-[10px] text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live tracking on
          </p>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            Open website <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 z-10 border-b bg-[hsl(var(--background))]/95 backdrop-blur px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                {SECTIONS.find((s) => s.id === section)?.label}
              </h2>
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{rangeLabel}</span>
                {data ? ` · ${data.summary.activeNow} active now` : ""}
                {loading ? " · updating…" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {/* Mobile section pills */}
              <div className="flex sm:hidden gap-1 w-full overflow-x-auto pb-1">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={cn(
                      "text-[11px] px-2 py-1 rounded-md border shrink-0",
                      section === s.id ? "bg-[#1faca6]/15 border-[#1faca6]/40" : "hover:bg-accent",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {presets.map((p) => (
                <button
                  key={p.mode}
                  type="button"
                  onClick={() => applyPreset(p.mode)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-md border hover:bg-accent cursor-pointer",
                    rangeMode === p.mode && "bg-[#1faca6]/15 border-[#1faca6]/50 font-semibold",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <label className="text-[11px] text-muted-foreground">
                From
                <input
                  type="date"
                  value={from === "lifetime" ? (data?.trackingSince || localDateISO()) : from}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    applyCustom(v, to < v ? v : to)
                  }}
                  className="ml-1 h-8 rounded-md border bg-background px-2 text-xs"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    applyCustom(from > v ? v : from, v)
                  }}
                  className="ml-1 h-8 rounded-md border bg-background px-2 text-xs"
                />
              </label>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void load(from, to, rangeMode)}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-5 max-w-6xl">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading {rangeLabel}…
            </div>
          ) : data ? (
            <>
              {section === "overview" && (
                <>
                  <div className="rounded-lg border border-[#1faca6]/30 bg-[#1faca6]/5 px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
                    <span><span className="text-muted-foreground">Range:</span> <strong>{rangeLabel}</strong></span>
                    <span><span className="text-muted-foreground">Visitors:</span> <strong>{data.summary.uniqueVisitors}</strong></span>
                    <span><span className="text-muted-foreground">Views:</span> <strong>{data.summary.totalViews}</strong></span>
                    <span><span className="text-muted-foreground">Sessions:</span> <strong>{data.summary.sessions}</strong></span>
                    {data.trackingSince && (
                      <span className="text-muted-foreground">Tracking since {data.trackingSince}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <StatCard label="Active now" value={data.summary.activeNow} hint="Last 5 minutes (live)" icon={Activity} />
                    <StatCard label="Unique visitors" value={data.summary.uniqueVisitors} hint={rangeLabel} icon={Users} />
                    <StatCard label="Page views" value={data.summary.totalViews} hint={`${data.summary.sessions} sessions`} icon={Eye} />
                    <StatCard label="Avg. time / page" value={formatDuration(data.summary.avgDwellMs)} hint={rangeLabel} icon={Clock} />
                    <StatCard
                      label="Pages tracked"
                      value={data.summary.pagesTracked ?? allPages.length}
                      hint={`${daysWithTraffic} of ${daysInRange || "—"} days with traffic`}
                      icon={TrendingUp}
                    />
                  </div>

                  <div className="rounded-xl border p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <p className="text-sm font-semibold">Visitors by day</p>
                      <button
                        type="button"
                        onClick={() => setChartOnlyTraffic((v) => !v)}
                        className="text-[11px] px-2 py-1 rounded border hover:bg-accent"
                      >
                        {chartOnlyTraffic ? "Show all days in range" : "Show only days with traffic"}
                      </button>
                    </div>
                    {daysWithTraffic === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-10">
                        No visits in this range yet.
                      </p>
                    ) : (
                      <>
                        {daysWithTraffic < daysInRange && chartOnlyTraffic && (
                          <p className="text-[11px] text-muted-foreground mb-2">
                            Showing {daysWithTraffic} day(s) with traffic
                            {data.trackingSince ? ` (tracking started ${data.trackingSince})` : ""}.
                            Empty earlier days are hidden — toggle above to show full range.
                          </p>
                        )}
                        <div className="flex items-end gap-1.5 h-40">
                          {chartDays.map((d) => (
                            <div key={d.date} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
                              <span className="text-[10px] tabular-nums text-muted-foreground">{d.uniqueVisitors}</span>
                              <div
                                className="w-full rounded-t bg-gradient-to-t from-[#1faca6] to-[#1faca6]/70 min-h-[4px]"
                                style={{ height: `${(d.uniqueVisitors / maxDaily) * 100}%` }}
                                title={`${d.date}: ${d.uniqueVisitors} visitors, ${d.views} views`}
                              />
                              <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                                {d.date.slice(5)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="grid lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4 text-[#1faca6]" />
                          <p className="text-sm font-semibold">Top pages</p>
                        </div>
                        <button type="button" className="text-[11px] text-[#1faca6]" onClick={() => setSection("pages")}>
                          View all
                        </button>
                      </div>
                      <PageTable rows={data.mostVisited.slice(0, 6)} from={detailFrom} to={detailTo} empty="No page data yet" />
                    </div>
                    <div className="rounded-xl border p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-[#1faca6]" />
                          <p className="text-sm font-semibold">Top features</p>
                        </div>
                        <button type="button" className="text-[11px] text-[#1faca6]" onClick={() => setSection("features")}>
                          View all
                        </button>
                      </div>
                      <div className="space-y-2.5">
                        {data.features.slice(0, 6).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">No feature data yet</p>
                        ) : (
                          data.features.slice(0, 6).map((f) => {
                            const max = Math.max(...data.features.slice(0, 6).map((x) => x.totalDwellMs), 1)
                            return (
                              <div key={f.key} className="space-y-1">
                                <div className="flex justify-between text-xs gap-2">
                                  <span className="font-medium">{f.label}</span>
                                  <span className="text-muted-foreground tabular-nums">
                                    {formatDuration(f.totalDwellMs)} · {f.uniqueVisitors} people
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#1faca6]"
                                    style={{ width: `${Math.max(4, (f.totalDwellMs / max) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {section === "pages" && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      Click <span className="font-medium text-foreground">Details</span> for a full page report.
                    </p>
                    <input
                      value={pageSearch}
                      onChange={(e) => setPageSearch(e.target.value)}
                      placeholder="Search pages…"
                      className="h-8 w-full sm:w-56 rounded-md border bg-background px-2 text-xs"
                    />
                  </div>
                  <div className="grid lg:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp className="h-4 w-4 text-[#1faca6]" />
                        <p className="text-sm font-semibold">Most visited</p>
                      </div>
                      <PageTable
                        rows={[...filteredPages].sort((a, b) => b.views - a.views)}
                        from={detailFrom}
                        to={detailTo}
                        empty="No matching pages"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingDown className="h-4 w-4 text-amber-600" />
                        <p className="text-sm font-semibold">Least visited</p>
                      </div>
                      <PageTable
                        rows={[...filteredPages].sort((a, b) => a.views - b.views)}
                        from={detailFrom}
                        to={detailTo}
                        empty="No matching pages"
                      />
                    </div>
                  </div>
                </>
              )}

              {section === "features" && (
                <div className="rounded-xl border p-4 shadow-sm space-y-4">
                  <div>
                    <p className="text-sm font-semibold">Feature engagement</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      How long visitors stay on homepage sections and marked features.
                    </p>
                  </div>
                  {data.features.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      No feature engagement yet — browse the homepage sections to collect data.
                    </p>
                  ) : (
                    <div className="overflow-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="text-left font-medium px-3 py-2.5">Feature</th>
                            <th className="text-right font-medium px-3 py-2.5">Hits</th>
                            <th className="text-right font-medium px-3 py-2.5">People</th>
                            <th className="text-right font-medium px-3 py-2.5">Avg stay</th>
                            <th className="text-right font-medium px-3 py-2.5">Total time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {data.features.map((f) => {
                            const max = Math.max(...data.features.map((x) => x.totalDwellMs), 1)
                            return (
                              <tr key={f.key} className="hover:bg-muted/30">
                                <td className="px-3 py-2.5">
                                  <p className="font-medium">{f.label}</p>
                                  <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden max-w-[240px]">
                                    <div
                                      className="h-full rounded-full bg-[#1faca6]"
                                      style={{ width: `${Math.max(4, (f.totalDwellMs / max) * 100)}%` }}
                                    />
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{f.hits}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{f.uniqueVisitors}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                  {formatDuration(f.avgDwellMs)}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                                  {formatDuration(f.totalDwellMs)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {section === "live" && (
                <div className="rounded-xl border p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-sm font-semibold">
                      {data.activeNow.length} active visitor{data.activeNow.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-muted-foreground">Updated every 30s</p>
                  </div>
                  {data.activeNow.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">Nobody on the website right now</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {data.activeNow.map((v) => (
                        <Link
                          key={v.visitorId}
                          href={`/website/analytics/detail?path=${encodeURIComponent(v.path)}&from=${detailFrom}&to=${detailTo}`}
                          className="rounded-lg border px-3 py-3 hover:border-[#1faca6]/50 hover:bg-[#1faca6]/5 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{v.label}</p>
                              <p className="text-[11px] text-muted-foreground font-mono truncate">{v.path}</p>
                            </div>
                            <div className="text-right shrink-0 text-[11px] text-muted-foreground">
                              <p>{formatUa(v.userAgent)}</p>
                              <p>{new Date(v.lastSeenAt).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {section === "sources" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Shows Instagram, Facebook, Google, Email, WhatsApp, Direct, and more.
                    For ads / posts, use links like{" "}
                    <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
                      ?utm_source=instagram&utm_medium=social
                    </code>
                    .
                  </p>
                  <div className="grid lg:grid-cols-2 gap-4">
                  <div className="rounded-xl border p-4 shadow-sm">
                    <p className="text-sm font-semibold mb-3">Traffic sources</p>
                    {data.referrers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-10">No traffic yet</p>
                    ) : (
                      <div className="space-y-2.5">
                        {data.referrers.map((r) => {
                          const max = Math.max(...data.referrers.map((x) => x.views), 1)
                          const total = data.summary.totalViews || 1
                          const pct = Math.round((r.views / total) * 100)
                          return (
                            <div key={r.source} className="space-y-1">
                              <div className="flex justify-between text-xs gap-2">
                                <span className="font-medium">{r.source}</span>
                                <span className="tabular-nums text-muted-foreground shrink-0">
                                  {r.views} views · {pct}%
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#1faca6]"
                                  style={{ width: `${Math.max(4, (r.views / max) * 100)}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border p-4 shadow-sm">
                    <p className="text-sm font-semibold mb-3">Devices</p>
                    {(data.devices || []).every((d) => d.views === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-10">No device data yet</p>
                    ) : (
                      <div className="space-y-3">
                        {(data.devices || []).map((d) => {
                          const total = (data.devices || []).reduce((s, x) => s + x.views, 0) || 1
                          const pct = Math.round((d.views / total) * 100)
                          return (
                            <div key={d.device} className="flex items-center gap-3">
                              <div className="w-16 text-xs font-medium capitalize">{d.device}</div>
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#1faca6]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                                {d.views} · {pct}%
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
