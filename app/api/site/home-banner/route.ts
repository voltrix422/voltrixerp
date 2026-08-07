import { NextResponse } from "next/server"
import { resolveHomeBannerProduct } from "@/lib/website-banner-server"

export const dynamic = "force-dynamic"

export async function GET() {
  const product = await resolveHomeBannerProduct()
  if (!product) {
    return NextResponse.json({ enabled: false, product: null })
  }
  return NextResponse.json({ enabled: true, product })
}
