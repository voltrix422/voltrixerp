"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft, Loader2, RefreshCw, ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDuration } from "@/lib/website-analytics"

type DetailPayload = {
  path: string
  label: string
  from: string
  to: string
  summary: {
    uniqueVisitors: number
    sessions: number
    totalViews: number
    avgDwellMs: number
    totalDwellMs: number
    activeNow: number
  }
  daily: Array<{ date: string; views: number; uniqueVisitors: number; avgDwellMs: number }>
  byHour: Array<{ hour: number; views: number }>
  devices: Array<{ device: string; views: number }>
  referrers: Array<{ source: string; views: number }>
  features: Array<{
    key: string
    label: string
    hits: number
    uniqueVisitors: number
    avgDwellMs: number
    totalDwellMs: number
  }>
  recent: Array<{
    visitorId: string
    durationMs: number
    createdAt: string
    device: string
    referrer: string
  }>
  activeNow: Array<{ visitorId: string; lastSeenAt: string; userAgent: string }>
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-[hsl(var(--card))] p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}

export default function WebsiteAnalyticsDetail() {
  const sp = useSearchParams()
  const path = sp.get("path") || "/"
  const fromQ = sp.get("from")
  const toQ = sp.get("to")

  const [from, setFrom] = useState(fromQ || new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(toQ || new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DetailPayload | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const fromIso = new Date(`${from}T00:00:00`).toISOString()
      const toIso = new Date(`${to}T23:59:59.999`).toISOString()
      const res = await fetch(
        `/api/db/website-analytics?path=${encodeURIComponent(path)}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      )
      if (!res.ok) throw new Error("Failed to load page details")
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [path, from, to])

  useEffect(() => {
    void load()
  }, [load])

  const maxDaily = useMemo(
    () => Math.max(...(data?.daily.map((d) => d.views) || [0]), 1),
    [data],
  )
  const maxHour = useMemo(
    () => Math.max(...(data?.byHour.map((h) => h.views) || [0]), 1),
    [data],
  )

  return (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 z-10 border-b bg-[hsl(var(--background))]/95 backdrop-blur px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              href="/website?tab=analytics"
              className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
              title="Back to analytics"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate">{data?.label || "Page details"}</h2>
              <p className="text-xs text-muted-foreground font-mono truncate">{path}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] text-muted-foreground">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="ml-1 h-8 rounded-md border bg-background px-2 text-xs"
              />
            </label>
            <label className="text-[11px] text-muted-foreground">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="ml-1 h-8 rounded-md border bg-background px-2 text-xs"
              />
            </label>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void load()}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <a
              href={path}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-accent"
            >
              Open page <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-6xl space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading page details…
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Stat label="Active now" value={data.summary.activeNow} hint="On this page" />
              <Stat label="Unique visitors" value={data.summary.uniqueVisitors} />
              <Stat label="Page views" value={data.summary.totalViews} hint={`${data.summary.sessions} sessions`} />
              <Stat label="Avg. time" value={formatDuration(data.summary.avgDwellMs)} />
              <Stat label="Total time" value={formatDuration(data.summary.totalDwellMs)} />
            </div>

            <div className="rounded-xl border p-4 shadow-sm">
              <p className="text-sm font-semibold mb-3">Views by day</p>
              {data.daily.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No views in this range</p>
              ) : (
                <div className="flex items-end gap-1.5 h-36">
                  {data.daily.map((d) => (
                    <div key={d.date} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[10px] tabular-nums text-muted-foreground">{d.views}</span>
                      <div
                        className="w-full rounded-t bg-[#1faca6] min-h-[4px]"
                        style={{ height: `${(d.views / maxDaily) * 100}%` }}
                        title={`${d.date}: ${d.views} views, ${d.uniqueVisitors} people, avg ${formatDuration(d.avgDwellMs)}`}
                      />
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border p-4 shadow-sm">
              <p className="text-sm font-semibold mb-3">Views by hour (UTC)</p>
              <div className="flex items-end gap-0.5 h-28">
                {data.byHour.map((h) => (
                  <div key={h.hour} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      className="w-full rounded-t bg-[#1faca6]/80 min-h-[2px]"
                      style={{ height: `${(h.views / maxHour) * 100}%` }}
                      title={`${h.hour}:00 — ${h.views} views`}
                    />
                    {h.hour % 3 === 0 && (
                      <span className="text-[8px] text-muted-foreground">{h.hour}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border p-4 shadow-sm">
                <p className="text-sm font-semibold mb-3">Devices</p>
                {data.devices.every((d) => d.views === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                ) : (
                  <div className="space-y-3">
                    {data.devices.map((d) => {
                      const total = data.devices.reduce((s, x) => s + x.views, 0) || 1
                      const pct = Math.round((d.views / total) * 100)
                      return (
                        <div key={d.device} className="flex items-center gap-3">
                          <div className="w-16 text-xs font-medium capitalize">{d.device}</div>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-[#1faca6]" style={{ width: `${pct}%` }} />
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

              <div className="rounded-xl border p-4 shadow-sm">
                <p className="text-sm font-semibold mb-3">Referrers</p>
                {data.referrers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Mostly direct visits</p>
                ) : (
                  <div className="space-y-2">
                    {data.referrers.map((r) => (
                      <div key={r.source} className="flex justify-between text-xs border-b last:border-0 py-1.5">
                        <span className="font-medium">{r.source}</span>
                        <span className="tabular-nums text-muted-foreground">{r.views}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {data.features.length > 0 && (
              <div className="rounded-xl border p-4 shadow-sm">
                <p className="text-sm font-semibold mb-3">Features on this page</p>
                <div className="overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Feature</th>
                        <th className="text-right px-3 py-2 font-medium">People</th>
                        <th className="text-right px-3 py-2 font-medium">Avg stay</th>
                        <th className="text-right px-3 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.features.map((f) => (
                        <tr key={f.key}>
                          <td className="px-3 py-2 font-medium">{f.label}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{f.uniqueVisitors}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {formatDuration(f.avgDwellMs)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatDuration(f.totalDwellMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-xl border p-4 shadow-sm">
              <p className="text-sm font-semibold mb-3">Recent visits</p>
              {data.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No recent visits</p>
              ) : (
                <div className="overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">When</th>
                        <th className="text-left px-3 py-2 font-medium">Visitor</th>
                        <th className="text-left px-3 py-2 font-medium">Device</th>
                        <th className="text-left px-3 py-2 font-medium">Source</th>
                        <th className="text-right px-3 py-2 font-medium">Time on page</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.recent.map((r, i) => (
                        <tr key={`${r.visitorId}-${i}`}>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(r.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{r.visitorId}</td>
                          <td className="px-3 py-2 capitalize text-xs">{r.device}</td>
                          <td className="px-3 py-2 text-xs">{r.referrer}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs">
                            {formatDuration(r.durationMs)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
