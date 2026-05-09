import { NextRequest, NextResponse } from "next/server"
import net from "node:net"
import os from "node:os"

type ReaderCandidate = {
  ip: string
  port: number
  reachable: boolean
  latency_ms: number
}

function isPrivateIpv4(ip: string): boolean {
  if (ip.startsWith("10.")) return true
  if (ip.startsWith("192.168.")) return true
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1] || 0)
    return second >= 16 && second <= 31
  }
  return false
}

function detectLocalSubnetPrefix(): string | null {
  const interfaces = os.networkInterfaces()
  for (const list of Object.values(interfaces)) {
    if (!list) continue
    for (const entry of list) {
      if (entry.family !== "IPv4" || entry.internal) continue
      if (!isPrivateIpv4(entry.address)) continue
      const parts = entry.address.split(".")
      if (parts.length !== 4) continue
      return `${parts[0]}.${parts[1]}.${parts[2]}`
    }
  }
  return null
}

async function probeHost(ip: string, port: number, timeoutMs: number): Promise<ReaderCandidate> {
  const start = Date.now()
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const finish = (reachable: boolean) => {
      if (settled) return
      settled = true
      const latency = Date.now() - start
      socket.destroy()
      resolve({
        ip,
        port,
        reachable,
        latency_ms: latency,
      })
    }

    socket.setTimeout(timeoutMs)
    socket.once("connect", () => finish(true))
    socket.once("timeout", () => finish(false))
    socket.once("error", () => finish(false))
    socket.connect(port, ip)
  })
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let cursor = 0

  const runWorker = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      const result = await worker(items[index])
      results.push(result)
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => runWorker())
  await Promise.all(workers)
  return results
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const requestedSubnet = searchParams.get("subnet")
  const detectedSubnet = detectLocalSubnetPrefix()
  const fallbackSubnets = ["192.168.18", "192.168.1", "192.168.0", "10.0.0"]
  const subnetsToScan = requestedSubnet
    ? [requestedSubnet]
    : detectedSubnet
      ? [detectedSubnet]
      : fallbackSubnets
  const port = Number(searchParams.get("port") || 9090)
  const fromHost = Number(searchParams.get("from") || 1)
  const toHost = Number(searchParams.get("to") || 254)
  const timeoutMs = Number(searchParams.get("timeout_ms") || 180)
  const concurrency = Number(searchParams.get("concurrency") || 90)

  if (Number.isNaN(port) || port <= 0) {
    return NextResponse.json({ error: "Invalid port" }, { status: 400 })
  }

  const start = Math.min(Math.max(1, fromHost), 254)
  const end = Math.min(Math.max(start, toHost), 254)
  const ipsWithSubnet: Array<{ ip: string; subnet: string }> = []
  for (const subnet of subnetsToScan) {
    for (let i = start; i <= end; i += 1) {
      ipsWithSubnet.push({ ip: `${subnet}.${i}`, subnet })
    }
  }

  const probes = await runWithConcurrency(ipsWithSubnet, concurrency, async (item) => {
    const probe = await probeHost(item.ip, port, timeoutMs)
    return { ...probe, subnet: item.subnet }
  })
  const readers = probes.filter((row) => row.reachable).sort((a, b) => a.latency_ms - b.latency_ms)
  const primarySubnet = readers[0]?.subnet || requestedSubnet || detectedSubnet || fallbackSubnets[0]

  return NextResponse.json({
    subnet: primarySubnet,
    port,
    scanned_hosts: ipsWithSubnet.length,
    found_count: readers.length,
    readers: readers.map(({ subnet: _subnet, ...reader }) => reader),
  })
}
