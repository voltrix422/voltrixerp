import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { featureDisplayLabel, pathDisplayLabel } from "@/lib/website-analytics"

export const dynamic = "force-dynamic"

const ACTIVE_MS = 5 * 60 * 1000

function parseRange(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const toParam = sp.get("to")
  const fromParam = sp.get("from")
  const to = toParam ? new Date(toParam) : new Date()
  const from = fromParam
    ? new Date(fromParam)
    : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range")
  }
  return { from, to }
}

function normalizeReferrer(ref: string): string {
  if (!ref) return ""
  try {
    const u = new URL(ref)
    if (u.hostname.includes("voltrix") || u.hostname === "localhost") return ""
    return u.hostname.replace(/^www\./, "")
  } catch {
    return ref.slice(0, 80)
  }
}

function deviceFromUa(ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet/i.test(ua)) return "tablet"
  if (/Mobile|Android|iPhone/i.test(ua)) return "mobile"
  return "desktop"
}

export async function GET(req: NextRequest) {
  try {
    const { from, to } = parseRange(req)
    const pathFilter = req.nextUrl.searchParams.get("path")
    const now = Date.now()

    // Detail mode for one page
    if (pathFilter) {
      const path = pathFilter.startsWith("/") ? pathFilter : `/${pathFilter}`
      const [pageviews, featureHits, activeOnPath] = await Promise.all([
        prisma.erpWebsitePageview.findMany({
          where: { createdAt: { gte: from, lte: to }, path },
          select: {
            visitorId: true,
            sessionId: true,
            durationMs: true,
            createdAt: true,
            referrer: true,
            userAgent: true,
            title: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.erpWebsiteFeatureHit.findMany({
          where: { createdAt: { gte: from, lte: to }, path },
          select: {
            featureKey: true,
            featureLabel: true,
            visitorId: true,
            durationMs: true,
          },
        }),
        prisma.erpWebsitePresence.findMany({
          where: {
            path,
            lastSeenAt: { gte: new Date(now - ACTIVE_MS) },
          },
          select: { visitorId: true, lastSeenAt: true, userAgent: true },
          orderBy: { lastSeenAt: "desc" },
        }),
      ])

      const uniqueVisitors = new Set(pageviews.map((p) => p.visitorId)).size
      const sessions = new Set(pageviews.map((p) => p.sessionId)).size
      const totalViews = pageviews.length
      const totalDwell = pageviews.reduce((s, p) => s + (p.durationMs || 0), 0)
      const avgDwellMs = totalViews ? Math.round(totalDwell / totalViews) : 0

      const dailyMap = new Map<string, { views: number; visitors: Set<string>; dwell: number }>()
      const hourMap = new Map<number, number>()
      const deviceMap = new Map<string, number>()
      const refMap = new Map<string, number>()

      for (const p of pageviews) {
        const day = p.createdAt.toISOString().slice(0, 10)
        const dRow = dailyMap.get(day) || { views: 0, visitors: new Set(), dwell: 0 }
        dRow.views += 1
        dRow.visitors.add(p.visitorId)
        dRow.dwell += p.durationMs || 0
        dailyMap.set(day, dRow)

        const hour = p.createdAt.getUTCHours()
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1)

        const device = deviceFromUa(p.userAgent)
        deviceMap.set(device, (deviceMap.get(device) || 0) + 1)

        const ref = normalizeReferrer(p.referrer)
        if (ref) refMap.set(ref, (refMap.get(ref) || 0) + 1)
      }

      const byFeature = new Map<
        string,
        { label: string; hits: number; visitors: Set<string>; dwell: number }
      >()
      for (const f of featureHits) {
        const row = byFeature.get(f.featureKey) || {
          label: f.featureLabel || featureDisplayLabel(f.featureKey),
          hits: 0,
          visitors: new Set<string>(),
          dwell: 0,
        }
        row.hits += 1
        row.visitors.add(f.visitorId)
        row.dwell += f.durationMs || 0
        byFeature.set(f.featureKey, row)
      }

      const recent = pageviews.slice(0, 40).map((p) => ({
        visitorId: p.visitorId.slice(0, 10) + "…",
        durationMs: p.durationMs,
        createdAt: p.createdAt,
        device: deviceFromUa(p.userAgent),
        referrer: normalizeReferrer(p.referrer) || "Direct",
      }))

      return NextResponse.json({
        mode: "detail",
        path,
        label: pathDisplayLabel(path),
        from: from.toISOString(),
        to: to.toISOString(),
        summary: {
          uniqueVisitors,
          sessions,
          totalViews,
          avgDwellMs,
          totalDwellMs: totalDwell,
          activeNow: activeOnPath.length,
        },
        daily: Array.from(dailyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, row]) => ({
            date,
            views: row.views,
            uniqueVisitors: row.visitors.size,
            avgDwellMs: row.views ? Math.round(row.dwell / row.views) : 0,
          })),
        byHour: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          views: hourMap.get(hour) || 0,
        })),
        devices: ["desktop", "mobile", "tablet"].map((d) => ({
          device: d,
          views: deviceMap.get(d) || 0,
        })),
        referrers: Array.from(refMap.entries())
          .map(([source, views]) => ({ source, views }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 15),
        features: Array.from(byFeature.entries())
          .map(([key, row]) => ({
            key,
            label: row.label,
            hits: row.hits,
            uniqueVisitors: row.visitors.size,
            avgDwellMs: row.hits ? Math.round(row.dwell / row.hits) : 0,
            totalDwellMs: row.dwell,
          }))
          .sort((a, b) => b.totalDwellMs - a.totalDwellMs),
        recent,
        activeNow: activeOnPath.map((r) => ({
          visitorId: r.visitorId,
          lastSeenAt: r.lastSeenAt,
          userAgent: r.userAgent,
        })),
      })
    }

    const [pageviews, featureHits, activeRows] = await Promise.all([
      prisma.erpWebsitePageview.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          path: true,
          visitorId: true,
          sessionId: true,
          durationMs: true,
          createdAt: true,
          referrer: true,
          userAgent: true,
        },
      }),
      prisma.erpWebsiteFeatureHit.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          featureKey: true,
          featureLabel: true,
          path: true,
          visitorId: true,
          durationMs: true,
        },
      }),
      prisma.erpWebsitePresence.findMany({
        where: { lastSeenAt: { gte: new Date(now - ACTIVE_MS) } },
        select: { visitorId: true, path: true, lastSeenAt: true, userAgent: true },
        orderBy: { lastSeenAt: "desc" },
      }),
    ])

    const uniqueVisitors = new Set(pageviews.map((p) => p.visitorId)).size
    const sessions = new Set(pageviews.map((p) => p.sessionId)).size
    const totalViews = pageviews.length
    const totalDwell = pageviews.reduce((s, p) => s + (p.durationMs || 0), 0)
    const avgDwellMs = totalViews ? Math.round(totalDwell / totalViews) : 0

    const byPath = new Map<string, { views: number; visitors: Set<string>; dwell: number }>()
    const deviceMap = new Map<string, number>()
    for (const p of pageviews) {
      const row = byPath.get(p.path) || { views: 0, visitors: new Set(), dwell: 0 }
      row.views += 1
      row.visitors.add(p.visitorId)
      row.dwell += p.durationMs || 0
      byPath.set(p.path, row)
      const device = deviceFromUa(p.userAgent)
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1)
    }
    const pages = Array.from(byPath.entries())
      .map(([path, row]) => ({
        path,
        label: pathDisplayLabel(path),
        views: row.views,
        uniqueVisitors: row.visitors.size,
        avgDwellMs: row.views ? Math.round(row.dwell / row.views) : 0,
        totalDwellMs: row.dwell,
      }))
      .sort((a, b) => b.views - a.views)

    const byFeature = new Map<
      string,
      { label: string; hits: number; visitors: Set<string>; dwell: number }
    >()
    for (const f of featureHits) {
      const row = byFeature.get(f.featureKey) || {
        label: f.featureLabel || featureDisplayLabel(f.featureKey),
        hits: 0,
        visitors: new Set<string>(),
        dwell: 0,
      }
      row.hits += 1
      row.visitors.add(f.visitorId)
      row.dwell += f.durationMs || 0
      if (f.featureLabel) row.label = f.featureLabel
      byFeature.set(f.featureKey, row)
    }
    const features = Array.from(byFeature.entries())
      .map(([key, row]) => ({
        key,
        label: row.label,
        hits: row.hits,
        uniqueVisitors: row.visitors.size,
        avgDwellMs: row.hits ? Math.round(row.dwell / row.hits) : 0,
        totalDwellMs: row.dwell,
      }))
      .sort((a, b) => b.totalDwellMs - a.totalDwellMs)

    const dailyMap = new Map<string, { views: number; visitors: Set<string> }>()
    for (const p of pageviews) {
      const day = p.createdAt.toISOString().slice(0, 10)
      const row = dailyMap.get(day) || { views: 0, visitors: new Set() }
      row.views += 1
      row.visitors.add(p.visitorId)
      dailyMap.set(day, row)
    }
    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, row]) => ({
        date,
        views: row.views,
        uniqueVisitors: row.visitors.size,
      }))

    const refMap = new Map<string, number>()
    for (const p of pageviews) {
      const ref = normalizeReferrer(p.referrer)
      if (!ref) continue
      refMap.set(ref, (refMap.get(ref) || 0) + 1)
    }
    const referrers = Array.from(refMap.entries())
      .map(([source, views]) => ({ source, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15)

    void prisma.erpWebsitePresence
      .deleteMany({ where: { lastSeenAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } } })
      .catch(() => {})

    return NextResponse.json({
      mode: "summary",
      from: from.toISOString(),
      to: to.toISOString(),
      summary: {
        uniqueVisitors,
        sessions,
        totalViews,
        avgDwellMs,
        activeNow: activeRows.length,
        pagesTracked: pages.length,
      },
      activeNow: activeRows.map((r) => ({
        visitorId: r.visitorId,
        path: r.path,
        label: pathDisplayLabel(r.path),
        lastSeenAt: r.lastSeenAt,
        userAgent: r.userAgent,
      })),
      pages,
      mostVisited: pages.slice(0, 15),
      leastVisited: [...pages].sort((a, b) => a.views - b.views).slice(0, 15),
      features,
      daily,
      referrers,
      devices: ["desktop", "mobile", "tablet"].map((d) => ({
        device: d,
        views: deviceMap.get(d) || 0,
      })),
    })
  } catch (e) {
    console.error("website-analytics GET:", e)
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 })
  }
}
