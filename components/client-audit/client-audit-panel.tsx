"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Loader2,
  Search,
  Plus,
  ArrowLeft,
  Save,
  CheckCircle2,
  Trash2,
  History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/ui/toast"
import { getClients, type Client } from "@/lib/crm"
import {
  recomputeLine,
  summarizeAuditLines,
  type ClientAuditLine,
  type ClientAuditRecord,
  type ClientStockSnapshot,
} from "@/lib/client-audit"
import { SignaturePad } from "@/components/client-audit/signature-pad"

function fmt(n: number) {
  return `PKR ${(Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

function fmtQty(n: number) {
  return (Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })
}

function fmtDate(iso: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function newRateId() {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function ClientAuditPanel() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [q, setQ] = useState("")
  const [clientId, setClientId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<ClientStockSnapshot | null>(null)
  const [history, setHistory] = useState<ClientAuditRecord[]>([])
  const [loadingSnap, setLoadingSnap] = useState(false)
  const [mode, setMode] = useState<"overview" | "create" | "view">("overview")
  const [viewAudit, setViewAudit] = useState<ClientAuditRecord | null>(null)
  const [lines, setLines] = useState<ClientAuditLine[]>([])
  const [notes, setNotes] = useState("")
  const [signedByName, setSignedByName] = useState("")
  const [signature, setSignature] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoadingClients(true)
      try {
        const list = await getClients()
        if (mounted) setClients(list.filter((c) => c.status === "active"))
      } catch (e) {
        toast({
          type: "error",
          title: "Could not load clients",
          message: e instanceof Error ? e.message : "Error",
        })
      } finally {
        if (mounted) setLoadingClients(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [toast])

  const filteredClients = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return clients
    return clients.filter((c) =>
      [c.name, c.company, c.phone, c.city].join(" ").toLowerCase().includes(s),
    )
  }, [clients, q])

  const loadClient = useCallback(
    async (id: string) => {
      setLoadingSnap(true)
      setClientId(id)
      setMode("overview")
      setViewAudit(null)
      try {
        const [snapRes, histRes] = await Promise.all([
          fetch(`/api/db/client-audits?clientId=${encodeURIComponent(id)}&mode=snapshot`),
          fetch(`/api/db/client-audits?clientId=${encodeURIComponent(id)}`),
        ])
        const snapJson = await snapRes.json()
        const histJson = await histRes.json()
        if (!snapRes.ok) throw new Error(snapJson.error || "Snapshot failed")
        if (!histRes.ok) throw new Error(histJson.error || "History failed")
        setSnapshot(snapJson as ClientStockSnapshot)
        setHistory(Array.isArray(histJson) ? (histJson as ClientAuditRecord[]) : [])
      } catch (e) {
        toast({
          type: "error",
          title: "Could not load client audit",
          message: e instanceof Error ? e.message : "Error",
        })
        setSnapshot(null)
        setHistory([])
      } finally {
        setLoadingSnap(false)
      }
    },
    [toast],
  )

  function startCreate() {
    if (!snapshot) return
    setLines(snapshot.lines.map((l) => recomputeLine({ ...l, soldRates: [] })))
    setNotes("")
    setSignedByName(snapshot.clientName)
    setSignature(null)
    setMode("create")
  }

  function updateLine(itemKey: string, patch: Partial<ClientAuditLine>) {
    setLines((prev) =>
      prev.map((l) => (l.itemKey === itemKey ? recomputeLine({ ...l, ...patch }) : l)),
    )
  }

  function addSoldRate(itemKey: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.itemKey !== itemKey) return l
        return recomputeLine({
          ...l,
          soldRates: [...(l.soldRates || []), { id: newRateId(), qty: 0, unitPrice: l.bookUnitPrice || 0 }],
        })
      }),
    )
  }

  function updateSoldRate(
    itemKey: string,
    rateId: string,
    patch: { qty?: number; unitPrice?: number },
  ) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.itemKey !== itemKey) return l
        return recomputeLine({
          ...l,
          soldRates: (l.soldRates || []).map((r) =>
            r.id === rateId ? { ...r, ...patch } : r,
          ),
        })
      }),
    )
  }

  function removeSoldRate(itemKey: string, rateId: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.itemKey !== itemKey) return l
        return recomputeLine({
          ...l,
          soldRates: (l.soldRates || []).filter((r) => r.id !== rateId),
        })
      }),
    )
  }

  const draftTotals = useMemo(() => summarizeAuditLines(lines), [lines])

  async function saveAudit(finalize: boolean) {
    if (!snapshot || !clientId) return
    if (finalize) {
      for (const l of lines) {
        if (l.soldQty > l.availableQty + 0.001) {
          toast({
            type: "error",
            title: "Sold exceeds stock",
            message: `${l.itemLabel}: sold ${fmtQty(l.soldQty)} but only ${fmtQty(l.availableQty)} available`,
          })
          return
        }
      }
      if (!signedByName.trim()) {
        toast({ type: "error", title: "Signer name required", message: "Enter who is signing." })
        return
      }
      if (!signature) {
        toast({ type: "error", title: "Signature required", message: "Client must sign before finalize." })
        return
      }
    }
    setSaving(true)
    try {
      const res = await fetch("/api/db/client-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          lines,
          notes,
          signedByName,
          signatureDataUrl: signature,
          status: finalize ? "finalized" : "draft",
          creditAmount: snapshot.creditTotal,
          orderIds: snapshot.orders.map((o) => o.id),
          createdBy: user?.name || user?.email || "",
          createdByUserId: user?.id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Save failed")
      toast({
        type: "success",
        title: finalize ? "Audit finalized" : "Draft saved",
        message: finalize ? "Signed and locked for this period." : "You can finalize later.",
      })
      await loadClient(clientId)
    } catch (e) {
      toast({
        type: "error",
        title: "Save failed",
        message: e instanceof Error ? e.message : "Error",
      })
    } finally {
      setSaving(false)
    }
  }

  // ——— Client list ———
  if (!clientId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Client audit</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Select a client to reconcile stock given, sold (any rates), left, and credit — with signature history.
          </p>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            className="w-full h-9 rounded-md border bg-transparent pl-8 pr-3 text-sm"
            placeholder="Search client…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {loadingClients ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : (
          <div className="rounded-lg border divide-y max-h-[70vh] overflow-auto">
            {filteredClients.length === 0 ? (
              <p className="text-sm text-center py-10 text-[hsl(var(--muted-foreground))]">No clients found.</p>
            ) : (
              filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-[hsl(var(--muted))]/30 transition-colors"
                  onClick={() => void loadClient(c.id)}
                >
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    {[c.company, c.phone, c.city].filter(Boolean).join(" · ") || "—"}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  if (loadingSnap || !snapshot) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  // ——— View past audit ———
  if (mode === "view" && viewAudit) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              setMode("overview")
              setViewAudit(null)
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{snapshot.clientName}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Audit · {fmtDate(viewAudit.auditDate)} · {viewAudit.status}
            </p>
          </div>
        </div>
        <AuditSummaryCards
          given={viewAudit.stockGivenQty}
          sold={viewAudit.stockSoldQty}
          left={viewAudit.stockLeftQty}
          soldAmt={viewAudit.soldAmount}
          leftAmt={viewAudit.leftAmount}
          credit={viewAudit.creditAmount}
        />
        <LinesTable lines={viewAudit.lines} readOnly />
        {viewAudit.notes ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] whitespace-pre-wrap border rounded-md p-3">
            {viewAudit.notes}
          </p>
        ) : null}
        {viewAudit.signatureDataUrl ? (
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs font-medium">Signed by {viewAudit.signedByName || "—"}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewAudit.signatureDataUrl} alt="Signature" className="max-h-28 border rounded bg-white" />
          </div>
        ) : null}
      </div>
    )
  }

  // ——— Create audit ———
  if (mode === "create") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setMode("overview")}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <div>
              <p className="text-sm font-semibold">New audit · {snapshot.clientName}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {snapshot.previousAudit
                  ? `Opening from ${fmtDate(snapshot.previousAudit.auditDate)} + stock given since`
                  : "First audit · all stock given to date"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={saving}
              onClick={() => void saveAudit(false)}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save draft
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
              disabled={saving}
              onClick={() => void saveAudit(true)}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Finalize &amp; sign
            </Button>
          </div>
        </div>

        <AuditSummaryCards
          given={draftTotals.stockGivenQty}
          sold={draftTotals.stockSoldQty}
          left={draftTotals.stockLeftQty}
          soldAmt={draftTotals.soldAmount}
          leftAmt={draftTotals.leftAmount}
          credit={snapshot.creditTotal}
        />

        <div className="space-y-3">
          {lines.length === 0 ? (
            <p className="text-sm text-center py-8 text-[hsl(var(--muted-foreground))]">
              No stock on hand for this client yet.
            </p>
          ) : (
            lines.map((line) => (
              <div key={line.itemKey} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{line.itemLabel}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      Opening {fmtQty(line.openingQty)} + given {fmtQty(line.givenQty)} ={" "}
                      <strong>{fmtQty(line.availableQty)}</strong> · book {fmt(line.bookUnitPrice)}/{line.unit}
                    </p>
                  </div>
                  <div className="text-right text-[11px]">
                    <p>
                      Left <strong>{fmtQty(line.leftQty)}</strong> · {fmt(line.leftAmount)}
                    </p>
                    <p className="text-[hsl(var(--muted-foreground))]">
                      Sold {fmtQty(line.soldQty)} · {fmt(line.soldAmount)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      Sold (set qty &amp; rate)
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => addSoldRate(line.itemKey)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add rate
                    </Button>
                  </div>
                  {(line.soldRates || []).length === 0 ? (
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      No sales recorded this period — add a rate if they sold any.
                    </p>
                  ) : (
                    (line.soldRates || []).map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-2">
                        <label className="text-[11px] text-[hsl(var(--muted-foreground))]">Qty</label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="h-8 w-20 rounded-md border px-2 text-sm tabular-nums"
                          value={r.qty || ""}
                          onChange={(e) =>
                            updateSoldRate(line.itemKey, r.id, { qty: Number(e.target.value) || 0 })
                          }
                        />
                        <label className="text-[11px] text-[hsl(var(--muted-foreground))]">@ PKR</label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="h-8 w-28 rounded-md border px-2 text-sm tabular-nums"
                          value={r.unitPrice || ""}
                          onChange={(e) =>
                            updateSoldRate(line.itemKey, r.id, {
                              unitPrice: Number(e.target.value) || 0,
                            })
                          }
                        />
                        <span className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
                          = {fmt(r.qty * r.unitPrice)}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => removeSoldRate(line.itemKey, r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <label className="text-[11px] text-[hsl(var(--muted-foreground))]">Adjust left qty</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    className="h-8 w-24 rounded-md border px-2 text-sm tabular-nums"
                    value={line.leftQty}
                    onChange={(e) => {
                      const leftQty = Math.max(0, Number(e.target.value) || 0)
                      const soldQty = Math.max(0, line.availableQty - leftQty)
                      // If they adjust left directly without rates, fold into one sold rate at book price
                      updateLine(line.itemKey, {
                        soldRates:
                          soldQty > 0
                            ? [{ id: newRateId(), qty: soldQty, unitPrice: line.bookUnitPrice }]
                            : [],
                      })
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium">Notes</label>
            <textarea
              className="w-full min-h-[80px] rounded-md border bg-transparent px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional remarks for this visit…"
            />
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium">Signed by</label>
              <input
                className="w-full h-9 rounded-md border px-3 text-sm"
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                placeholder="Client name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium">Signature</label>
              <SignaturePad value={signature} onChange={setSignature} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ——— Overview ———
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            onClick={() => {
              setClientId(null)
              setSnapshot(null)
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Clients
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{snapshot.clientName}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {snapshot.orders.length} order{snapshot.orders.length === 1 ? "" : "s"} with stock · credit{" "}
              {fmt(snapshot.creditTotal)}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
          onClick={startCreate}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          New audit
        </Button>
      </div>

      <AuditSummaryCards
        given={snapshot.stockGivenQty}
        sold={snapshot.previousAudit?.stockSoldQty ?? 0}
        left={snapshot.stockLeftQty}
        soldAmt={snapshot.previousAudit?.soldAmount ?? 0}
        leftAmt={snapshot.lines.reduce((s, l) => s + l.leftAmount, 0)}
        credit={snapshot.creditTotal}
        labels={{
          sold: "Last audit sold",
          soldAmt: "Last audit sold amt",
        }}
      />

      {snapshot.previousAudit ? (
        <div className="rounded-lg border px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
          Last audit {fmtDate(snapshot.previousAudit.auditDate)} · left{" "}
          <strong className="text-[hsl(var(--foreground))]">
            {fmtQty(snapshot.previousAudit.stockLeftQty)}
          </strong>{" "}
          units · {fmt(snapshot.previousAudit.leftAmount)} · credit was{" "}
          {fmt(snapshot.previousAudit.creditAmount)}
        </div>
      ) : (
        <div className="rounded-lg border px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
          No prior audit — first visit will set the baseline from all stock given so far.
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Current stock with client
        </h3>
        <LinesTable lines={snapshot.lines} readOnly hideSold />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Orders
        </h3>
        <div className="rounded-lg border overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-[hsl(var(--muted))]/30">
              <tr className="text-left">
                <th className="px-2 py-2 font-medium">Order</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium text-right">Items</th>
                <th className="px-2 py-2 font-medium text-right">Total</th>
                <th className="px-2 py-2 font-medium text-right">Paid</th>
                <th className="px-2 py-2 font-medium text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-[hsl(var(--muted-foreground))]">
                    No delivered / confirmed orders for this client.
                  </td>
                </tr>
              ) : (
                snapshot.orders.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-2 py-1.5">
                      <span className="font-medium">{o.orderNumber}</span>
                      <span className="block text-[10px] text-[hsl(var(--muted-foreground))]">
                        {fmtDate(o.fulfillmentDate || o.deliveryDate || o.createdAt)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">{o.status}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{o.itemCount}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(o.total)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(o.paid)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(o.credit)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          Audit history
        </h3>
        <div className="rounded-lg border divide-y">
          {history.length === 0 ? (
            <p className="text-sm text-center py-8 text-[hsl(var(--muted-foreground))]">No audits yet.</p>
          ) : (
            history.map((a) => (
              <button
                key={a.id}
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-[hsl(var(--muted))]/25 flex flex-wrap items-center justify-between gap-2"
                onClick={() => {
                  setViewAudit(a)
                  setMode("view")
                }}
              >
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    {fmtDate(a.auditDate)}
                    <Badge variant={a.status === "finalized" ? "default" : "outline"} className="text-[9px] h-4">
                      {a.status}
                    </Badge>
                  </p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    Given {fmtQty(a.stockGivenQty)} · sold {fmtQty(a.stockSoldQty)} · left {fmtQty(a.stockLeftQty)}
                  </p>
                </div>
                <div className="text-right text-[11px] tabular-nums">
                  <p>Sold {fmt(a.soldAmount)}</p>
                  <p className="text-[hsl(var(--muted-foreground))]">Left {fmt(a.leftAmount)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function AuditSummaryCards({
  given,
  sold,
  left,
  soldAmt,
  leftAmt,
  credit,
  labels,
}: {
  given: number
  sold: number
  left: number
  soldAmt: number
  leftAmt: number
  credit: number
  labels?: { sold?: string; soldAmt?: string }
}) {
  const items = [
    { label: "Stock given", value: fmtQty(given), sub: "units" },
    { label: labels?.sold || "Sold", value: fmtQty(sold), sub: labels?.soldAmt ? fmt(soldAmt) : fmt(soldAmt) },
    { label: "Left", value: fmtQty(left), sub: fmt(leftAmt) },
    { label: "Credit", value: fmt(credit), sub: "orders unpaid" },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg border px-3 py-2.5">
          <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{it.label}</p>
          <p className="text-sm font-semibold tabular-nums mt-0.5">{it.value}</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums">{it.sub}</p>
        </div>
      ))}
    </div>
  )
}

function LinesTable({
  lines,
  readOnly: _readOnly,
  hideSold,
}: {
  lines: ClientAuditLine[]
  readOnly?: boolean
  hideSold?: boolean
}) {
  if (!lines.length) {
    return (
      <p className="text-sm text-center py-6 text-[hsl(var(--muted-foreground))] border rounded-lg">
        No stock lines.
      </p>
    )
  }
  return (
    <div className="rounded-lg border overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-[hsl(var(--muted))]/30">
          <tr className="text-left">
            <th className="px-2 py-2 font-medium">Item</th>
            <th className="px-2 py-2 font-medium text-right">Opening</th>
            <th className="px-2 py-2 font-medium text-right">Given</th>
            {!hideSold && <th className="px-2 py-2 font-medium text-right">Sold</th>}
            <th className="px-2 py-2 font-medium text-right">Left</th>
            <th className="px-2 py-2 font-medium text-right">Left amt</th>
            {!hideSold && <th className="px-2 py-2 font-medium text-right">Sold amt</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.itemKey} className="border-t">
              <td className="px-2 py-1.5">
                <span className="font-medium">{l.itemLabel}</span>
                {!hideSold && (l.soldRates || []).length > 0 ? (
                  <span className="block text-[10px] text-[hsl(var(--muted-foreground))]">
                    {(l.soldRates || [])
                      .map((r) => `${fmtQty(r.qty)} @ ${fmt(r.unitPrice)}`)
                      .join(" · ")}
                  </span>
                ) : null}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmtQty(l.openingQty)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmtQty(l.givenQty)}</td>
              {!hideSold && (
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtQty(l.soldQty)}</td>
              )}
              <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtQty(l.leftQty)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.leftAmount)}</td>
              {!hideSold && (
                <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.soldAmount)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
