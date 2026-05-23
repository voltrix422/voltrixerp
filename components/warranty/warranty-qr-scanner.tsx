"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Camera, CameraOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  readerId?: string
  onScan: (payload: string) => void | Promise<void>
  disabled?: boolean
  busy?: boolean
}

export function WarrantyQrScanner({
  readerId = "warranty-qr-reader",
  onScan,
  disabled,
  busy,
}: Props) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState("")
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScanRef = useRef("")

  useEffect(() => {
    return () => {
      void stopScanner()
    }
  }, [])

  async function waitForMount() {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  }

  async function resolveCameraId() {
    try {
      const cameras = await Html5Qrcode.getCameras()
      if (cameras.length === 0) return { facingMode: "environment" as const }
      const preferred = cameras.find((c) => /back|rear|environment/i.test(c.label))
      return preferred?.id || cameras[0].id
    } catch {
      return { facingMode: "environment" as const }
    }
  }

  async function stopScanner() {
    const scanner = scannerRef.current
    scannerRef.current = null
    setScanning(false)
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
      scanner.clear()
    } catch {
      // ignore
    }
  }

  async function startScanner() {
    if (scanning || disabled || busy) return
    setError("")
    setScanning(true)
    await waitForMount()
    try {
      const scanner = new Html5Qrcode(readerId, { verbose: false })
      scannerRef.current = scanner
      const cameraId = await resolveCameraId()
      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          const payload = text.trim()
          if (!payload || payload === lastScanRef.current) return
          lastScanRef.current = payload
          void onScan(payload)
          setTimeout(() => {
            lastScanRef.current = ""
          }, 2500)
        },
        () => undefined,
      )
    } catch {
      setError("Could not open camera. Paste serial or warranty ID below.")
      setScanning(false)
      scannerRef.current = null
    }
  }

  return (
    <div className="space-y-3">
      <div
        id={readerId}
        className="w-full max-w-sm mx-auto aspect-square rounded-xl overflow-hidden border bg-black/90"
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400 text-center">{error}</p>}
      <div className="flex justify-center gap-2">
        {scanning ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 text-xs"
            onClick={() => void stopScanner()}
            disabled={busy}
          >
            <CameraOff className="h-3.5 w-3.5 mr-1.5" />
            Stop camera
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-9 text-xs bg-[#1a9f9a] hover:bg-[#158a85] text-white"
            onClick={() => void startScanner()}
            disabled={disabled || busy}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5 mr-1.5" />
            )}
            {busy ? "Processing…" : "Open QR scanner"}
          </Button>
        )}
      </div>
    </div>
  )
}
