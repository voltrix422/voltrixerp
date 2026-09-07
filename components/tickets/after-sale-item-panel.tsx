"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  createAfterSaleItemIn,
  createAfterSaleItemOut,
  listAfterSaleItemMovements,
  type AfterSaleDisposition,
  type AfterSaleItemCondition,
  type AfterSaleItemMovement,
} from "@/lib/after-sale-items"
import { parseProductQrPayload } from "@/lib/parse-product-qr"

function extractSerial(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    const parsed = parseProductQrPayload(trimmed)
    if (parsed.serialNumber?.trim()) return parsed.serialNumber.trim()
  } catch {
    // plain
  }
  return trimmed.split(/[\s,;]+/)[0]?.trim() ?? trimmed
}

const CONDITION_LABELS: Record<string, string> = {
  good: "Good",
  faulty: "Faulty / damaged",
  unknown: "Unknown",
}

const DISPOSITION_LABELS: Record<string, string> = {
  returned_to_customer: "Returned to customer",
  replaced: "Replaced unit issued",
  to_faulty: "Moved to faulty",
  scrap: "Scrapped",
}

function formatWhen(iso: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

export function AfterSaleItemPanel({
  actorName,
  tickets,
  lockTicketId,
  lockTicketNumber,
  lockCustomerName,
  lockCustomerPhone,
  compact,
}: {
  actorName: string
  tickets: Array<{ id: string; ticketNumber: string; customerName: string; customerPhone?: string | null }>
  lockTicketId?: string
  lockTicketNumber?: string
  lockCustomerName?: string
  lockCustomerPhone?: string
  compact?: boolean
}) {
  const { toast } = useToast()
  const [rows, setRows] = useState<AfterSaleItemMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "held" | "in" | "out">("all")
  const [showIn, setShowIn] = useState(false)
  const [showOut, setShowOut] = useState<AfterSaleItemMovement | null>(null)
  const [saving, setSaving] = useState(false)

  const [serial, setSerial] = useState("")
  const [productName, setProductName] = useState("")
  const [model, setModel] = useState("")
  const [condition, setCondition] = useState<AfterSaleItemCondition>("faulty")
  const [customerName, setCustomerName] = useState(lockCustomerName || "")
  const [customerPhone, setCustomerPhone] = useState(lockCustomerPhone || "")
  const [ticketId, setTicketId] = useState(lockTicketId || "")
  const [notes, setNotes] = useState("")

  const [outDisposition, setOutDisposition] = useState<Exclude<AfterSaleDisposition, "">>("returned_to_customer")
  const [outSerial, setOutSerial] = useState("")
  const [outNotes, setOutNotes] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAfterSaleItemMovements(
        lockTicketId ? { ticketId: lockTicketId } : undefined,
      )
      setRows(data)
    } catch (err) {
      toast({
        title: "Could not load items",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }, [lockTicketId, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (lockTicketId) setTicketId(lockTicketId)
    if (lockCustomerName) setCustomerName(lockCustomerName)
    if (lockCustomerPhone) setCustomerPhone(lockCustomerPhone)
  }, [lockTicketId, lockCustomerName, lockCustomerPhone])

  const held = useMemo(
    () => rows.filter((r) => r.movementType === "in" && r.status === "held"),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter === "held" && !(r.movementType === "in" && r.status === "held")) return false
      if (filter === "in" && r.movementType !== "in") return false
      if (filter === "out" && r.movementType !== "out") return false
      if (!q) return true
      return (
        r.serialNumber.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.model.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.ticketNumber || "").toLowerCase().includes(q) ||
        (r.outSerialNumber || "").toLowerCase().includes(q)
      )
    })
  }, [rows, search, filter])

  function resetInForm() {
    setSerial("")
    setProductName("")
    setModel("")
    setCondition("faulty")
    setNotes("")
    if (!lockTicketId) {
      setTicketId("")
      setCustomerName("")
      setCustomerPhone("")
    }
    setShowIn(false)
  }

  async function submitIn(e: React.FormEvent) {
    e.preventDefault()
    const sn = extractSerial(serial)
    if (!sn) {
      toast({ title: "Serial required", message: "Scan or type the battery serial.", type: "error" })
      return
    }
    setSaving(true)
    try {
      const ticket = tickets.find((t) => t.id === ticketId)
      await createAfterSaleItemIn({
        serialNumber: sn,
        productName: productName.trim(),
        model: model.trim(),
        condition,
        customerName: customerName.trim() || ticket?.customerName || "",
        customerPhone: customerPhone.trim() || ticket?.customerPhone || undefined,
        ticketId: ticketId || undefined,
        ticketNumber: ticket?.ticketNumber || lockTicketNumber,
        notes: notes.trim(),
        createdBy: actorName,
      })
      toast({ title: "Item In recorded", message: `${sn} is now held in after-sale.`, type: "success" })
      resetInForm()
      await load()
    } catch (err) {
      toast({
        title: "Item In failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function submitOut(e: React.FormEvent) {
    e.preventDefault()
    if (!showOut) return
    setSaving(true)
    try {
      await createAfterSaleItemOut({
        linkedInId: showOut.id,
        disposition: outDisposition,
        outSerialNumber: extractSerial(outSerial) || undefined,
        notes: outNotes.trim(),
        createdBy: actorName,
      })
      toast({
        title: "Item Out recorded",
        message: `${showOut.serialNumber} released (${DISPOSITION_LABELS[outDisposition]}).`,
        type: "success",
      })
      setShowOut(null)
      setOutSerial("")
      setOutNotes("")
      setOutDisposition("returned_to_customer")
      await load()
    } catch (err) {
      toast({
        title: "Item Out failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {!compact && (
            <>
              <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
                Item In / Item Out
              </h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Log batteries that arrive for after-sale service, then release them when work is done.
              </p>
            </>
          )}
          {compact && (
            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Battery custody
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
            onClick={() => setShowIn(true)}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" /> Item In
          </Button>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Held now</p>
            <p className="text-xl font-semibold tabular-nums text-[hsl(var(--foreground))]">{held.length}</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Item In</p>
            <p className="text-xl font-semibold tabular-nums text-[hsl(var(--foreground))]">
              {rows.filter((r) => r.movementType === "in").length}
            </p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Item Out</p>
            <p className="text-xl font-semibold tabular-nums text-[hsl(var(--foreground))]">
              {rows.filter((r) => r.movementType === "out").length}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search serial, product, customer…"
            className="w-full h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-8 pr-3 text-xs"
          />
        </div>
        <div className="flex rounded-lg border border-[hsl(var(--border))] overflow-hidden text-[11px]">
          {([
            ["all", "All"],
            ["held", "Held"],
            ["in", "In"],
            ["out", "Out"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1.5 ${
                filter === key
                  ? "bg-[#1a9f9a] text-white"
                  : "bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] py-10 text-center">
          <Package className="h-7 w-7 mx-auto text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No movements yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Use Item In when a battery arrives for service.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden divide-y divide-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {filtered.map((row) => {
            const isIn = row.movementType === "in"
            const isHeld = isIn && row.status === "held"
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-start gap-3 px-3 py-3 hover:bg-[hsl(var(--muted))]/10"
              >
                <div
                  className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isIn
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                  }`}
                >
                  {isIn ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      {isIn ? "IN" : "OUT"} · {row.serialNumber}
                    </span>
                    {isHeld && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300">
                        Held
                      </span>
                    )}
                    {!isIn && row.disposition && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                        {DISPOSITION_LABELS[row.disposition] || row.disposition}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                    {[row.productName || row.model, row.customerName, row.ticketNumber]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  {!isIn && row.outSerialNumber && row.outSerialNumber !== row.serialNumber && (
                    <p className="text-[11px] text-[hsl(var(--foreground))] mt-0.5">
                      Out SN: {row.outSerialNumber}
                    </p>
                  )}
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                    {formatWhen(row.createdAt)}
                    {row.createdBy ? ` · ${row.createdBy}` : ""}
                  </p>
                </div>
                {isHeld && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => {
                      setShowOut(row)
                      setOutSerial(row.serialNumber)
                      setOutDisposition("returned_to_customer")
                      setOutNotes("")
                    }}
                  >
                    <ArrowUpFromLine className="h-3 w-3" /> Item Out
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showIn && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
          onClick={resetInForm}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] max-h-[92vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-[#1a9f9a]" />
                <p className="text-sm font-semibold">Item In</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetInForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={submitIn} className="overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Serial *</label>
                <input
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  onBlur={() => setSerial(extractSerial(serial))}
                  required
                  placeholder="Scan or type serial"
                  className="mt-1 w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Product</label>
                  <input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Battery name"
                    className="mt-1 w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Model</label>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Model code"
                    className="mt-1 w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Condition</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as AfterSaleItemCondition)}
                  className="mt-1 w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-xs"
                >
                  <option value="faulty">{CONDITION_LABELS.faulty}</option>
                  <option value="good">{CONDITION_LABELS.good}</option>
                  <option value="unknown">{CONDITION_LABELS.unknown}</option>
                </select>
              </div>
              {!lockTicketId && (
                <div>
                  <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                    Link to case (optional)
                  </label>
                  <select
                    value={ticketId}
                    onChange={(e) => {
                      const id = e.target.value
                      setTicketId(id)
                      const t = tickets.find((x) => x.id === id)
                      if (t) {
                        setCustomerName(t.customerName)
                        setCustomerPhone(t.customerPhone || "")
                      }
                    }}
                    className="mt-1 w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-xs"
                  >
                    <option value="">No case linked</option>
                    {tickets.slice(0, 80).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.ticketNumber} — {t.customerName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Customer</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Phone</label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Symptoms, accessories received…"
                  className="mt-1 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs resize-none"
                />
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="w-full h-10 bg-[#1a9f9a] hover:bg-[#158a85] text-white gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Record Item In
              </Button>
            </form>
          </div>
        </div>
      )}

      {showOut && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
          onClick={() => setShowOut(null)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] max-h-[92vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-2">
                <ArrowUpFromLine className="h-4 w-4 text-sky-600" />
                <p className="text-sm font-semibold">Item Out · {showOut.serialNumber}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowOut(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={submitOut} className="overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Disposition *</label>
                <select
                  value={outDisposition}
                  onChange={(e) => setOutDisposition(e.target.value as Exclude<AfterSaleDisposition, "">)}
                  className="mt-1 w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-xs"
                >
                  {Object.entries(DISPOSITION_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                  Outgoing serial {outDisposition === "replaced" ? "(replacement)" : "(same if unchanged)"}
                </label>
                <input
                  value={outSerial}
                  onChange={(e) => setOutSerial(e.target.value)}
                  onBlur={() => setOutSerial(extractSerial(outSerial))}
                  placeholder={showOut.serialNumber}
                  className="mt-1 w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Notes</label>
                <textarea
                  value={outNotes}
                  onChange={(e) => setOutNotes(e.target.value)}
                  rows={2}
                  placeholder="Repair done, accessories returned…"
                  className="mt-1 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs resize-none"
                />
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="w-full h-10 bg-sky-600 hover:bg-sky-700 text-white gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4" />}
                Record Item Out
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
