"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import {
  currentRateDate,
  deleteQuoteRate,
  getQuoteRates,
  groupQuoteRates,
  rateTiming,
  saveQuoteRate,
  todayIsoDate,
  type QuoteRate,
  type RateTiming,
} from "@/lib/quote-rates"

function todayDate() {
  return todayIsoDate()
}

function timingBadge(timing: RateTiming) {
  if (timing === "upcoming") {
    return (
      <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
        Upcoming
      </span>
    )
  }
  if (timing === "current") {
    return (
      <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
        Current
      </span>
    )
  }
  return (
    <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
      Past
    </span>
  )
}

function emptyForm(): Omit<QuoteRate, "id" | "createdAt"> & { id?: string } {
  return {
    itemName: "",
    supplier: "",
    rate: 0,
    rateDate: todayDate(),
    notes: "",
    createdBy: "",
  }
}

export function QuoteRateBook({
  currentUser,
  readOnly,
}: {
  currentUser: string
  readOnly?: boolean
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rates, setRates] = useState<QuoteRate[]>([])
  const [search, setSearch] = useState("")
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    try {
      setRates(await getQuoteRates())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rates
    return rates.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        r.supplier.toLowerCase().includes(q) ||
        r.rateDate.includes(q),
    )
  }, [rates, search])

  const grouped = useMemo(() => groupQuoteRates(filtered), [filtered])

  async function handleSave() {
    if (readOnly) return
    if (!form.itemName.trim() || !form.supplier.trim() || !form.rateDate) {
      toast({ title: "Missing fields", message: "Item, supplier, and date are required.", type: "error" })
      return
    }
    setSaving(true)
    try {
      const saved = await saveQuoteRate({
        ...form,
        itemName: form.itemName.trim(),
        supplier: form.supplier.trim(),
        createdBy: currentUser,
      })
      setRates((prev) => {
        const without = prev.filter((r) => r.id !== saved.id)
        return [saved, ...without].sort((a, b) => {
          const name = a.itemName.localeCompare(b.itemName)
          if (name) return name
          return b.rateDate.localeCompare(a.rateDate)
        })
      })
      setForm(emptyForm())
      toast({ title: form.id ? "Rate updated" : "Rate added", type: "success" })
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

  async function handleDelete() {
    if (!deleteId) return
    try {
      await deleteQuoteRate(deleteId)
      setRates((prev) => prev.filter((r) => r.id !== deleteId))
      if (form.id === deleteId) setForm(emptyForm())
      toast({ title: "Rate deleted", type: "success" })
    } catch (err) {
      toast({
        title: "Could not delete",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Supplier rate book</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
          Add a new date to keep history. Edit only changes that one row. Past and upcoming dates all stay listed for Q2.
        </p>
      </div>

      {!readOnly && (
        <div id="rate-book-form" className="rounded-lg border p-3 sm:p-4 space-y-3">
          <p className="text-xs font-semibold">{form.id ? "Edit this date" : "Add rate"}</p>
          {form.id && (
            <p className="text-[10px] text-amber-700">
              This updates the existing row. To keep history, cancel and use “Add another date”.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <input
              value={form.itemName}
              onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
              placeholder="Item name"
              className="h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            />
            <input
              value={form.supplier}
              onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
              placeholder="Supplier"
              className="h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            />
            <input
              type="number"
              min={0}
              value={form.rate || ""}
              onChange={(e) => setForm((f) => ({ ...f, rate: Number(e.target.value) || 0 }))}
              placeholder="Rate (PKR)"
              className="h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            />
            <input
              type="date"
              value={form.rateDate}
              onChange={(e) => setForm((f) => ({ ...f, rateDate: e.target.value }))}
              className="h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="h-9 flex-1 min-w-[12rem] rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            />
            <Button size="sm" className="h-9 text-xs" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {form.id ? "Update rate" : "Add rate"}
            </Button>
            {form.id && (
              <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => setForm(emptyForm())}>
                Cancel edit
              </Button>
            )}
          </div>
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search item or supplier..."
        className="h-8 px-3 rounded border bg-[hsl(var(--background))] text-xs w-full sm:w-56"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#1faca6]" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-12">
          {rates.length === 0 ? "No rates yet. Add the first item and supplier rate." : "No rates match this search."}
        </p>
      ) : (
        <div className="space-y-3">
          {grouped.map((item) => (
            <div key={item.itemName} className="rounded-lg border overflow-hidden">
              <div className="px-3 py-2 bg-[hsl(var(--muted))]/40 border-b">
                <p className="text-sm font-semibold">{item.itemName}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {item.suppliers.length} supplier{item.suppliers.length === 1 ? "" : "s"} ·{" "}
                  {item.suppliers.reduce((n, s) => n + s.rows.length, 0)} rate
                  {item.suppliers.reduce((n, s) => n + s.rows.length, 0) === 1 ? "" : "s"}
                </p>
              </div>
              {item.suppliers.map((sup) => {
                const currentDate = currentRateDate(sup.rows)
                return (
                <div key={`${item.itemName}-${sup.supplier}`} className="border-b last:border-b-0">
                  <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
                    <p className="text-[11px] font-semibold text-[#1faca6]">{sup.supplier}</p>
                    {!readOnly && (
                      <button
                        type="button"
                        className="text-[10px] text-[#1faca6] cursor-pointer"
                        onClick={() => {
                          setForm({
                            itemName: item.itemName,
                            supplier: sup.supplier,
                            rate: 0,
                            rateDate: todayDate(),
                            notes: "",
                            createdBy: currentUser,
                          })
                          document.getElementById("rate-book-form")?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }}
                      >
                        + Add another date
                      </button>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">
                        <th className="px-3 pb-1 text-left font-medium">Date</th>
                        <th className="px-3 pb-1 text-right font-medium">Rate</th>
                        <th className="px-3 pb-1 text-left font-medium hidden sm:table-cell">Notes</th>
                        {!readOnly && <th className="px-3 pb-1 text-right font-medium">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sup.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-[hsl(var(--muted))]/20">
                          <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                            {row.rateDate || "—"}
                            {timingBadge(rateTiming(row.rateDate, currentDate))}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                            PKR {row.rate.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))] hidden sm:table-cell max-w-[14rem] truncate">
                            {row.notes || "—"}
                          </td>
                          {!readOnly && (
                            <td className="px-3 py-1.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                className="text-blue-600 text-xs mr-3 cursor-pointer"
                                onClick={() => setForm({ ...row })}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="text-red-600 text-xs cursor-pointer"
                                onClick={() => setDeleteId(row.id)}
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete rate"
        message="Remove this supplier rate from the book? Existing Q2 quotations keep the snapshot they already saved."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
