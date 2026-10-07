import { NextResponse } from "next/server"
import { resolveHomeBannerDeal } from "@/lib/website-banner-server"

export const dynamic = "force-dynamic"

export async function GET() {
  const deal = await resolveHomeBannerDeal()
  if (!deal) {
    return NextResponse.json({
      enabled: false,
      headline: "",
      dealLabel: "",
      products: [],
      // legacy single-product fields
      product: null,
      publicPath: null,
    })
  }
  const first = deal.products[0]
  return NextResponse.json({
    enabled: true,
    headline: deal.headline,
    dealLabel: deal.dealLabel,
    products: deal.products,
    // legacy single-product fields (first item)
    product: first
      ? {
          id: first.id,
          name: first.name,
          model: first.model,
          price: first.dealPrice ?? first.price,
          compareAtPrice: first.wasPrice ?? first.compareAtPrice,
          quoteMode: first.quoteMode,
          images: first.images,
          published: true,
        }
      : null,
    publicPath: first?.publicPath ?? null,
  })
}
