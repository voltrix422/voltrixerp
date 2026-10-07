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
      bundleWasTotal: null,
      bundleDealPrice: null,
      bundlePctOff: null,
      products: [],
      product: null,
      publicPath: null,
    })
  }
  const first = deal.products[0]
  return NextResponse.json({
    enabled: true,
    headline: deal.headline,
    dealLabel: deal.dealLabel,
    bundleWasTotal: deal.bundleWasTotal,
    bundleDealPrice: deal.bundleDealPrice,
    bundlePctOff: deal.bundlePctOff,
    products: deal.products,
    product: first
      ? {
          id: first.id,
          name: first.name,
          model: first.model,
          price: deal.bundleDealPrice ?? first.price,
          compareAtPrice: deal.bundleWasTotal,
          quoteMode: first.quoteMode,
          images: first.images,
          published: true,
        }
      : null,
    publicPath: first?.publicPath ?? null,
  })
}
