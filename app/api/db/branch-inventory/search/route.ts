import { NextRequest, NextResponse } from "next/server"
import { searchProductAcrossBranches } from "@/lib/branch-product-search"

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim() || ""
  if (!q) {
    return NextResponse.json([])
  }
  const results = await searchProductAcrossBranches(q)
  return NextResponse.json(results)
}
