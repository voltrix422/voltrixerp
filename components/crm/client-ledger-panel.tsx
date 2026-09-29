"use client"

import { useMemo, useState } from "react"
import { FileDown, Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import type { Client } from "@/lib/crm"
import type { Order } from "@/lib/orders"
import {
  buildClientLedgerPayload,
  findLedgerClient,
  listLedgerClients,
  type LedgerClientRef,
} from "@/lib/client-order-ledger"
import { downloadClientLedgerExcel } from "@/lib/crm-excel-export"
import { downloadClientLedgerPdf } from "@/lib/generate-client-ledger-pdf"

function formatPkr(amount: number) {
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export function ClientLedgerPicker({
  clients,
  orders,
  selectedIds,
  onChange,
}: {
  clients: Client[]
  orders: Order[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const options = useMemo(() => listLedgerClients(clients, orders), [clients, orders])
  const selected = useMemo(
    () => selectedIds.map((id) => findLedgerClient(options, id)).filter((c): c is LedgerClientRef => Boolean(c)),
    [options, selectedIds],
  )
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const q = search.trim().toLowerCase()
  const filteredMatches = q
    ? options.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.ntn.toLowerCase().includes(q),
      )
    : options
  const matches = q ? filteredMatches : filteredMatches.slice(0, 80)
  const label =
    selected.length === 0
      ? "Select client ledger..."
      : selected.length === 1
        ? selected[0].name
        : `${selected.length} clients selected`

  function toggle(id: string) {
    if (!id) return
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id])
    setSearch("")
  }

  return (
    <div className="relative min-w-0 flex-1 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 h-8 min-w-0 rounded border bg-[hsl(var(--background))] px-2.5 text-xs text-left flex items-center justify-between gap-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          <span className={`truncate ${selected.length ? "font-medium" : "text-[hsl(var(--muted-foreground))]"}`}>
            {label}
          </span>
          <svg className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {selectedIds.length > 0 && (
          <button
            type="button"
            className="h-8 w-8 shrink-0 rounded border inline-flex items-center justify-center cursor-pointer hover:bg-[hsl(var(--muted))]/40"
            title="Clear clients"
            onClick={() => {
              onChange([])
              setSearch("")
              setOpen(false)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className="inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-[#1faca6] bg-[#1faca6] px-2 text-xs font-medium text-white cursor-pointer"
              title={`Remove ${c.name}`}
            >
              <span className="truncate">{c.name}</span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 w-full mt-1 max-h-72 overflow-auto rounded-md border bg-[hsl(var(--background))] shadow-lg">
            <div className="p-2 border-b sticky top-0 bg-[hsl(var(--background))] space-y-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search and add more than one client..."
                autoFocus
                className="w-full h-8 rounded border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none"
              />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {selected.length
                  ? `${selected.length} selected · keep searching to add more`
                  : "Pick one or more clients — their orders stay on this tab"}
              </p>
            </div>
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[hsl(var(--muted-foreground))]">No clients match.</p>
            ) : (
              matches.map((c) => {
                const on = selectedSet.has(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-xs cursor-pointer hover:bg-[hsl(var(--muted))]/40 border-t flex items-center gap-2 ${on ? "bg-[#1faca6]/10" : ""}`}
                    onClick={() => toggle(c.id)}
                  >
                    <span
                      className={`h-3.5 w-3.5 shrink-0 rounded border inline-flex items-center justify-center ${on ? "border-[#1faca6] bg-[#1faca6] text-white" : "border-[hsl(var(--border))]"}`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium">{c.name}</span>
                      {c.company && (
                        <span className="text-[hsl(var(--muted-foreground))] ml-1.5">({c.company})</span>
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function ClientExcludePicker({
  clients,
  orders,
  excludedIds,
  onChange,
}: {
  clients: Client[]
  orders: Order[]
  excludedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const options = useMemo(() => listLedgerClients(clients, orders), [clients, orders])
  const excluded = excludedIds
    .map((id) => findLedgerClient(options, id))
    .filter((c): c is LedgerClientRef => Boolean(c))
  const q = search.trim().toLowerCase()
  const matches = options.filter((c) => {
    if (excludedIds.includes(c.id)) return false
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.ntn.toLowerCase().includes(q)
    )
  })

  function add(id: string) {
    if (!id || excludedIds.includes(id)) return
    onChange([...excludedIds, id])
    setSearch("")
    setOpen(false)
  }

  function remove(id: string) {
    onChange(excludedIds.filter((item) => item !== id))
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        Except clients
      </p>
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
        Export every order except the clients you add here.
      </p>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full h-8 rounded border bg-[hsl(var(--background))] px-2.5 text-xs text-left flex items-center justify-between gap-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          <span className="truncate text-[hsl(var(--muted-foreground))]">
            {excluded.length ? `${excluded.length} client${excluded.length === 1 ? "" : "s"} excluded` : "Add a client to exclude..."}
          </span>
          <svg className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute z-20 w-full mt-1 max-h-64 overflow-auto rounded-md border bg-[hsl(var(--background))] shadow-lg">
              <div className="p-2 border-b sticky top-0 bg-[hsl(var(--background))]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, company, phone..."
                  autoFocus
                  className="w-full h-8 rounded border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none"
                />
              </div>
              {matches.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[hsl(var(--muted-foreground))]">No clients match.</p>
              ) : (
                matches.slice(0, 80).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs cursor-pointer hover:bg-[hsl(var(--muted))]/40 border-t"
                    onClick={() => add(c.id)}
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.company && (
                      <span className="text-[hsl(var(--muted-foreground))] ml-1.5">({c.company})</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
      {excluded.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {excluded.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => remove(c.id)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#1faca6] bg-[#1faca6] px-2 text-xs font-medium text-white cursor-pointer"
              title={`Include ${c.name} again`}
            >
              Except {c.name}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ClientLedgerSummary({
  clients: selectedClients,
  orders,
  currentUser,
}: {
  clients: LedgerClientRef[]
  orders: Order[]
  currentUser: string
}) {
  const { toast } = useToast()
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const payload = useMemo(
    () => buildClientLedgerPayload(selectedClients, orders, currentUser),
    [selectedClients, orders, currentUser],
  )
  const { stats, client } = payload
  const combined = selectedClients.length > 1
  const contact = combined
    ? selectedClients.map((c) => c.name).join(" · ")
    : [client.company, client.phone, client.ntn ? `NTN ${client.ntn}` : ""]
        .filter(Boolean)
        .join(" · ")

  async function exportPdf() {
    setExportingPdf(true)
    try {
      await downloadClientLedgerPdf(payload)
      toast({ title: "Download started", message: "Client ledger PDF.", type: "success" })
    } catch {
      toast({ title: "Error", message: "Could not export ledger PDF.", type: "error" })
    } finally {
      setExportingPdf(false)
    }
  }

  function exportExcel() {
    setExportingExcel(true)
    try {
      downloadClientLedgerExcel(payload)
      toast({ title: "Download started", message: "Client ledger Excel.", type: "success" })
    } catch {
      toast({ title: "Error", message: "Could not export ledger Excel.", type: "error" })
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <section className="rounded-lg border overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-4 py-3 border-b bg-[hsl(var(--muted))]/20">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1faca6]">
            {combined ? `Client ledger · ${selectedClients.length} clients` : "Client ledger"}
          </p>
          <p className="text-sm font-semibold truncate">{client.name}</p>
          {contact && <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{contact}</p>}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            size="sm"
            className="h-8 text-xs cursor-pointer bg-[#1faca6] hover:bg-[#17857f] text-white"
            disabled={exportingPdf || orders.length === 0}
            onClick={() => void exportPdf()}
          >
            <FileDown className="h-3.5 w-3.5 mr-1" />
            {exportingPdf ? "Exporting…" : "Ledger PDF"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer"
            disabled={exportingExcel || orders.length === 0}
            onClick={exportExcel}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            {exportingExcel ? "Exporting…" : "Ledger Excel"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[hsl(var(--border))]">
        <div className="bg-[hsl(var(--card))] p-3">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Billed</p>
          <p className="text-sm font-semibold tabular-nums mt-0.5">{formatPkr(stats.totalOrderValue)}</p>
        </div>
        <div className="bg-[hsl(var(--card))] p-3">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Paid / received</p>
          <p className="text-sm font-semibold tabular-nums mt-0.5 text-emerald-700">{formatPkr(stats.totalReceived)}</p>
        </div>
        <div className="bg-[hsl(var(--card))] p-3">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Outstanding</p>
          <p className="text-sm font-semibold tabular-nums mt-0.5 text-amber-700">{formatPkr(stats.totalOutstanding)}</p>
        </div>
        <div className="bg-[hsl(var(--card))] p-3">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Orders</p>
          <p className="text-sm font-semibold tabular-nums mt-0.5">{payload.orders.length}</p>
        </div>
      </div>
      <div className="px-4 py-2 text-[11px] text-[hsl(var(--muted-foreground))] flex flex-wrap gap-x-3 gap-y-1">
        <span>Fully paid {payload.fullyPaidCount}</span>
        <span>Partial {payload.partialCount}</span>
        <span>On credit {payload.onCreditCount}</span>
        <span>Returned {stats.returnedCount}</span>
        {stats.partialPaymentsReceived > 0.004 && (
          <span className="tabular-nums">Partial received {formatPkr(stats.partialPaymentsReceived)}</span>
        )}
        {stats.creditOutstanding > 0.004 && (
          <span className="tabular-nums">Credit still owed {formatPkr(stats.creditOutstanding)}</span>
        )}
      </div>
    </section>
  )
}
