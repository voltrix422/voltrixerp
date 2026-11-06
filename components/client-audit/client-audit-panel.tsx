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
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"

type ClientTab = "stock" | "orders" | "history"

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })
}

function fmtPkr(n: number) {
  return `PKR ${fmt(n)}`
}

function fmtQty(n: number) {
  return (Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })
}

function fmtDate(iso: string) {
  if (!iso) return "—"
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00+05:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function shortLabel(label: string) {
  // Prefer readable name before MAN-… model noise
  const cut = label.replace(/\s*\(MAN-[^)]+\)\s*$/i, "").trim()
  return cut || label
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
  const [tab, setTab] = useState<ClientTab>("stock")
  const [mode, setMode] = useState<"overview" | "create" | "view">("overview")
  const [viewAudit, setViewAudit] = useState<ClientAuditRecord | null>(null)
  const [lines, setLines] = useState<ClientAuditLine[]>([])
  const [notes, setNotes] = useState("")
  const [signedByName, setSignedByName] = useState("")
  const [signature, setSignature] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

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
      setTab("stock")
      setViewAudit(null)
      setExpandedItem(null)
      setExpandedOrder(null)
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
    setExpandedItem(snapshot.lines[0]?.itemKey || null)
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
          soldRates: [
            ...(l.soldRates || []),
            { id: newRateId(), qty: 0, unitPrice: l.bookUnitPrice || 0 },
          ],
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
            message: `${shortLabel(l.itemLabel)}: sold ${fmtQty(l.soldQty)} but only ${fmtQty(l.availableQty)} available`,
          })
          return
        }
      }
      if (!signedByName.trim()) {
        toast({ type: "error", title: "Signer name required", message: "Enter who is signing." })
        return
      }
      if (!signature) {
        toast({
          type: "error",
          title: "Signature required",
          message: "Client must sign before finalize.",
        })
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
        message: finalize ? "Signed and locked." : "You can finalize later.",
      })
      await loadClient(clientId)
      if (finalize) setTab("history")
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

  // ——— Client picker ———
  if (!clientId) {
    return (
      <div className="rounded-[18px] bg-[#f5f5f7] dark:bg-transparent p-3 sm:p-4 -m-3 sm:-m-4 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b] pointer-events-none" />
          <input
            className="w-full h-9 rounded-full border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] pl-9 pr-3 text-[13px] tracking-tight shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
            placeholder="Search client…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {loadingClients ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#86868b]" />
          </div>
        ) : (
          <div className="rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] max-h-[min(70vh,40rem)] overflow-y-auto scrollbar-none divide-y divide-black/[0.04] dark:divide-[hsl(var(--border))]">
            {filteredClients.length === 0 ? (
              <p className="text-[13px] text-center py-12 text-[#86868b]">No clients found.</p>
            ) : (
              filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  onClick={() => void loadClient(c.id)}
                >
                  <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                    {c.name}
                  </p>
                  <p className="text-[11px] text-[#86868b] mt-0.5">
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
      <div className="flex justify-center py-14">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ——— View past audit ———
  if (mode === "view" && viewAudit) {
    return (
      <div className="space-y-3">
        <HeaderBar
          title={snapshot.clientName}
          subtitle={`Audit · ${fmtDate(viewAudit.auditDate)} · ${viewAudit.status}`}
          onBack={() => {
            setMode("overview")
            setViewAudit(null)
            setTab("history")
          }}
          backLabel="History"
        />
        <StatRow
          items={[
            { label: "Given", value: fmtQty(viewAudit.stockGivenQty) },
            { label: "Sold", value: fmtQty(viewAudit.stockSoldQty), sub: fmtPkr(viewAudit.soldAmount) },
            { label: "Left", value: fmtQty(viewAudit.stockLeftQty), sub: fmtPkr(viewAudit.leftAmount) },
            { label: "Credit", value: fmtPkr(viewAudit.creditAmount) },
          ]}
        />
        <CompactLinesTable lines={viewAudit.lines} showSold />
        {viewAudit.notes ? (
          <p className="text-[11px] text-muted-foreground border rounded-md px-3 py-2 whitespace-pre-wrap">
            {viewAudit.notes}
          </p>
        ) : null}
        {viewAudit.signatureDataUrl ? (
          <div className="rounded-md border px-3 py-2 space-y-1">
            <p className="text-[10px] text-muted-foreground">Signed by {viewAudit.signedByName || "—"}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewAudit.signatureDataUrl}
              alt="Signature"
              className="max-h-20 border rounded bg-white"
            />
          </div>
        ) : null}
      </div>
    )
  }

  // ——— Create audit ———
  if (mode === "create") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <HeaderBar
            title={`Audit · ${snapshot.clientName}`}
            subtitle={
              snapshot.previousAudit
                ? `Since ${fmtDate(snapshot.previousAudit.auditDate)}`
                : "First audit · all stock to date"
            }
            onBack={() => setMode("overview")}
            backLabel="Back"
            inline
          />
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={saving}
              onClick={() => void saveAudit(false)}
            >
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Draft
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              disabled={saving}
              onClick={() => void saveAudit(true)}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              )}
              Finalize
            </Button>
          </div>
        </div>

        <StatRow
          items={[
            { label: "Given", value: fmtQty(draftTotals.stockGivenQty) },
            { label: "Sold", value: fmtQty(draftTotals.stockSoldQty), sub: fmtPkr(draftTotals.soldAmount) },
            { label: "Left", value: fmtQty(draftTotals.stockLeftQty), sub: fmtPkr(draftTotals.leftAmount) },
            { label: "Credit", value: fmtPkr(snapshot.creditTotal) },
          ]}
        />

        {lines.length === 0 ? (
          <p className="text-xs text-center py-8 text-muted-foreground border rounded-md">
            No stock on hand.
          </p>
        ) : (
          <div className="rounded-md border divide-y">
            {lines.map((line) => {
              const open = expandedItem === line.itemKey
              return (
                <div key={line.itemKey}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/30"
                    onClick={() => setExpandedItem(open ? null : line.itemKey)}
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{shortLabel(line.itemLabel)}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        Avail {fmtQty(line.availableQty)} · Sold {fmtQty(line.soldQty)} · Left{" "}
                        {fmtQty(line.leftQty)}
                      </p>
                    </div>
                    <div className="text-right text-[10px] tabular-nums shrink-0">
                      <p className="font-medium">{fmtPkr(line.soldAmount)}</p>
                      <p className="text-muted-foreground">left {fmtPkr(line.leftAmount)}</p>
                    </div>
                  </button>
                  {open ? (
                    <div className="px-2.5 pb-2.5 pt-0 space-y-2 bg-muted/15 border-t">
                      <p className="text-[10px] text-muted-foreground pt-2">
                        Open {fmtQty(line.openingQty)} + given {fmtQty(line.givenQty)} · book{" "}
                        {fmtPkr(line.bookUnitPrice)}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Sold rates
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={() => addSoldRate(line.itemKey)}
                        >
                          <Plus className="h-3 w-3 mr-0.5" />
                          Rate
                        </Button>
                      </div>
                      {(line.soldRates || []).length === 0 ? (
                        <p className="text-[10px] text-muted-foreground">None yet — add a rate if sold.</p>
                      ) : (
                        (line.soldRates || []).map((r) => (
                          <div key={r.id} className="flex flex-wrap items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              className="h-7 w-[4.5rem] rounded border px-1.5 text-xs tabular-nums"
                              placeholder="Qty"
                              value={r.qty || ""}
                              onChange={(e) =>
                                updateSoldRate(line.itemKey, r.id, {
                                  qty: Number(e.target.value) || 0,
                                })
                              }
                            />
                            <span className="text-[10px] text-muted-foreground">@</span>
                            <input
                              type="number"
                              min={0}
                              className="h-7 w-24 rounded border px-1.5 text-xs tabular-nums"
                              placeholder="Price"
                              value={r.unitPrice || ""}
                              onChange={(e) =>
                                updateSoldRate(line.itemKey, r.id, {
                                  unitPrice: Number(e.target.value) || 0,
                                })
                              }
                            />
                            <span className="text-[10px] tabular-nums text-muted-foreground min-w-[4.5rem]">
                              {fmtPkr(r.qty * r.unitPrice)}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => removeSoldRate(line.itemKey, r.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      )}
                      <div className="flex items-center gap-2 pt-0.5">
                        <label className="text-[10px] text-muted-foreground">Left qty</label>
                        <input
                          type="number"
                          min={0}
                          className="h-7 w-20 rounded border px-1.5 text-xs tabular-nums"
                          value={line.leftQty}
                          onChange={(e) => {
                            const leftQty = Math.max(0, Number(e.target.value) || 0)
                            const soldQty = Math.max(0, line.availableQty - leftQty)
                            updateLine(line.itemKey, {
                              soldRates:
                                soldQty > 0
                                  ? [
                                      {
                                        id: newRateId(),
                                        qty: soldQty,
                                        unitPrice: line.bookUnitPrice,
                                      },
                                    ]
                                  : [],
                            })
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Notes</label>
            <textarea
              className="w-full min-h-[64px] rounded-md border bg-transparent px-2.5 py-1.5 text-xs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Visit notes…"
            />
          </div>
          <div className="space-y-1.5">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Signed by</label>
              <input
                className="w-full h-8 rounded-md border px-2.5 text-xs"
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Signature</label>
              <SignaturePad value={signature} onChange={setSignature} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ——— Overview with tabs ———
  const tabs: { id: ClientTab; label: string; count?: number }[] = [
    { id: "stock", label: "Stock", count: snapshot.lines.length },
    { id: "orders", label: "Orders", count: snapshot.orders.length },
    { id: "history", label: "History", count: history.length },
  ]

  return (
    <div className="rounded-[18px] bg-[#f5f5f7] dark:bg-transparent p-3 sm:p-4 -m-3 sm:-m-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <HeaderBar
          title={snapshot.clientName}
          subtitle={`${snapshot.orders.length} orders · credit ${fmtPkr(snapshot.creditTotal)}`}
          onBack={() => {
            setClientId(null)
            setSnapshot(null)
          }}
          backLabel="Clients"
          inline
        />
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-full text-[11px] px-3.5 cursor-pointer bg-[#1d1d1f] hover:bg-black text-white dark:bg-white dark:text-[#1d1d1f]"
          onClick={startCreate}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          New audit
        </Button>
      </div>

      <StatRow
        items={[
          { label: "Given", value: fmtQty(snapshot.stockGivenQty) },
          {
            label: "Last sold",
            value: fmtQty(snapshot.previousAudit?.stockSoldQty ?? 0),
            sub: fmtPkr(snapshot.previousAudit?.soldAmount ?? 0),
          },
          {
            label: "Left",
            value: fmtQty(snapshot.stockLeftQty),
            sub: fmtPkr(snapshot.lines.reduce((s, l) => s + l.leftAmount, 0)),
          },
          { label: "Credit", value: fmtPkr(snapshot.creditTotal) },
        ]}
      />

      <div className="inline-flex items-center rounded-[10px] bg-black/[0.06] dark:bg-white/10 p-[3px]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-1.5 text-[12px] font-medium rounded-[8px] transition-all cursor-pointer",
              tab === t.id
                ? "bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shadow-sm"
                : "text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[hsl(var(--muted-foreground))]",
            )}
          >
            {t.label}
            {t.count != null ? (
              <span className="ml-1 tabular-nums text-[10px] opacity-70">{t.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "stock" ? <CompactLinesTable lines={snapshot.lines} /> : null}

      {tab === "orders" ? (
        <div className="rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] divide-y divide-black/[0.04]">
          {snapshot.orders.length === 0 ? (
            <p className="text-[13px] text-center py-10 text-[#86868b]">No orders with stock.</p>
          ) : (
            snapshot.orders.map((o) => {
              const open = expandedOrder === o.id
              return (
                <div key={o.id}>
                  <button
                    type="button"
                    className="w-full flex items-start gap-2 px-3.5 py-2.5 text-left hover:bg-black/[0.02] cursor-pointer"
                    onClick={() => setExpandedOrder(open ? null : o.id)}
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">
                        {o.orderNumber}{" "}
                        <span className="font-normal text-muted-foreground">· {o.status}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtDate(o.fulfillmentDate || o.deliveryDate || o.createdAt)} · {o.itemCount}{" "}
                        items
                      </p>
                    </div>
                    <div className="text-right text-[10px] tabular-nums shrink-0">
                      <p>{fmtPkr(o.total)}</p>
                      <p className="text-muted-foreground">
                        paid {fmtPkr(o.paid)} · due {fmtPkr(o.credit)}
                      </p>
                    </div>
                  </button>
                  {open ? (
                    <div className="px-8 pb-2.5 space-y-1 bg-muted/15 border-t">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground pt-2">
                        Payments received
                      </p>
                      {!o.payments?.length ? (
                        <p className="text-[10px] text-muted-foreground">No payments recorded.</p>
                      ) : (
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="py-0.5 font-medium">Date</th>
                              <th className="py-0.5 font-medium">Method</th>
                              <th className="py-0.5 font-medium text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.payments.map((p) => (
                              <tr key={p.id || `${p.date}-${p.amount}`} className="border-t border-border/50">
                                <td className="py-1">{fmtDate(p.date)}</td>
                                <td className="py-1 text-muted-foreground">{p.method}</td>
                                <td className="py-1 text-right tabular-nums font-medium">
                                  {fmtPkr(p.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t">
                              <td colSpan={2} className="py-1 text-muted-foreground">
                                Total paid
                              </td>
                              <td className="py-1 text-right tabular-nums font-semibold">
                                {fmtPkr(o.paid)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] divide-y divide-black/[0.04]">
          {history.length === 0 ? (
            <p className="text-[13px] text-center py-10 text-[#86868b]">No audits yet.</p>
          ) : (
            history.map((a) => (
              <button
                key={a.id}
                type="button"
                className="w-full text-left px-3.5 py-2.5 hover:bg-black/[0.02] flex items-center justify-between gap-2 cursor-pointer"
                onClick={() => {
                  setViewAudit(a)
                  setMode("view")
                }}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold tracking-tight">
                    {fmtDate(a.auditDate)}{" "}
                    <span className="font-normal text-[#86868b]">· {a.status}</span>
                  </p>
                  <p className="text-[11px] text-[#86868b] tabular-nums">
                    Sold {fmtQty(a.stockSoldQty)} · left {fmtQty(a.stockLeftQty)}
                  </p>
                </div>
                <div className="text-right text-[11px] tabular-nums shrink-0">
                  <p className="font-medium">{fmtPkr(a.soldAmount)}</p>
                  <p className="text-[#86868b]">left {fmtPkr(a.leftAmount)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function HeaderBar({
  title,
  subtitle,
  onBack,
  backLabel,
}: {
  title: string
  subtitle: string
  onBack: () => void
  backLabel: string
  inline?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 rounded-full text-[11px] px-3 shrink-0 border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] cursor-pointer"
        onClick={onBack}
      >
        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
        {backLabel}
      </Button>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold tracking-tight truncate leading-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
          {title}
        </p>
        <p className="text-[11px] text-[#86868b] truncate">{subtitle}</p>
      </div>
    </div>
  )
}

function StatRow({
  items,
}: {
  items: { label: string; value: string; sub?: string }[]
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-[14px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#86868b]">{it.label}</p>
          <p className="text-[15px] font-semibold tabular-nums leading-tight mt-0.5 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            {it.value}
          </p>
          {it.sub ? <p className="text-[11px] text-[#86868b] tabular-nums mt-0.5">{it.sub}</p> : null}
        </div>
      ))}
    </div>
  )
}

function CompactLinesTable({
  lines,
  showSold,
}: {
  lines: ClientAuditLine[]
  showSold?: boolean
}) {
  if (!lines.length) {
    return (
      <p className="text-[13px] text-center py-10 text-[#86868b] rounded-[16px] border border-black/[0.06] bg-white dark:bg-[hsl(var(--card))]">
        No stock lines.
      </p>
    )
  }
  return (
    <div className="rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-x-auto scrollbar-none shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left border-b border-black/[0.04] bg-[#fafafa] dark:bg-[hsl(var(--muted))]/30">
            <th className="px-3 py-2 font-medium text-[11px] text-[#86868b]">Item</th>
            <th className="px-3 py-2 font-medium text-[11px] text-[#86868b] text-right">Open</th>
            <th className="px-3 py-2 font-medium text-[11px] text-[#86868b] text-right">Given</th>
            {showSold ? (
              <th className="px-3 py-2 font-medium text-[11px] text-[#86868b] text-right">Sold</th>
            ) : null}
            <th className="px-3 py-2 font-medium text-[11px] text-[#86868b] text-right">Left</th>
            <th className="px-3 py-2 font-medium text-[11px] text-[#86868b] text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.04]">
          {lines.map((l) => (
            <tr key={l.itemKey}>
              <td className="px-3 py-2">
                <span className="font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                  {shortLabel(l.itemLabel)}
                </span>
                {showSold && (l.soldRates || []).length > 0 ? (
                  <span className="block text-[10px] text-[#86868b]">
                    {(l.soldRates || [])
                      .map((r) => `${fmtQty(r.qty)} @ ${fmtPkr(r.unitPrice)}`)
                      .join(" · ")}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[#86868b]">{fmtQty(l.openingQty)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-[#86868b]">{fmtQty(l.givenQty)}</td>
              {showSold ? (
                <td className="px-3 py-2 text-right tabular-nums">{fmtQty(l.soldQty)}</td>
              ) : null}
              <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQty(l.leftQty)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPkr(l.leftAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
