"use client"

import { useCallback, useEffect, useState } from "react"
import { ExternalLink, Loader2, RefreshCw, Trash2, Wallet } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

type CashbackRequest = {
  id: string
  fullName: string
  cnic: string
  phone: string
  installPlace: string
  productId: string
  productName: string
  quantity: number
  imageUrls: string[]
  notes: string
  cashbackAmount: number | null
  status: string
  adminNotes: string
  reviewedBy: string
  reviewedAt: string | null
  createdAt: string
}

const statusColors: Record<string, string> = {
  new: "bg-blue-50 text-blue-600 border-blue-100",
  reviewing: "bg-amber-50 text-amber-700 border-amber-100",
  approved: "bg-green-50 text-green-700 border-green-100",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-100",
  rejected: "bg-red-50 text-red-600 border-red-100",
}

const statusOptions = ["new", "reviewing", "approved", "paid", "rejected"]

export default function InstallerCashbackManager() {
  const { user } = useAuth()
  const [rows, setRows] = useState<CashbackRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CashbackRequest | null>(null)
  const [updating, setUpdating] = useState(false)
  const [cashbackInput, setCashbackInput] = useState("")
  const [adminNotes, setAdminNotes] = useState("")

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/db/installer-cashback")
      if (res.ok) {
        const data = (await res.json()) as CashbackRequest[]
        setRows(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error("Installer cashback fetch error:", e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  useEffect(() => {
    if (!selected) return
    setCashbackInput(selected.cashbackAmount != null ? String(selected.cashbackAmount) : "")
    setAdminNotes(selected.adminNotes || "")
  }, [selected])

  async function patch(id: string, body: Record<string, unknown>) {
    setUpdating(true)
    try {
      const res = await fetch("/api/db/installer-cashback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reviewedBy: user?.name || user?.email || "", ...body }),
      })
      if (!res.ok) throw new Error("Update failed")
      const updated = (await res.json()) as CashbackRequest
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)))
      setSelected(updated)
    } catch (e) {
      console.error(e)
      alert("Could not update request")
    }
    setUpdating(false)
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this cashback request?")) return
    setUpdating(true)
    try {
      await fetch("/api/db/installer-cashback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setRows((prev) => prev.filter((r) => r.id !== id))
      setSelected(null)
    } catch {
      /* ignore */
    }
    setUpdating(false)
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-[70vh]">
      <div className="w-full md:w-[420px] shrink-0 border-r flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Installer cashback
            </p>
            <p className="text-xs text-muted-foreground">{rows.length} requests</p>
          </div>
          <button type="button" onClick={() => void fetchRows()} className="p-1.5 rounded-lg hover:bg-accent">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
            No cashback requests yet. Public form: /installer-cashback
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors ${selected?.id === r.id ? "bg-accent" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.phone}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {r.productName} · qty {r.quantity}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors[r.status] || statusColors.new}`}>
                      {r.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Select a request to review
          </div>
        ) : (
          <div className="p-6 space-y-5 max-w-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selected.fullName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Submitted {new Date(selected.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selected.status}
                  disabled={updating}
                  onChange={(e) => void patch(selected.id, { status: e.target.value })}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border outline-none cursor-pointer ${statusColors[selected.status] || ""}`}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void deleteRow(selected.id)}
                  disabled={updating}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="rounded-xl border p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Installer</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">CNIC</p>
                  <p className="font-medium">{selected.cnic}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <a href={`tel:${selected.phone}`} className="font-medium hover:underline">
                    {selected.phone}
                  </a>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Install place</p>
                  <p className="font-medium">{selected.installPlace}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Product</p>
                  <p className="font-medium">{selected.productName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Qty</p>
                  <p className="font-medium">{selected.quantity}</p>
                </div>
              </div>
              {selected.notes ? (
                <div>
                  <p className="text-xs text-muted-foreground">Installer notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.notes}</p>
                </div>
              ) : null}
            </div>

            {selected.imageUrls.length > 0 ? (
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Photos</p>
                <div className="flex flex-wrap gap-2">
                  {selected.imageUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="relative w-24 h-24 rounded-lg border overflow-hidden bg-muted/30 group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center">
                        <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Review</p>
              <label className="block text-sm space-y-1">
                <span className="text-xs text-muted-foreground">Cashback amount (PKR)</span>
                <input
                  type="number"
                  min={0}
                  value={cashbackInput}
                  onChange={(e) => setCashbackInput(e.target.value)}
                  className="w-full h-9 rounded-md border px-3 text-sm"
                  placeholder="e.g. 5000"
                />
              </label>
              <label className="block text-sm space-y-1">
                <span className="text-xs text-muted-foreground">Admin notes</span>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Internal notes…"
                />
              </label>
              <button
                type="button"
                disabled={updating}
                onClick={() =>
                  void patch(selected.id, {
                    cashbackAmount: cashbackInput === "" ? null : Number(cashbackInput),
                    adminNotes,
                  })
                }
                className="h-9 px-4 rounded-md bg-[#1a9f9a] text-white text-sm font-medium disabled:opacity-50"
              >
                Save review
              </button>
              {selected.reviewedBy ? (
                <p className="text-[11px] text-muted-foreground">
                  Last reviewed by {selected.reviewedBy}
                  {selected.reviewedAt ? ` · ${new Date(selected.reviewedAt).toLocaleString()}` : ""}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
