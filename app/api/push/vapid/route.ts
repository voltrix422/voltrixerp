import { NextResponse } from "next/server"
import { getVapidPublicKey } from "@/lib/web-push-server"

export async function GET() {
  return NextResponse.json({ publicKey: getVapidPublicKey() })
}
