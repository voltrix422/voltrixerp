"use client"

import { useEffect, useState } from "react"
import { Copy, FileDown, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { getClients, type Client } from "@/lib/crm"
import { matchesOwnerRecord, resolveOwnerUserId, type CrmWorkspaceScope } from "@/lib/crm-workspace"
import { getQuoteRates, groupQuoteRates, type QuoteRate } from "@/lib/quote-rates"
import { downloadExtensiveQuotationPDF } from "@/lib/generate-extensive-quotation-pdf"
import {
  deleteExtensiveQuotation,
  duplicateExtensiveQuotation,
  EXTENSIVE_STATUS_COLORS,
  EXTENSIVE_STATUS_LABELS,
  generateExtensiveQuotationNumber,
  getExtensiveQuotations,
  includedQuoteTotal,
  saveExtensiveQuotation,
  type ExtensiveQuotation,
  type ExtensiveQuoteLine,
  type ExtensiveQuotationStatus,
  type QuoteTermSection,
} from "@/lib/extensive-quotations"

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatPkr(n: number) {
  return `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ExtensiveQuotationsPanel({
  currentUser,
  currentUserId,
  workspace,
}: {
  currentUser: string
  currentUserId?: string
  workspace?: CrmWorkspaceScope
}) {
  const { toast } = useToast()
  const readOnly = !!workspace?.readOnly
  const [loading, setLoading] = useState(true)
  const [quotes, setQuotes] = useState<ExtensiveQuotation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [rates, setRates] = useState<QuoteRate[]>([])
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ExtensiveQuotation | null>(null)
  const [duplicating, setDuplicating] = useState<ExtensiveQuotation | null>(null)
  const [selected, setSelected] = useState<ExtensiveQuotation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ExtensiveQuotation | null>(null)

  useEffect(() => {
    Promise.all([getExtensiveQuotations(), getClients(), getQuoteRates()]).then(([q, c, r]) => {
      const scoped = workspace?.ownerUserId
        ? q.filter((row) => matchesOwnerRecord(row.ownerUserId, workspace.ownerUserId))
        : q
      setQuotes(scoped)
      setClients(
        workspace?.ownerUserId
          ? c.filter((client) => matchesOwnerRecord(client.ownerUserId, workspace.ownerUserId))
          : c,
      )
      setRates(r)
      setLoading(false)
    })
  }, [workspace?.ownerUserId])

  const filtered = quotes.filter((q) => {
    const s = search.toLowerCase()
    return (
      q.quotationNumber.toLowerCase().includes(s) ||
      q.recipientName.toLowerCase().includes(s) ||
      q.recipientCompany.toLowerCase().includes(s)
    )
  })

  function onSaved(saved: ExtensiveQuotation) {
    setQuotes((prev) => [saved, ...prev.filter((x) => x.id !== saved.id)])
    setShowForm(false)
    setEditing(null)
    setDuplicating(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Q2..."
          className="h-8 px-3 rounded border bg-[hsl(var(--background))] text-xs w-full min-w-0 sm:w-40"
        />
        {!readOnly && (
          <Button size="sm" className="h-8 text-xs px-3 cursor-pointer w-full sm:w-auto" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Q2
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#1faca6]" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-16">
          {quotes.length === 0
            ? "No extensive quotations yet. Add rates, then create Q2."
            : "No quotations match your search."}
        </p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                <th className="h-9 px-3 text-left text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Q2 #</th>
                <th className="h-9 px-3 text-left text-[10px] uppercase text-[hsl(var(--muted-foreground))]">To</th>
                <th className="h-9 px-3 text-right text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Total</th>
                <th className="h-9 px-3 text-left text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Status</th>
                <th className="h-9 px-3 text-left text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Valid</th>
                <th className="h-9 px-3 text-left text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Date</th>
                <th className="h-9 px-3 text-right text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((q) => (
                <tr key={q.id} className="hover:bg-[hsl(var(--muted))]/20 cursor-pointer" onClick={() => setSelected(q)}>
                  <td className="px-3 py-2.5 text-xs font-semibold text-[#1faca6]">{q.quotationNumber}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <p className="font-medium">{q.recipientName}</p>
                    {q.recipientCompany ? (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{q.recipientCompany}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-semibold whitespace-nowrap">{formatPkr(q.total)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${EXTENSIVE_STATUS_COLORS[q.status]}`}>
                      {EXTENSIVE_STATUS_LABELS[q.status]}
                    </span>
                    {!q.showBranding && (
                      <span className="ml-1 text-[9px] text-[hsl(var(--muted-foreground))]">no brand</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">{q.validUntil || "—"}</td>
                  <td className="px-3 py-2.5 text-xs">{q.quoteDate || "—"}</td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {!readOnly && (
                      <>
                        <button type="button" className="text-blue-600 text-xs mr-2 cursor-pointer" onClick={() => setEditing(q)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs mr-2 cursor-pointer"
                          onClick={() => setDuplicating({ ...duplicateExtensiveQuotation(q), quotationNumber: q.quotationNumber })}
                        >
                          Duplicate
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="text-[#1a9f9a] text-xs mr-2 cursor-pointer"
                      onClick={() =>
                        downloadExtensiveQuotationPDF(q).catch(() =>
                          toast({ title: "Could not export PDF", type: "error" }),
                        )
                      }
                    >
                      PDF
                    </button>
                    {!readOnly && (
                      <button type="button" className="text-red-600 text-xs cursor-pointer" onClick={() => setDeleteTarget(q)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showForm || editing || duplicating) && (
        <ExtensiveQuoteForm
          currentUser={currentUser}
          currentUserId={currentUserId}
          workspace={workspace}
          clients={clients}
          rates={rates}
          existing={editing || undefined}
          duplicateFrom={duplicating || undefined}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
            setDuplicating(null)
          }}
          onSave={onSaved}
        />
      )}

      {selected && !editing && !duplicating && (
        <ExtensiveQuoteDetail
          quote={selected}
          readOnly={readOnly}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected)
            setSelected(null)
          }}
          onDuplicate={() => {
            setDuplicating({ ...duplicateExtensiveQuotation(selected), quotationNumber: selected.quotationNumber })
            setSelected(null)
          }}
          onDelete={() => {
            setDeleteTarget(selected)
            setSelected(null)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Q2 quotation"
        message={`Delete ${deleteTarget?.quotationNumber}? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return
          void deleteExtensiveQuotation(deleteTarget.id).then(() => {
            setQuotes((prev) => prev.filter((x) => x.id !== deleteTarget.id))
            setDeleteTarget(null)
          })
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function ExtensiveQuoteForm({
  currentUser,
  currentUserId,
  workspace,
  clients,
  rates: initialRates,
  existing,
  duplicateFrom,
  onClose,
  onSave,
}: {
  currentUser: string
  currentUserId?: string
  workspace?: CrmWorkspaceScope
  clients: Client[]
  rates: QuoteRate[]
  existing?: ExtensiveQuotation
  duplicateFrom?: ExtensiveQuotation
  onClose: () => void
  onSave: (q: ExtensiveQuotation) => void
}) {
  const { toast } = useToast()
  const source = duplicateFrom || existing
  const [recipientName, setRecipientName] = useState(source?.recipientName || "")
  const [recipientCompany, setRecipientCompany] = useState(source?.recipientCompany || "")
  const [recipientAddress, setRecipientAddress] = useState(source?.recipientAddress || "")
  const [quoteDate, setQuoteDate] = useState(source?.quoteDate || todayDate())
  const [validUntil, setValidUntil] = useState(source?.validUntil || "")
  const [notes, setNotes] = useState(source?.notes || "")
  const [showBranding, setShowBranding] = useState(source?.showBranding ?? true)
  const [status, setStatus] = useState<ExtensiveQuotationStatus>(duplicateFrom ? "draft" : source?.status || "draft")
  const [items, setItems] = useState<ExtensiveQuoteLine[]>(source?.items || [])
  const [terms, setTerms] = useState<QuoteTermSection[]>(
    source?.terms?.length
      ? source.terms
      : [{ id: "term-1", heading: "", bullets: [""] }],
  )
  const [rates, setRates] = useState<QuoteRate[]>(initialRates)
  const [rateSearch, setRateSearch] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getQuoteRates().then(setRates)
  }, [])

  const total = includedQuoteTotal(items)
  const rateMatches = rates.filter((r) => {
    const q = rateSearch.trim().toLowerCase()
    if (!q) return true
    return r.itemName.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q) || r.rateDate.includes(q)
  })
  const groupedRates = groupQuoteRates(rateMatches)

  function addRate(rate: QuoteRate) {
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        rateId: rate.id,
        itemName: rate.itemName,
        supplier: rate.supplier,
        rate: rate.rate,
        rateDate: rate.rateDate,
        qty: 1,
        unit: "pcs",
        included: true,
      },
    ])
  }

  function fillFromClient(client: Client) {
    setRecipientName(client.name)
    setRecipientCompany(client.company || "")
    setRecipientAddress([client.address, client.city].filter(Boolean).join(", "))
  }

  async function handleSave() {
    if (!recipientName.trim()) {
      toast({ title: "Recipient required", message: "Enter who this quotation is given to.", type: "error" })
      return
    }
    setSaving(true)
    try {
      const quotationNumber =
        duplicateFrom || !existing?.quotationNumber
          ? await generateExtensiveQuotationNumber()
          : existing.quotationNumber
      const quote: ExtensiveQuotation = {
        id: duplicateFrom || !existing ? Date.now().toString() : existing.id,
        quotationNumber,
        recipientName: recipientName.trim(),
        recipientCompany: recipientCompany.trim(),
        recipientAddress: recipientAddress.trim(),
        quoteDate,
        validUntil,
        notes,
        showBranding,
        items,
        terms: terms
          .map((t) => ({
            ...t,
            heading: t.heading.trim(),
            bullets: t.bullets.map((b) => b.trim()).filter(Boolean),
          }))
          .filter((t) => t.heading || t.bullets.length),
        subtotal: total,
        total,
        status,
        createdAt: existing && !duplicateFrom ? existing.createdAt : new Date().toISOString(),
        createdBy: existing && !duplicateFrom ? existing.createdBy : currentUser,
        ownerUserId: existing && !duplicateFrom ? existing.ownerUserId : resolveOwnerUserId(workspace?.ownerUserId, currentUserId),
      }
      const saved = await saveExtensiveQuotation(quote)
      toast({
        title: duplicateFrom ? "Q2 duplicated" : existing ? "Q2 updated" : "Q2 created",
        type: "success",
      })
      onSave(saved)
    } catch (err) {
      toast({
        title: "Could not save",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-5xl rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b shrink-0">
          <div>
            <p className="text-base font-bold">
              {duplicateFrom ? "Duplicate Q2" : existing ? "Edit Q2" : "Create Q2"}
            </p>
            {duplicateFrom && (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Copied from {duplicateFrom.quotationNumber} — save as a new quotation.
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold space-y-1">
              <span>To (name) *</span>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full h-9 rounded-md border px-3 text-sm"
                placeholder="Person or company this quote is given to"
              />
            </label>
            <label className="text-xs font-semibold space-y-1">
              <span>Fill from CRM client (optional)</span>
              <select
                className="w-full h-9 rounded-md border px-2 text-sm bg-[hsl(var(--background))]"
                defaultValue=""
                onChange={(e) => {
                  const c = clients.find((x) => x.id === e.target.value)
                  if (c) fillFromClient(c)
                }}
              >
                <option value="">Choose client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold space-y-1">
              <span>Company</span>
              <input
                value={recipientCompany}
                onChange={(e) => setRecipientCompany(e.target.value)}
                className="w-full h-9 rounded-md border px-3 text-sm"
              />
            </label>
            <label className="text-xs font-semibold space-y-1 sm:col-span-2">
              <span>Address</span>
              <input
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full h-9 rounded-md border px-3 text-sm"
              />
            </label>
            <label className="text-xs font-semibold space-y-1">
              <span>Quotation date</span>
              <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="w-full h-9 rounded-md border px-3 text-sm" />
            </label>
            <label className="text-xs font-semibold space-y-1">
              <span>Valid until</span>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full h-9 rounded-md border px-3 text-sm" />
            </label>
            <label className="text-xs font-semibold space-y-1">
              <span>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ExtensiveQuotationStatus)}
                className="w-full h-9 rounded-md border px-2 text-sm bg-[hsl(var(--background))]"
              >
                {Object.entries(EXTENSIVE_STATUS_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold mt-6">
              <input type="checkbox" checked={showBranding} onChange={(e) => setShowBranding(e.target.checked)} />
              Export with Voltrix branding
            </label>
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-semibold">Add supplier rates</p>
            <input
              value={rateSearch}
              onChange={(e) => setRateSearch(e.target.value)}
              placeholder="Search rate book..."
              className="h-8 w-full sm:w-64 rounded border px-3 text-xs"
            />
            <div className="max-h-52 overflow-auto rounded border text-xs">
              {groupedRates.length === 0 ? (
                <p className="p-3 text-[hsl(var(--muted-foreground))]">No rates. Add them in Rate book first.</p>
              ) : (
                groupedRates.map((item) => (
                  <div key={item.itemName} className="border-b last:border-0">
                    <p className="px-3 py-1.5 bg-[hsl(var(--muted))]/40 font-semibold sticky top-0">{item.itemName}</p>
                    {item.suppliers.map((sup) => (
                      <div key={`${item.itemName}-${sup.supplier}`}>
                        <p className="px-3 pt-1.5 text-[10px] font-semibold text-[#1faca6]">{sup.supplier}</p>
                        {sup.rows.map((rate, idx) => (
                          <button
                            key={rate.id}
                            type="button"
                            className="w-full text-left px-3 py-1.5 hover:bg-[hsl(var(--muted))]/30 flex justify-between gap-2 cursor-pointer"
                            onClick={() => addRate(rate)}
                          >
                            <span className="text-[hsl(var(--muted-foreground))]">
                              {rate.rateDate}
                              {idx === 0 && (
                                <span className="ml-1 text-[9px] font-bold text-emerald-700">Latest</span>
                              )}
                            </span>
                            <span className="tabular-nums">
                              PKR {rate.rate.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold">Lines on this quotation</p>
            {items.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Click a rate above to add it. Uncheck Include to keep it off the PDF/total.</p>
            ) : (
              <div className="overflow-x-auto rounded border">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="bg-[hsl(var(--muted))]/40">
                      <th className="px-2 py-2 text-left">Include</th>
                      <th className="px-2 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-left">Supplier</th>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((line) => (
                      <tr key={line.id} className={line.included ? "" : "opacity-50"}>
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={line.included}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x) => (x.id === line.id ? { ...x, included: e.target.checked } : x)),
                              )
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">{line.itemName}</td>
                        <td className="px-2 py-1.5">{line.supplier}</td>
                        <td className="px-2 py-1.5">{line.rateDate}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={line.qty}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x) => (x.id === line.id ? { ...x, qty: Number(e.target.value) || 0 } : x)),
                              )
                            }
                            className="w-16 h-7 rounded border px-1 text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {line.rate.toLocaleString("en-PK")}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                          {line.included ? (line.qty * line.rate).toLocaleString("en-PK") : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            className="text-red-600 cursor-pointer"
                            onClick={() => setItems((prev) => prev.filter((x) => x.id !== line.id))}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-sm font-semibold text-right">Total (included lines): {formatPkr(total)}</p>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Terms & conditions</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={() =>
                  setTerms((prev) => [...prev, { id: `term-${Date.now()}`, heading: "", bullets: [""] }])
                }
              >
                Add heading
              </Button>
            </div>
            {terms.map((section, sIdx) => (
              <div key={section.id} className="rounded-md border p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={section.heading}
                    onChange={(e) =>
                      setTerms((prev) => prev.map((t, i) => (i === sIdx ? { ...t, heading: e.target.value } : t)))
                    }
                    placeholder="Heading (e.g. Payment, Delivery, Warranty)"
                    className="flex-1 h-8 rounded border px-2 text-sm font-medium"
                  />
                  <button
                    type="button"
                    className="text-red-600 text-xs cursor-pointer"
                    onClick={() => setTerms((prev) => prev.filter((_, i) => i !== sIdx))}
                  >
                    Remove
                  </button>
                </div>
                {section.bullets.map((bullet, bIdx) => (
                  <div key={bIdx} className="flex gap-2">
                    <span className="text-[hsl(var(--muted-foreground))] mt-1.5">•</span>
                    <input
                      value={bullet}
                      onChange={(e) =>
                        setTerms((prev) =>
                          prev.map((t, i) =>
                            i === sIdx
                              ? { ...t, bullets: t.bullets.map((b, j) => (j === bIdx ? e.target.value : b)) }
                              : t,
                          ),
                        )
                      }
                      placeholder="Bullet point"
                      className="flex-1 h-8 rounded border px-2 text-sm"
                    />
                    <button
                      type="button"
                      className="text-xs text-[hsl(var(--muted-foreground))] cursor-pointer"
                      onClick={() =>
                        setTerms((prev) =>
                          prev.map((t, i) =>
                            i === sIdx ? { ...t, bullets: t.bullets.filter((_, j) => j !== bIdx) } : t,
                          ),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-[11px] text-[#1faca6] cursor-pointer"
                  onClick={() =>
                    setTerms((prev) =>
                      prev.map((t, i) => (i === sIdx ? { ...t, bullets: [...t.bullets, ""] } : t)),
                    )
                  }
                >
                  + Add bullet
                </button>
              </div>
            ))}
          </div>

          <label className="text-xs font-semibold space-y-1 block">
            <span>Internal notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 px-4 sm:px-6 py-3 border-t shrink-0">
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" className="h-9 text-xs" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Q2
          </Button>
        </div>
      </div>
    </div>
  )
}

function ExtensiveQuoteDetail({
  quote,
  readOnly,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  quote: ExtensiveQuotation
  readOnly?: boolean
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { toast } = useToast()
  const included = quote.items.filter((l) => l.included)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[92dvh] overflow-hidden rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold">{quote.quotationNumber}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{quote.recipientName}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-4 space-y-3 text-sm flex-1">
          <p>
            <span className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">To</span>
            <br />
            {quote.recipientName}
            {quote.recipientCompany ? ` · ${quote.recipientCompany}` : ""}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Date {quote.quoteDate || "—"} · Valid {quote.validUntil || "—"} ·{" "}
            {quote.showBranding ? "Voltrix branding on" : "No branding"}
          </p>
          <div className="rounded border divide-y">
            {included.map((line) => (
              <div key={line.id} className="px-3 py-2 text-xs flex justify-between gap-2">
                <span>
                  {line.itemName} · {line.supplier}
                  <span className="text-[hsl(var(--muted-foreground))]"> · {line.qty} {line.unit}</span>
                </span>
                <span className="tabular-nums">{formatPkr(line.qty * line.rate)}</span>
              </div>
            ))}
          </div>
          <p className="font-semibold text-right">{formatPkr(quote.total)}</p>
          {quote.terms.map((t) => (
            <div key={t.id}>
              <p className="text-xs font-semibold">{t.heading}</p>
              <ul className="list-disc pl-4 text-xs text-[hsl(var(--muted-foreground))]">
                {t.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 px-4 py-3 border-t">
          {!readOnly && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onDuplicate}>
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() =>
              downloadExtensiveQuotationPDF(quote).catch(() => toast({ title: "Could not export PDF", type: "error" }))
            }
          >
            <FileDown className="h-3.5 w-3.5" /> PDF
          </Button>
          {!readOnly && (
            <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
