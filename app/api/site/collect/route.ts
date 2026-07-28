import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  featureDisplayLabel,
  hashIp,
  isPublicAnalyticsPath,
  normalizeAnalyticsPath,
  resolveTrafficSource,
} from "@/lib/website-analytics"

export const dynamic = "force-dynamic"

type TrackBody = {
  type?: "pageview" | "page_leave" | "feature" | "heartbeat"
  path?: string
  title?: string
  referrer?: string
  source?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  visitorId?: string
  sessionId?: string
  pageviewId?: string
  featureKey?: string
  featureLabel?: string
  durationMs?: number
}

function clientMeta(req: NextRequest) {
  const ua = req.headers.get("user-agent") || ""
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  return { ua: ua.slice(0, 400), ipHash: hashIp(ip) }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TrackBody
    const type = body.type || "pageview"
    const visitorId = String(body.visitorId || "").slice(0, 80)
    const sessionId = String(body.sessionId || "").slice(0, 80)
    if (!visitorId || !sessionId) {
      return NextResponse.json({ error: "visitorId and sessionId required" }, { status: 400 })
    }

    const path = normalizeAnalyticsPath(String(body.path || "/"))
    if (!isPublicAnalyticsPath(path)) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { ua, ipHash } = clientMeta(req)
    const durationMs = Math.max(0, Math.min(Number(body.durationMs) || 0, 60 * 60 * 1000))

    if (type === "pageview") {
      const referrer = String(body.referrer || "").slice(0, 500)
      const utmSource = String(body.utmSource || "").slice(0, 80)
      const utmMedium = String(body.utmMedium || "").slice(0, 80)
      const utmCampaign = String(body.utmCampaign || "").slice(0, 120)
      const source = resolveTrafficSource({
        referrer,
        source: body.source,
        utmSource,
        utmMedium,
      }).slice(0, 80)
      const row = await prisma.erpWebsitePageview.create({
        data: {
          path,
          title: String(body.title || "").slice(0, 200),
          referrer,
          source,
          utmSource,
          utmMedium,
          utmCampaign,
          visitorId,
          sessionId,
          userAgent: ua,
          ipHash,
          durationMs: 0,
        },
      })
      await upsertPresence(visitorId, sessionId, path, ua, ipHash)
      return NextResponse.json({ ok: true, pageviewId: row.id })
    }

    if (type === "page_leave") {
      const pageviewId = String(body.pageviewId || "")
      if (pageviewId && durationMs > 0) {
        await prisma.erpWebsitePageview.updateMany({
          where: { id: pageviewId, visitorId },
          data: { durationMs },
        })
      }
      await upsertPresence(visitorId, sessionId, path, ua, ipHash)
      return NextResponse.json({ ok: true })
    }

    if (type === "feature") {
      const featureKey = String(body.featureKey || "").slice(0, 80)
      if (!featureKey || durationMs < 500) {
        return NextResponse.json({ ok: true, skipped: true })
      }
      const label =
        String(body.featureLabel || "").slice(0, 120) || featureDisplayLabel(featureKey)
      await prisma.erpWebsiteFeatureHit.create({
        data: {
          path,
          featureKey,
          featureLabel: label,
          visitorId,
          sessionId,
          durationMs,
        },
      })
      return NextResponse.json({ ok: true })
    }

    if (type === "heartbeat") {
      await upsertPresence(visitorId, sessionId, path, ua, ipHash)
      if (body.pageviewId && durationMs > 0) {
        await prisma.erpWebsitePageview.updateMany({
          where: { id: String(body.pageviewId), visitorId },
          data: { durationMs },
        })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (e) {
    console.error("analytics track error:", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

async function upsertPresence(
  visitorId: string,
  sessionId: string,
  path: string,
  userAgent: string,
  ipHash: string,
) {
  await prisma.erpWebsitePresence.upsert({
    where: { visitorId },
    create: { visitorId, sessionId, path, userAgent, ipHash, lastSeenAt: new Date() },
    update: { sessionId, path, userAgent, ipHash, lastSeenAt: new Date() },
  })
}
