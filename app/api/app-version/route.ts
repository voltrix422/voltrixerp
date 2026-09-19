import { readFile } from "node:fs/promises"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const buildId = (await readFile(".next/BUILD_ID", "utf8").catch(() => "dev")).trim()
  return NextResponse.json(
    { version: buildId || "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}
