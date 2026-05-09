"use client"

import { useEffect, useMemo, useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { Button } from "@/components/ui/button"

type ScannerConnection = {
  connected: boolean
  scanning: boolean
  readerIp: string
  readerPort: number
  updatedAt: string
}

type LiveScanRow = {
  id: string
  epc: string
  seenAt: string
  readerIp: string
  readerPort: number
  antenna?: string
  rssi?: number
  frequency?: number
  protocol?: string
}

type DiscoveredReader = {
  ip: string
  port: number
  reachable: boolean
  latency_ms: number
}

function buildFallbackReaders(subnet: string, port: number): DiscoveredReader[] {
  const hosts = [112, 104, 100, 101]
  return hosts.map((host) => ({
    ip: `${subnet}.${host}`,
    port,
    reachable: false,
    latency_ms: -1,
  }))
}

export default function RfidPage() {
  const [message, setMessage] = useState("")
  const [booting, setBooting] = useState(true)
  const [scannerIp, setScannerIp] = useState("")
  const [scannerPort, setScannerPort] = useState("9090")
  const [scannerConnection, setScannerConnection] = useState<ScannerConnection | null>(null)
  const [liveScans, setLiveScans] = useState<LiveScanRow[]>([])
  const [discoveringReaders, setDiscoveringReaders] = useState(false)
  const [discoveredReaders, setDiscoveredReaders] = useState<DiscoveredReader[]>([])
  const [detectedSubnet, setDetectedSubnet] = useState("")
  const [readType, setReadType] = useState<"inventory" | "single">("inventory")
  const [tagType, setTagType] = useState<"6c" | "6b" | "gb">("6c")
  const [selectedAntennas, setSelectedAntennas] = useState<number[]>([1])
  const [scanStartAt, setScanStartAt] = useState<number | null>(null)
  const [tick, setTick] = useState(Date.now())

  async function loadScannerStatus() {
    const res = await fetch("/api/rfid/scanner")
    if (!res.ok) return
    const data = await res.json()
    setScannerConnection(data.connection || null)
    setLiveScans(Array.isArray(data.scans) ? data.scans : [])
    if (data.connection?.scanning && !scanStartAt) setScanStartAt(Date.now())
    if (!data.connection?.scanning) setScanStartAt(null)
    if (data.connection?.connected && data.connection?.readerIp) {
      const connectedReader: DiscoveredReader = {
        ip: String(data.connection.readerIp),
        port: Number(data.connection.readerPort || 9090),
        reachable: true,
        latency_ms: 0,
      }
      setDiscoveredReaders((prev) => {
        const exists = prev.some((r) => r.ip === connectedReader.ip && r.port === connectedReader.port)
        return exists ? prev : [connectedReader, ...prev]
      })
    }
  }

  async function scannerAction(action: "connect" | "disconnect" | "start_scan" | "stop_scan" | "clear_scans", override?: { ip: string; port: number }) {
    const body: Record<string, unknown> = { action }
    if (action === "connect") {
      body.reader_ip = (override?.ip || scannerIp).trim()
      body.reader_port = override?.port || Number(scannerPort) || 9090
    }
    const res = await fetch("/api/rfid/scanner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || "Scanner action failed")
      return false
    }
    await loadScannerStatus()
    if (action === "start_scan") setScanStartAt(Date.now())
    if (action === "stop_scan" || action === "disconnect") setScanStartAt(null)
    return true
  }

  async function connectAndStart(ip: string, port: number) {
    const connected = await scannerAction("connect", { ip, port })
    if (!connected) return
    setScannerIp(ip)
    setScannerPort(String(port))
    await scannerAction("start_scan")
    setMessage(`Connected and scanning on ${ip}:${port}`)
  }

  async function connectFromDiscovered() {
    if (discoveredReaders.length > 0) {
      const first = discoveredReaders[0]
      await connectAndStart(first.ip, first.port)
      return
    }
    await discoverReaders(true)
  }

  function getSubnetHint(ipInput: string): string | null {
    const parts = ipInput.trim().split(".")
    if (parts.length !== 4) return null
    return `${parts[0]}.${parts[1]}.${parts[2]}`
  }

  async function discoverReaders(autoConnect = false) {
    setDiscoveringReaders(true)
    try {
      const subnetHint = getSubnetHint(scannerIp)
      const params = new URLSearchParams()
      params.set("port", scannerPort || "9090")
      if (subnetHint) params.set("subnet", subnetHint)

      const res = await fetch(`/api/rfid/scanner/discover?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setDiscoveredReaders((prev) => {
          if (scannerConnection?.connected && scannerConnection.readerIp) {
            const connectedReader: DiscoveredReader = {
              ip: scannerConnection.readerIp,
              port: scannerConnection.readerPort || 9090,
              reachable: true,
              latency_ms: 0,
            }
            const exists = prev.some((r) => r.ip === connectedReader.ip && r.port === connectedReader.port)
            return exists ? prev : [connectedReader, ...prev]
          }
          return prev
        })
        if (!scannerConnection?.connected) {
          setMessage("No scanner discovered yet. Click Auto Discover again or connect from known reader.")
        }
        return
      }

      const readers: DiscoveredReader[] = Array.isArray(data.readers) ? data.readers : []
      setDetectedSubnet(String(data.subnet || ""))
      setDiscoveredReaders(readers)

      if (readers.length > 0) {
        const first = readers[0]
        setScannerIp(first.ip)
        setScannerPort(String(first.port))
        if (autoConnect || !scannerConnection?.connected) {
          await connectAndStart(first.ip, first.port)
        } else {
          setMessage(`Found ${readers.length} reader(s).`)
        }
      } else {
        if (scannerConnection?.connected) {
          setMessage("Reader discovery found none, but your connected reader is still active.")
        } else {
          const fallbackSubnet = String(data.subnet || "")
          if (fallbackSubnet) {
            const fallbackReaders = buildFallbackReaders(fallbackSubnet, Number(scannerPort) || 9090)
            setDiscoveredReaders(fallbackReaders)
            setMessage("Auto discovery failed, showing quick-connect reader candidates.")
          } else {
            setMessage("No scanner found on local network.")
          }
        }
      }
    } finally {
      setDiscoveringReaders(false)
    }
  }

  useEffect(() => {
    loadScannerStatus()
      .then(async () => {
        await discoverReaders(true)
      })
      .catch(() => null)
      .finally(() => setBooting(false))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      loadScannerStatus().catch(() => null)
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const tagCount = useMemo(() => new Set(liveScans.map((row) => row.epc)).size, [liveScans])
  const readCount = liveScans.length
  const speedPerSecond = useMemo(() => {
    const threshold = Date.now() - 10000
    const recent = liveScans.filter((row) => new Date(row.seenAt).getTime() >= threshold).length
    return Math.round((recent / 10) * 10) / 10
  }, [liveScans, tick])
  const elapsedSeconds = scanStartAt ? Math.max(0, Math.floor((tick - scanStartAt) / 1000)) : 0
  const elapsedLabel = `${Math.floor(elapsedSeconds / 60).toString().padStart(2, "0")}:${(elapsedSeconds % 60)
    .toString()
    .padStart(2, "0")}`

  function toggleAntenna(ant: number) {
    setSelectedAntennas((prev) => (prev.includes(ant) ? prev.filter((x) => x !== ant) : [...prev, ant].sort((a, b) => a - b)))
  }

  return (
    <ModuleGuard module="inventory">
      <Topbar title="RFID Scanner" description="Auto discover, connect, and scan tags in realtime" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl space-y-4">
          {message && <div className="rounded-lg border bg-[hsl(var(--card))] p-3 text-xs">{message}</div>}

          <div className="rounded-lg border bg-[hsl(var(--card))] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Network Scanner</p>
              <span
                className={`text-[11px] px-2 py-1 rounded-full border ${
                  scannerConnection?.connected
                    ? scannerConnection.scanning
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-gray-50 text-gray-700 border-gray-200"
                }`}
              >
                {!scannerConnection?.connected ? "Disconnected" : scannerConnection.scanning ? "Scanning" : "Connected"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                className="h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]"
                placeholder="Port"
                value={scannerPort}
                onChange={(e) => setScannerPort(e.target.value)}
              />
              <Button
                size="sm"
                className="h-9 bg-[#1faca6] hover:bg-[#17857f] text-white"
                onClick={connectFromDiscovered}
                disabled={Boolean(scannerConnection?.connected)}
              >
                Connect First Discovered Reader
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => discoverReaders(false)} disabled={discoveringReaders}>
                {discoveringReaders ? "Discovering..." : "Auto Discover"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => scannerAction("disconnect")} disabled={!scannerConnection?.connected}>
                Disconnect
              </Button>
              <Button size="sm" variant="outline" onClick={() => scannerAction("start_scan")} disabled={!scannerConnection?.connected || !!scannerConnection?.scanning}>
                Start Scan
              </Button>
              <Button size="sm" variant="outline" onClick={() => scannerAction("stop_scan")} disabled={!scannerConnection?.connected || !scannerConnection?.scanning}>
                Stop Scan
              </Button>
              <Button size="sm" variant="outline" onClick={() => scannerAction("clear_scans")}>
                Clear
              </Button>
              {detectedSubnet && (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  Subnet: {detectedSubnet}.x
                </span>
              )}
            </div>

            <div className="rounded border bg-[hsl(var(--background))] p-2">
              <p className="text-xs font-medium mb-1">Discovered Readers</p>
              {discoveredReaders.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No reader found yet. Click Auto Discover.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {discoveredReaders.map((reader) => (
                    <button
                      key={`${reader.ip}:${reader.port}`}
                      className="h-8 px-2 text-xs rounded border hover:bg-[hsl(var(--accent))]"
                      onClick={() => connectAndStart(reader.ip, reader.port)}
                    >
                      Connect {reader.ip}:{reader.port}
                      {reader.latency_ms > 0 ? ` (${reader.latency_ms}ms)` : reader.reachable ? "" : " (quick try)"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {scannerConnection?.connected && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Connected to {scannerConnection.readerIp}:{scannerConnection.readerPort} | {scannerConnection.scanning ? "Reading tags now" : "Connected"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
            <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Tag Grid</p>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {booting ? "Initializing..." : `${tagCount} unique / ${readCount} reads`}
                </span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Type</th>
                      <th className="text-left py-2">EPC</th>
                      <th className="text-left py-2">TID</th>
                      <th className="text-left py-2">UserData</th>
                      <th className="text-left py-2">ReserveData</th>
                      <th className="text-left py-2">TotalCount</th>
                      <th className="text-left py-2">ANT1</th>
                      <th className="text-left py-2">ANT2</th>
                      <th className="text-left py-2">ANT3</th>
                      <th className="text-left py-2">ANT4</th>
                      <th className="text-left py-2">RSSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveScans.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-[hsl(var(--muted-foreground))]">
                          Waiting for tags...
                        </td>
                      </tr>
                    ) : (
                      liveScans.map((scan, index) => (
                        <tr key={scan.id} className="border-b last:border-0">
                          <td className="py-1.5">6C</td>
                          <td className="py-1.5">{scan.epc}</td>
                          <td className="py-1.5">-</td>
                          <td className="py-1.5">-</td>
                          <td className="py-1.5">-</td>
                          <td className="py-1.5">{readCount - index}</td>
                          <td className="py-1.5">{scan.antenna === "1" ? 1 : 0}</td>
                          <td className="py-1.5">{scan.antenna === "2" ? 1 : 0}</td>
                          <td className="py-1.5">{scan.antenna === "3" ? 1 : 0}</td>
                          <td className="py-1.5">{scan.antenna === "4" ? 1 : 0}</td>
                          <td className="py-1.5">{scan.rssi ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border bg-[hsl(var(--card))] p-3">
                <p className="text-xs font-semibold mb-2">Control (Antenna)</p>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((ant) => (
                    <label key={ant} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={selectedAntennas.includes(ant)} onChange={() => toggleAntenna(ant)} />
                      ANT{ant}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedAntennas([1, 2, 3, 4])}>
                    Check All
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedAntennas([])}>
                    Uncheck All
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-[hsl(var(--card))] p-3">
                <p className="text-xs font-semibold mb-2">Read Type</p>
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={readType === "inventory"} onChange={() => setReadType("inventory")} />
                    Inventory
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={readType === "single"} onChange={() => setReadType("single")} />
                    Single
                  </label>
                </div>
              </div>

              <div className="rounded-lg border bg-[hsl(var(--card))] p-3">
                <p className="text-xs font-semibold mb-2">Tag Type</p>
                <div className="flex gap-3 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={tagType === "6c"} onChange={() => setTagType("6c")} />
                    6C Tag
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={tagType === "6b"} onChange={() => setTagType("6b")} />
                    6B Tag
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={tagType === "gb"} onChange={() => setTagType("gb")} />
                    GB Tag
                  </label>
                </div>
              </div>

              <div className="rounded-lg border bg-[hsl(var(--card))] p-3">
                <p className="text-xs font-semibold mb-2">Realtime</p>
                <div className="space-y-1.5 text-sm">
                  <p>TagCount: <span className="font-semibold">{tagCount}</span></p>
                  <p>ReadCount: <span className="font-semibold">{readCount}</span></p>
                  <p>Speed(T/S): <span className="font-semibold">{speedPerSecond}</span></p>
                  <p>Time(S): <span className="font-semibold">{elapsedLabel}</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModuleGuard>
  )
}
