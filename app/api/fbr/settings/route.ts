import { NextResponse } from "next/server"
import { getFbrConfig } from "@/lib/fbr-config"

/** Non-secret FBR flags for Branch POS UI (sandbox scenario buttons). */
export async function GET() {
  const config = getFbrConfig()
  return NextResponse.json({
    configured: config.configured,
    env: config.env,
    sandboxScenarioId: config.sandboxScenarioId,
  })
}
