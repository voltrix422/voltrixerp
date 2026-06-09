import { NextResponse } from "next/server"
import { getSmtpStatus } from "@/lib/smtp-config"

export async function GET() {
  return NextResponse.json(getSmtpStatus())
}
