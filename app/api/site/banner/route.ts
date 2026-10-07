import { NextRequest, NextResponse } from "next/server"
import {
  readWebsiteBannerConfig,
  writeWebsiteBannerConfig,
  type WebsiteBannerConfig,
  type WebsiteBannerDealItem,
} from "@/lib/website-banner-server"

export const dynamic = "force-dynamic"

function parseItems(body: Partial<WebsiteBannerConfig>): WebsiteBannerDealItem[] {
  const items: WebsiteBannerDealItem[] = []
  if (Array.isArray(body.items)) {
    for (const row of body.items) {
      if (!row || typeof row !== "object") continue
      const productId = String(row.productId || "").trim()
      if (!productId) continue
      if (items.some((x) => x.productId === productId)) continue
      const rawDeal = (row as { dealPrice?: unknown }).dealPrice
      const dealN =
        rawDeal == null || rawDeal === ""
          ? NaN
          : Number(rawDeal)
      items.push({
        productId,
        dealPrice: Number.isFinite(dealN) && dealN > 0 ? Math.round(dealN) : null,
      })
      if (items.length >= 4) break
    }
  }
  if (items.length === 0 && body.productId) {
    items.push({ productId: String(body.productId), dealPrice: null })
  }
  return items
}

export async function GET() {
  const config = await readWebsiteBannerConfig()
  return NextResponse.json(config)
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<WebsiteBannerConfig>
    const items = parseItems(body)
    const config: WebsiteBannerConfig = {
      enabled: Boolean(body.enabled),
      productId: items[0]?.productId ?? null,
      items,
      headline: body.headline != null ? String(body.headline).trim().slice(0, 80) : "",
    }
    if (config.enabled && config.items.length === 0) {
      return NextResponse.json(
        { error: "Select at least one product for the homepage deal popup." },
        { status: 400 },
      )
    }
    await writeWebsiteBannerConfig(config)
    return NextResponse.json(config)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to save banner settings"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
