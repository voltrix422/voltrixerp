import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { appendLiveScan, getScannerStore } from "@/lib/rfid-scanner-store"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const epc = String(body.epc || "").trim().toUpperCase()

  if (!epc) {
    return NextResponse.json({ error: "epc is required" }, { status: 400 })
  }

  const store = getScannerStore()
  if (!store.connection.connected) {
    return NextResponse.json({ error: "Scanner is not connected" }, { status: 400 })
  }
  if (!store.connection.scanning) {
    return NextResponse.json({ error: "Scanner is connected but not scanning" }, { status: 400 })
  }

  const readerIp = String(body.reader_ip || store.connection.readerIp || "")
  const readerPortRaw = Number(body.reader_port ?? store.connection.readerPort ?? 9090)
  const readerPort = Number.isFinite(readerPortRaw) ? readerPortRaw : 9090
  const antenna = body.antenna ? String(body.antenna) : undefined
  const rssiRaw = Number(body.rssi)
  const rssi = Number.isFinite(rssiRaw) ? rssiRaw : undefined
  const frequencyRaw = Number(body.frequency)
  const frequency = Number.isFinite(frequencyRaw) ? frequencyRaw : undefined
  const protocol = body.protocol ? String(body.protocol) : undefined

  await prisma.erpRfidTag.upsert({
    where: { epc },
    update: {
      updatedBy: "scanner",
    },
    create: {
      epc,
      status: "IN_STOCK",
      updatedBy: "scanner",
    },
  })

  const row = appendLiveScan({
    epc,
    readerIp,
    readerPort,
    antenna,
    rssi,
    frequency,
    protocol,
  })

  return NextResponse.json({ ok: true, scan: row })
}
