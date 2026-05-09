import { NextRequest, NextResponse } from "next/server"
import {
  clearLiveScans,
  connectScanner,
  disconnectScanner,
  getScannerStatus,
  startScanner,
  stopScanner,
} from "@/lib/rfid-scanner-store"

export async function GET() {
  return NextResponse.json(getScannerStatus())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const action = String(body.action || "").toLowerCase()

  if (action === "connect") {
    const readerIp = String(body.reader_ip || "").trim()
    const readerPortRaw = Number(body.reader_port ?? 9090)
    const readerPort = Number.isFinite(readerPortRaw) ? readerPortRaw : 9090
    if (!readerIp) {
      return NextResponse.json({ error: "reader_ip is required" }, { status: 400 })
    }
    const connection = connectScanner(readerIp, readerPort)
    return NextResponse.json({ ok: true, connection })
  }

  if (action === "disconnect") {
    const connection = disconnectScanner()
    return NextResponse.json({ ok: true, connection })
  }

  if (action === "start_scan") {
    const connection = startScanner()
    if (!connection) {
      return NextResponse.json({ error: "Scanner is not connected" }, { status: 400 })
    }
    return NextResponse.json({ ok: true, connection })
  }

  if (action === "stop_scan") {
    const connection = stopScanner()
    return NextResponse.json({ ok: true, connection })
  }

  if (action === "clear_scans") {
    clearLiveScans()
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
