import { NextResponse } from "next/server"
import { resolveHomeBannerProduct } from "@/lib/website-banner-server"

export const dynamic = "force-dynamic"

export async function GET() {
  const resolved = await resolveHomeBannerProduct()
  if (!resolved) {
    return NextResponse.json({ enabled: false, product: null, publicPath: null })
  }
  return NextResponse.json({
    enabled: true,
    product: resolved.product,
    publicPath: resolved.publicPath,
  })
}
