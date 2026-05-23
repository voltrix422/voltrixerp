"use client"

import { useState } from "react"
import { Shield, PlayCircle, FileWarning, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WarrantyQrScanner } from "@/components/warranty/warranty-qr-scanner"
import { useAuth } from "@/components/auth-provider"
import { createWarrantyClaim } from "@/lib/inventory-serial-units"

type Tab = "start" | "claim"

type WarrantyRow = {
  warrantyId?: string
  serialNumber?: string
  productName?: string
  customerName?: string
  warrantyStartDate?: string
  warrantyEndDate?: string
}

export function BranchWarrantyHub() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>("start")
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState("")
  const [claimReason, setClaimReason] = useState("")
  const [claimNotes, setClaimNotes] = useState("")
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [lastWarranty, setLastWarranty] = useState<WarrantyRow | null>(null)
  const [claimUnitId, setClaimUnitId] = useState<string | null>(null)
  const [claimSerial, setClaimSerial] = useState("")

  async function handleStartScan(payload: string) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/warranty/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan: payload,
          activatedBy: user?.name || "Branch",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Could not start warranty" })
        return
      }
      setLastWarranty(data.warranty)
      setMessage({
        type: "ok",
        text: data.alreadyActive
          ? "Warranty was already active for this unit."
          : "Warranty started successfully. Customer can now check it online.",
      })
    } catch {
      setMessage({ type: "err", text: "Network error. Try again." })
    } finally {
      setBusy(false)
    }
  }

  async function resolveUnitForClaim(serialOrScan: string) {
    const res = await fetch(
      `/api/db/inventory-serial-units?serialNumber=${encodeURIComponent(serialOrScan)}`,
    )
    if (!res.ok) return null
    const units = await res.json()
    const unit = Array.isArray(units) ? units[0] : null
    return unit as { id: string; serialNumber: string; status: string } | null
  }

  async function handleClaimScan(payload: string) {
    setBusy(true)
    setMessage(null)
    try {
      const lookup = await fetch(`/api/warranty/lookup?id=${encodeURIComponent(payload)}`)
      let serial = payload
      if (lookup.ok) {
        const w = await lookup.json()
        serial = w.serialNumber || payload
      }
      const unit = await resolveUnitForClaim(serial)
      if (!unit) {
        setMessage({ type: "err", text: "Serial not found in system." })
        return
      }
      setClaimUnitId(unit.id)
      setClaimSerial(unit.serialNumber)
      setMessage({
        type: "ok",
        text: `Unit ${unit.serialNumber} selected. Enter claim reason and submit.`,
      })
    } catch {
      setMessage({ type: "err", text: "Could not read scan." })
    } finally {
      setBusy(false)
    }
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault()
    if (!claimUnitId || !claimSerial || !claimReason.trim()) {
      setMessage({ type: "err", text: "Scan a unit and enter a claim reason." })
      return
    }
    setBusy(true)
    try {
      await createWarrantyClaim({
        unitId: claimUnitId,
        serialNumber: claimSerial,
        claimReason: claimReason.trim(),
        notes: claimNotes.trim(),
        claimedBy: user?.name || "Branch",
      })
      setMessage({ type: "ok", text: "Warranty claim submitted for review." })
      setClaimReason("")
      setClaimNotes("")
      setClaimUnitId(null)
      setClaimSerial("")
    } catch {
      setMessage({ type: "err", text: "Failed to submit claim." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-lg border bg-[#1a9f9a]/5 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-[#1a9f9a]" />
          <h2 className="text-base font-bold">Branch warranty</h2>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Scan the product QR after dispatch to <strong>start</strong> the 5-year warranty. Customers can then check status at voltrixbatteries.com/warranty.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => {
            setTab("start")
            setMessage(null)
          }}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium relative ${
            tab === "start" ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <PlayCircle className="h-3.5 w-3.5" />
          Start warranty
          {tab === "start" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a9f9a]" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("claim")
            setMessage(null)
          }}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium relative ${
            tab === "claim" ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <FileWarning className="h-3.5 w-3.5" />
          Claim warranty
          {tab === "claim" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a9f9a]" />}
        </button>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${
            message.type === "ok"
              ? "border-green-200 bg-green-50 text-green-900 dark:bg-green-950/40"
              : "border-red-200 bg-red-50 text-red-800 dark:bg-red-950/40"
          }`}
        >
          {message.type === "ok" ? (
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <FileWarning className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          {message.text}
        </div>
      )}

      {tab === "start" && (
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Product QR should link to warranty check. When the customer receives the unit, scan here once — warranty period starts <strong>today</strong>.
          </p>
          <WarrantyQrScanner
            readerId="branch-warranty-start-reader"
            onScan={handleStartScan}
            busy={busy}
          />
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Or paste serial / scan text"
              className="flex-1 h-9 px-3 text-sm border rounded-lg bg-[hsl(var(--background))]"
            />
            <Button
              type="button"
              size="sm"
              className="h-9 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
              disabled={busy || !manual.trim()}
              onClick={() => void handleStartScan(manual)}
            >
              Start
            </Button>
          </div>
          {lastWarranty && (
            <div className="rounded-lg bg-[hsl(var(--muted))]/30 p-3 text-xs space-y-1">
              <p className="font-semibold">{lastWarranty.productName}</p>
              <p className="font-mono">{lastWarranty.serialNumber}</p>
              <p>ID: {lastWarranty.warrantyId}</p>
              {lastWarranty.customerName && <p>Customer: {lastWarranty.customerName}</p>}
            </div>
          )}
        </div>
      )}

      {tab === "claim" && (
        <form onSubmit={submitClaim} className="space-y-4 rounded-lg border p-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Scan the product to open a warranty claim ticket.
          </p>
          <WarrantyQrScanner
            readerId="branch-warranty-claim-reader"
            onScan={handleClaimScan}
            busy={busy}
          />
          {claimSerial && (
            <p className="text-xs font-mono text-[#1a9f9a]">Selected: {claimSerial}</p>
          )}
          <div className="space-y-2">
            <label className="text-xs font-medium">Claim reason *</label>
            <input
              required
              value={claimReason}
              onChange={(e) => setClaimReason(e.target.value)}
              className="w-full h-9 px-3 text-sm border rounded-lg"
              placeholder="e.g. Battery not holding charge"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Notes</label>
            <textarea
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border rounded-lg resize-none"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="w-full h-9 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
            disabled={busy}
          >
            Submit claim
          </Button>
        </form>
      )}
    </div>
  )
}
