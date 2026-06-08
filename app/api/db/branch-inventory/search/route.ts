import { NextRequest, NextResponse } from "next/server"
import { searchProductAcrossBranches } from "@/lib/branch-product-search"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const termParams = searchParams.getAll("term").map((t) => t.trim()).filter(Boolean)
  const q = searchParams.get("q")?.trim() || ""

  const results =
    termParams.length > 0
      ? await searchProductAcrossBranches(termParams)
      : q
        ? await searchProductAcrossBranches(q)
        : []

  return NextResponse.json(results)
}
