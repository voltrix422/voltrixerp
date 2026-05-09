"use client"

import { useEffect, useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { Button } from "@/components/ui/button"

type RfidTag = {
  id: string
  epc: string
  sku: string
  item_description: string
  status: string
  warehouse: string
  dispatch_id: string | null
  invoice_number: string | null
  updated_at: string
}

type GateEvent = {
  id: string
  epc: string
  gate_name: string
  decision: string
  trigger_alarm: boolean
  reason: string
  scanned_at: string
}

export default function RfidPage() {
  const [tags, setTags] = useState<RfidTag[]>([])
  const [events, setEvents] = useState<GateEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [registerEpc, setRegisterEpc] = useState("")
  const [registerSku, setRegisterSku] = useState("")
  const [registerDescription, setRegisterDescription] = useState("")
  const [registerWarehouse, setRegisterWarehouse] = useState("MAIN")

  const [authorizeEpcs, setAuthorizeEpcs] = useState("")
  const [authorizeDispatchId, setAuthorizeDispatchId] = useState("")
  const [authorizeOrderId, setAuthorizeOrderId] = useState("")
  const [authorizeInvoice, setAuthorizeInvoice] = useState("")
  const [authorizeMinutes, setAuthorizeMinutes] = useState("120")

  const [gateEpc, setGateEpc] = useState("")
  const [gateName, setGateName] = useState("MAIN_GATE")
  const [gateResult, setGateResult] = useState<null | {
    decision: string
    triggerAlarm: boolean
    reason: string
  }>(null)

  async function loadData() {
    const [tagsRes, eventsRes] = await Promise.all([fetch("/api/rfid/tags"), fetch("/api/rfid/events")])
    const [tagsData, eventsData] = await Promise.all([tagsRes.json(), eventsRes.json()])
    setTags(Array.isArray(tagsData) ? tagsData : [])
    setEvents(Array.isArray(eventsData) ? eventsData : [])
  }

  useEffect(() => {
    loadData()
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  async function registerTag() {
    const epc = registerEpc.trim().toUpperCase()
    if (!epc) return

    const res = await fetch("/api/rfid/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        epc,
        sku: registerSku.trim(),
        item_description: registerDescription.trim(),
        warehouse: registerWarehouse.trim(),
        status: "IN_STOCK",
        updated_by: "erp_user",
      }),
    })
    if (!res.ok) {
      setMessage("Failed to register tag")
      return
    }
    setMessage(`Tag ${epc} registered`)
    setRegisterEpc("")
    await loadData()
  }

  async function authorizeDispatch() {
    const epcs = authorizeEpcs
      .split(/[\n,]+/)
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean)

    if (epcs.length === 0) return

    const res = await fetch("/api/rfid/authorize-dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        epcs,
        dispatch_id: authorizeDispatchId.trim(),
        order_id: authorizeOrderId.trim(),
        invoice_number: authorizeInvoice.trim(),
        valid_minutes: Number(authorizeMinutes) || 120,
        authorized_by: "erp_user",
      }),
    })
    if (!res.ok) {
      setMessage("Failed to authorize dispatch")
      return
    }
    setMessage(`Authorized ${epcs.length} tag(s) for dispatch`)
    await loadData()
  }

  async function runGateCheck() {
    const epc = gateEpc.trim().toUpperCase()
    if (!epc) return

    const res = await fetch("/api/rfid/gate-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        epc,
        gate_name: gateName.trim() || "MAIN_GATE",
        scanned_by: "gate_operator",
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || "Gate check failed")
      return
    }

    setGateResult({
      decision: data.decision,
      triggerAlarm: Boolean(data.triggerAlarm),
      reason: String(data.reason || ""),
    })
    setMessage(`Gate check: ${data.decision}`)
    await loadData()
  }

  return (
    <ModuleGuard module="inventory">
      <Topbar title="RFID Control" description="Register tags, authorize dispatch, and verify gate exits" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl space-y-4">
          {message && <div className="rounded-lg border bg-[hsl(var(--card))] p-3 text-xs">{message}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-[hsl(var(--card))] p-4 space-y-2">
              <p className="text-sm font-semibold">1) Register Tag</p>
              <input className="w-full h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]" placeholder="EPC (scan here)" value={registerEpc} onChange={(e) => setRegisterEpc(e.target.value)} />
              <input className="w-full h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]" placeholder="SKU" value={registerSku} onChange={(e) => setRegisterSku(e.target.value)} />
              <input className="w-full h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]" placeholder="Item description" value={registerDescription} onChange={(e) => setRegisterDescription(e.target.value)} />
              <input className="w-full h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]" placeholder="Warehouse" value={registerWarehouse} onChange={(e) => setRegisterWarehouse(e.target.value)} />
              <Button size="sm" className="w-full bg-[#1faca6] hover:bg-[#17857f] text-white" onClick={registerTag}>Save Tag</Button>
            </div>

            <div className="rounded-lg border bg-[hsl(var(--card))] p-4 space-y-2">
              <p className="text-sm font-semibold">2) Authorize Dispatch</p>
              <textarea className="w-full rounded border px-3 py-2 text-sm bg-[hsl(var(--background))]" rows={4} placeholder="EPCs (comma/new line)" value={authorizeEpcs} onChange={(e) => setAuthorizeEpcs(e.target.value)} />
              <input className="w-full h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]" placeholder="Dispatch ID" value={authorizeDispatchId} onChange={(e) => setAuthorizeDispatchId(e.target.value)} />
              <input className="w-full h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]" placeholder="Order ID" value={authorizeOrderId} onChange={(e) => setAuthorizeOrderId(e.target.value)} />
              <input className="w-full h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]" placeholder="Invoice number" value={authorizeInvoice} onChange={(e) => setAuthorizeInvoice(e.target.value)} />
              <input className="w-full h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]" placeholder="Valid minutes" value={authorizeMinutes} onChange={(e) => setAuthorizeMinutes(e.target.value)} />
              <Button size="sm" className="w-full bg-[#1faca6] hover:bg-[#17857f] text-white" onClick={authorizeDispatch}>Authorize Tags</Button>
            </div>

            <div className="rounded-lg border bg-[hsl(var(--card))] p-4 space-y-2">
              <p className="text-sm font-semibold">3) Gate Check</p>
              <input className="w-full h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]" placeholder="EPC to verify" value={gateEpc} onChange={(e) => setGateEpc(e.target.value)} />
              <input className="w-full h-9 rounded border px-3 text-sm bg-[hsl(var(--background))]" placeholder="Gate name" value={gateName} onChange={(e) => setGateName(e.target.value)} />
              <Button size="sm" className="w-full bg-[#1faca6] hover:bg-[#17857f] text-white" onClick={runGateCheck}>Run Gate Check</Button>
              {gateResult && (
                <div className={`rounded border p-2 text-xs ${gateResult.decision === "ALLOW" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                  <p><strong>Decision:</strong> {gateResult.decision}</p>
                  <p><strong>Alarm:</strong> {gateResult.triggerAlarm ? "ON" : "OFF"}</p>
                  <p><strong>Reason:</strong> {gateResult.reason}</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <p className="text-sm font-semibold mb-3">Registered Tags</p>
              {loading ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading...</p>
              ) : tags.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No tags registered yet.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">EPC</th>
                        <th className="text-left py-2">SKU</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-left py-2">Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tags.map((tag) => (
                        <tr key={tag.id} className="border-b last:border-0">
                          <td className="py-2">{tag.epc}</td>
                          <td className="py-2">{tag.sku || "-"}</td>
                          <td className="py-2">{tag.status}</td>
                          <td className="py-2">{tag.invoice_number || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <p className="text-sm font-semibold mb-3">Gate Events</p>
              {loading ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading...</p>
              ) : events.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No events recorded yet.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Time</th>
                        <th className="text-left py-2">EPC</th>
                        <th className="text-left py-2">Decision</th>
                        <th className="text-left py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.id} className="border-b last:border-0">
                          <td className="py-2">{new Date(event.scanned_at).toLocaleString()}</td>
                          <td className="py-2">{event.epc}</td>
                          <td className="py-2">{event.decision}</td>
                          <td className="py-2">{event.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModuleGuard>
  )
}
