#!/usr/bin/env node
/* eslint-disable no-console */
const net = require("node:net")

const ERP_SCAN_URL = process.env.ERP_SCAN_URL || "https://voltrixbatteries.com/api/rfid/scanner/scan"
const ERP_CONNECT_URL = process.env.ERP_CONNECT_URL || "https://voltrixbatteries.com/api/rfid/scanner"
const LISTEN_HOST = process.env.RFID_BRIDGE_HOST || "0.0.0.0"
const LISTEN_PORT = Number(process.env.RFID_BRIDGE_PORT || 9090)
const READER_IP = process.env.RFID_READER_IP || "192.168.18.112"
const READER_PORT = Number(process.env.RFID_READER_PORT || 9090)
const DUPLICATE_COOLDOWN_MS = Number(process.env.RFID_DUPLICATE_COOLDOWN_MS || 5000)

const recentlySeen = new Map()

function cleanupSeen() {
  const now = Date.now()
  for (const [epc, ts] of recentlySeen.entries()) {
    if (now - ts > DUPLICATE_COOLDOWN_MS) recentlySeen.delete(epc)
  }
}

function shouldForward(epc) {
  cleanupSeen()
  const now = Date.now()
  const prev = recentlySeen.get(epc)
  if (prev && now - prev < DUPLICATE_COOLDOWN_MS) return false
  recentlySeen.set(epc, now)
  return true
}

function extractEpcs(chunk) {
  const text = chunk.toString("utf8")
  const candidates = new Set()

  // Common text formats
  const patterns = [
    /EPC[:=\s]+([0-9A-F]{8,64})/gi,
    /\b6C\s+([0-9A-F]{8,64})\b/gi,
    /\b([0-9A-F]{24,64})\b/g, // fallback: likely EPC-sized hex payload
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const epc = (match[1] || "").toUpperCase().trim()
      if (epc.length >= 8) candidates.add(epc)
    }
  }

  return [...candidates]
}

async function callJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function ensureErpScannerState() {
  const connect = await callJson(ERP_CONNECT_URL, {
    action: "connect",
    reader_ip: READER_IP,
    reader_port: READER_PORT,
  })
  if (!connect.ok && !String(connect.data?.error || "").includes("already")) {
    console.log("[ERP connect]", connect.status, connect.data)
  }

  const start = await callJson(ERP_CONNECT_URL, { action: "start_scan" })
  if (!start.ok) console.log("[ERP start_scan]", start.status, start.data)
}

async function forwardEpc(epc) {
  const result = await callJson(ERP_SCAN_URL, {
    epc,
    reader_ip: READER_IP,
    reader_port: READER_PORT,
    protocol: "TCP_BRIDGE",
  })
  if (result.ok) {
    console.log(`[TAG] forwarded ${epc}`)
  } else {
    console.log(`[TAG] failed ${epc}`, result.status, result.data)
  }
}

async function onData(chunk) {
  const epcs = extractEpcs(chunk)
  if (epcs.length === 0) return
  for (const epc of epcs) {
    if (!shouldForward(epc)) continue
    await forwardEpc(epc)
  }
}

async function start() {
  console.log("[bridge] starting...")
  console.log(`[bridge] listen tcp://${LISTEN_HOST}:${LISTEN_PORT}`)
  console.log(`[bridge] forward to ${ERP_SCAN_URL}`)
  console.log(`[bridge] scanner state at ${ERP_CONNECT_URL}`)

  await ensureErpScannerState()
  setInterval(ensureErpScannerState, 15_000)

  const server = net.createServer((socket) => {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`
    console.log(`[bridge] reader connected from ${remote}`)
    socket.on("data", (chunk) => {
      onData(chunk).catch((err) => {
        console.error("[bridge] onData error:", err.message)
      })
    })
    socket.on("close", () => console.log(`[bridge] reader disconnected ${remote}`))
    socket.on("error", (err) => console.log(`[bridge] socket error ${remote}:`, err.message))
  })

  server.listen(LISTEN_PORT, LISTEN_HOST, () => {
    console.log("[bridge] ready")
    console.log("[bridge] IMPORTANT: set reader HOST_SERVER_IP to this PC IP and HOST_SERVER_PORT to 9090")
  })
}

start().catch((err) => {
  console.error("[bridge] fatal:", err)
  process.exit(1)
})
