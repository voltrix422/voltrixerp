"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import {
  deleteQuoteRate,
  getQuoteRates,
  saveQuoteRate,
  type QuoteRate,
} from "@/lib/quote-rates"

function todayDate() {
  return new Date().toISOString().slice(0, 10)
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
        r.supplier.toLowerCase().includes(q),
    )
  }, [rates, search])

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
          Add item name, supplier, rate, and date. Same item can have many suppliers and dates — Q2 picks which ones to include.
        </p>
      </div>

      {!readOnly && (
        <div className="rounded-lg border p-3 sm:p-4 space-y-3">
          <p className="text-xs font-semibold">{form.id ? "Edit rate" : "Add rate"}</p>
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
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                <th className="h-9 px-3 text-left text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Item</th>
                <th className="h-9 px-3 text-left text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Supplier</th>
                <th className="h-9 px-3 text-right text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Rate</th>
                <th className="h-9 px-3 text-left text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Date</th>
                <th className="h-9 px-3 text-left text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Notes</th>
                {!readOnly && <th className="h-9 px-3 text-right text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-[hsl(var(--muted))]/20">
                  <td className="px-3 py-2 font-medium">{row.itemName}</td>
                  <td className="px-3 py-2">{row.supplier}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    PKR {row.rate.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.rateDate || "—"}</td>
                  <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] max-w-[12rem] truncate">
                    {row.notes || "—"}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-blue-600 text-xs mr-3 cursor-pointer"
                        onClick={() => setForm({ ...row })}
                      >
                        <Pencil className="h-3.5 w-3.5 inline mr-0.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600 text-xs cursor-pointer"
                        onClick={() => setDeleteId(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 inline mr-0.5" />
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
