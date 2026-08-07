import { NextRequest, NextResponse } from "next/server"
import {
  readWebsiteBannerConfig,
  writeWebsiteBannerConfig,
  type WebsiteBannerConfig,
} from "@/lib/website-banner-server"

export const dynamic = "force-dynamic"

export async function GET() {
  const config = await readWebsiteBannerConfig()
  return NextResponse.json(config)
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<WebsiteBannerConfig>
    const config: WebsiteBannerConfig = {
      enabled: Boolean(body.enabled),
      productId: body.productId ? String(body.productId) : null,
    }
    if (config.enabled && !config.productId) {
      return NextResponse.json({ error: "Select a product to enable the homepage banner." }, { status: 400 })
    }
    await writeWebsiteBannerConfig(config)
    return NextResponse.json(config)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to save banner settings"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
