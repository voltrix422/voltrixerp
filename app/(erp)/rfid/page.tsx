"use client"

import { useEffect, useState } from "react"
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

  async function loadScannerStatus() {
    const res = await fetch("/api/rfid/scanner")
    if (!res.ok) return
    const data = await res.json()
    setScannerConnection(data.connection || null)
    setLiveScans(Array.isArray(data.scans) ? data.scans : [])
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
          setMessage("No scanner found on local network.")
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
                      Connect {reader.ip}:{reader.port}{reader.latency_ms > 0 ? ` (${reader.latency_ms}ms)` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-[#1faca6] hover:bg-[#17857f] text-white"
                onClick={() => scannerAction("start_scan")}
                disabled={!scannerConnection?.connected || Boolean(scannerConnection?.scanning)}
              >
                Start Scan
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => scannerAction("stop_scan")}
                disabled={!scannerConnection?.connected || !scannerConnection?.scanning}
              >
                Stop Scan
              </Button>
              <Button size="sm" variant="outline" onClick={() => scannerAction("clear_scans")}>
                Clear Live Tags
              </Button>
            </div>

            {scannerConnection?.connected && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Connected to {scannerConnection.readerIp}:{scannerConnection.readerPort} | {scannerConnection.scanning ? "Reading tags now" : "Ready"}
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Live Tags</p>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {booting ? "Initializing..." : `${liveScans.length} tag(s) detected`}
              </span>
            </div>
            {liveScans.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Waiting for tags...</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Time</th>
                      <th className="text-left py-2">EPC</th>
                      <th className="text-left py-2">Reader</th>
                      <th className="text-left py-2">Antenna</th>
                      <th className="text-left py-2">RSSI</th>
                      <th className="text-left py-2">Freq</th>
                      <th className="text-left py-2">Protocol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveScans.map((scan) => (
                      <tr key={scan.id} className="border-b last:border-0">
                        <td className="py-2">{new Date(scan.seenAt).toLocaleTimeString()}</td>
                        <td className="py-2">{scan.epc}</td>
                        <td className="py-2">{scan.readerIp}:{scan.readerPort}</td>
                        <td className="py-2">{scan.antenna || "-"}</td>
                        <td className="py-2">{scan.rssi ?? "-"}</td>
                        <td className="py-2">{scan.frequency ?? "-"}</td>
                        <td className="py-2">{scan.protocol || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModuleGuard>
  )
}
