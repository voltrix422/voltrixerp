import { NextRequest, NextResponse } from "next/server"
import {
  readWebsiteBannerConfig,
  writeWebsiteBannerConfig,
  type WebsiteBannerConfig,
} from "@/lib/website-banner-server"

export const dynamic = "force-dynamic"

function parseProductIds(body: Partial<WebsiteBannerConfig>): string[] {
  const ids: string[] = []
  const push = (id: string) => {
    const t = id.trim()
    if (!t || ids.includes(t)) return
    ids.push(t)
  }
  if (Array.isArray(body.productIds)) {
    for (const id of body.productIds) push(String(id))
  }
  if (Array.isArray(body.items)) {
    for (const row of body.items) {
      if (row && typeof row === "object") push(String(row.productId || ""))
    }
  }
  if (body.productId) push(String(body.productId))
  return ids.slice(0, 4)
}

export async function GET() {
  const config = await readWebsiteBannerConfig()
  return NextResponse.json(config)
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<WebsiteBannerConfig> & {
      bundleDealPrice?: unknown
    }
    const productIds = parseProductIds(body)
    const rawBundle = (body as { bundleDealPrice?: unknown }).bundleDealPrice
    const bundleN =
      rawBundle == null || rawBundle === "" ? NaN : Number(rawBundle)
    const config: WebsiteBannerConfig = {
      enabled: Boolean(body.enabled),
      productId: productIds[0] ?? null,
      productIds,
      items: productIds.map((productId) => ({ productId })),
      bundleDealPrice: Number.isFinite(bundleN) && bundleN > 0 ? Math.round(bundleN) : null,
      headline: body.headline != null ? String(body.headline).trim().slice(0, 80) : "",
    }
    if (config.enabled && config.productIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one product for the homepage deal." },
        { status: 400 },
      )
    }
    if (config.enabled && config.bundleDealPrice == null) {
      return NextResponse.json(
        { error: "Enter one bundle deal price for the selected products." },
        { status: 400 },
      )
    }
    await writeWebsiteBannerConfig(config)
    return NextResponse.json(config)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to save deal settings"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
