"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { parseProductQrPayload } from "@/lib/parse-product-qr"
import {
  createWarrantyClaim,
  getInventorySerialUnits,
  getWarrantyClaims,
  saveInventorySerialUnit,
  type InventorySerialUnit,
  type WarrantyClaim,
} from "@/lib/inventory-serial-units"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"
import { Camera, QrCode, Save, ShieldAlert, Loader2 } from "lucide-react"

type ManualStockOption = {
  id: string
  description: string
  poNumber?: string
}

type Props = {
  manualStockItems: ManualStockOption[]
}

export function InventoryQrScanPanel({ manualStockItems }: Props) {
  const { user } = useAuth()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [units, setUnits] = useState<InventorySerialUnit[]>([])
  const [claims, setClaims] = useState<WarrantyClaim[]>([])
  const [rawPayload, setRawPayload] = useState("")
  const [serialNumber, setSerialNumber] = useState("")
  const [productName, setProductName] = useState("")
  const [model, setModel] = useState("")
  const [specs, setSpecs] = useState("")
  const [assignedName, setAssignedName] = useState("")
  const [inventoryStockId, setInventoryStockId] = useState("")
  const [notes, setNotes] = useState("")
  const [claimUnit, setClaimUnit] = useState<InventorySerialUnit | null>(null)
  const [claimReason, setClaimReason] = useState("")
  const [claimNotes, setClaimNotes] = useState("")
  const [claimSaving, setClaimSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    loadRecords()
    return () => {
      stopScanner()
    }
  }, [])

  async function loadRecords() {
    setLoading(true)
    try {
      const [unitRows, claimRows] = await Promise.all([
        getInventorySerialUnits(),
        getWarrantyClaims(),
      ])
      setUnits(unitRows)
      setClaims(claimRows)
    } catch (loadError) {
      console.error(loadError)
      setError("Failed to load scanned units.")
    } finally {
      setLoading(false)
    }
  }

  function applyPayload(payload: string) {
    const parsed = parseProductQrPayload(payload)
    setRawPayload(payload)
    setSerialNumber(parsed.serialNumber)
    setProductName(parsed.productName)
    setModel(parsed.model)
    setSpecs(parsed.specs)
    if (!notes && parsed.notes) setNotes(parsed.notes)
    if (!assignedName && parsed.productName) setAssignedName(parsed.productName)
    setError("")
  }

  async function startScanner() {
    setError("")
    try {
      const scanner = new Html5Qrcode("inventory-qr-reader")
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          applyPayload(decodedText)
          stopScanner()
        },
        () => undefined
      )
      setScanning(true)
    } catch (scanError) {
      console.error(scanError)
      setError("Could not open the camera. Paste the QR text below instead.")
    }
  }

  async function stopScanner() {
    if (!scannerRef.current) {
      setScanning(false)
      return
    }
    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop()
      }
      await scannerRef.current.clear()
    } catch {
      // Ignore cleanup errors.
    }
    scannerRef.current = null
    setScanning(false)
  }

  async function handleSave() {
    if (!serialNumber.trim()) {
      setError("Serial number is required.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const saved = await saveInventorySerialUnit({
        serialNumber: serialNumber.trim(),
        assignedName: assignedName.trim(),
        productName: productName.trim(),
        model: model.trim(),
        specs: specs.trim(),
        rawPayload,
        inventoryStockId: inventoryStockId || undefined,
        notes: notes.trim(),
        scannedBy: user?.name || "system",
        createWarranty: true,
      })
      setUnits((prev) => [saved, ...prev])
      setRawPayload("")
      setSerialNumber("")
      setProductName("")
      setModel("")
      setSpecs("")
      setAssignedName("")
      setInventoryStockId("")
      setNotes("")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save scanned unit.")
    } finally {
      setSaving(false)
    }
  }

  async function submitClaim() {
    if (!claimUnit || !claimReason.trim()) return
    setClaimSaving(true)
    try {
      const claim = await createWarrantyClaim({
        unitId: claimUnit.id,
        serialNumber: claimUnit.serialNumber,
        claimReason: claimReason.trim(),
        notes: claimNotes.trim(),
        claimedBy: user?.name || "system",
      })
      setClaims((prev) => [claim, ...prev])
      setUnits((prev) => prev.map((unit) => unit.id === claimUnit.id ? { ...unit, status: "claim_pending" } : unit))
      setClaimUnit(null)
      setClaimReason("")
      setClaimNotes("")
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Failed to submit warranty claim.")
    } finally {
      setClaimSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-[hsl(var(--card))] p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[#1faca6]" />
              Scan product QR
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Each scan registers one unit with serial number, product details, and warranty.
            </p>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={scanning ? stopScanner : startScanner}>
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            {scanning ? "Stop camera" : "Open camera"}
          </Button>
        </div>

        <div id="inventory-qr-reader" className={`overflow-hidden rounded-lg border bg-black/5 ${scanning ? "min-h-[260px]" : "hidden"}`} />

        <div className="space-y-2">
          <label className="text-xs font-medium">QR payload</label>
          <textarea
            value={rawPayload}
            onChange={(e) => applyPayload(e.target.value)}
            rows={3}
            placeholder="Scan a QR code or paste its text / JSON here"
            className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Serial number *</label>
            <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="w-full h-9 rounded-md border px-3 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Assigned name</label>
            <input value={assignedName} onChange={(e) => setAssignedName(e.target.value)} className="w-full h-9 rounded-md border px-3 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Product name</label>
            <input value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full h-9 rounded-md border px-3 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Model</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full h-9 rounded-md border px-3 text-sm" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Specifications</label>
            <input value={specs} onChange={(e) => setSpecs(e.target.value)} className="w-full h-9 rounded-md border px-3 text-sm" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Link to manual stock item</label>
            <select value={inventoryStockId} onChange={(e) => setInventoryStockId(e.target.value)} className="w-full h-9 rounded-md border px-3 text-sm">
              <option value="">No stock link</option>
              {manualStockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.description} {item.poNumber ? `(${item.poNumber})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border px-3 py-2 text-sm resize-none" />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <Button size="sm" className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Save scanned unit
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-[hsl(var(--muted))]/40">
          <p className="text-sm font-semibold">Scanned units</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : units.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] px-4 py-8">No QR units registered yet.</p>
        ) : (
          <div className="divide-y">
            {units.map((unit) => (
              <div key={unit.id} className="px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">{unit.assignedName || unit.productName || unit.serialNumber}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">SN: {unit.serialNumber}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {unit.productName}{unit.model ? ` · ${unit.model}` : ""}{unit.specs ? ` · ${unit.specs}` : ""}
                  </p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                    Scanned {new Date(unit.scannedAt).toLocaleString()} by {unit.scannedBy}
                    {unit.warrantyId ? ` · Warranty ${unit.warrantyId}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">{unit.status.replace(/_/g, " ")}</Badge>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setClaimUnit(unit)}>
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Claim
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {claims.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-[hsl(var(--muted))]/40">
            <p className="text-sm font-semibold">Warranty claims</p>
          </div>
          <div className="divide-y">
            {claims.map((claim) => (
              <div key={claim.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">SN {claim.serialNumber}</p>
                  <Badge variant="secondary" className="text-[10px] capitalize">{claim.status}</Badge>
                </div>
                <p className="text-xs mt-1">{claim.claimReason}</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                  Filed {new Date(claim.createdAt).toLocaleString()} by {claim.claimedBy}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {claimUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setClaimUnit(null)}>
          <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold">Warranty claim for {claimUnit.serialNumber}</p>
            <textarea
              value={claimReason}
              onChange={(e) => setClaimReason(e.target.value)}
              rows={3}
              placeholder="Describe the issue"
              className="w-full rounded-md border px-3 py-2 text-sm resize-none"
            />
            <textarea
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes"
              className="w-full rounded-md border px-3 py-2 text-sm resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setClaimUnit(null)}>Cancel</Button>
              <Button size="sm" onClick={submitClaim} disabled={claimSaving || !claimReason.trim()}>
                {claimSaving ? "Submitting..." : "Submit claim"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
