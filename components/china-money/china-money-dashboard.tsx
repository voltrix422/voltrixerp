"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Paperclip, Plus, Trash2, Upload, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/ui/toast"
import { canManageChinaMoney } from "@/lib/auth"
import {
  createChinaMoneyTransfer,
  deleteChinaMoneyTransfer,
  listChinaMoneyTransfers,
  type ChinaMoneyTransfer,
} from "@/lib/china-money"
import { uploadFiles } from "@/lib/upload"

const field =
  "w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-3 text-[13px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
const textarea =
  "w-full rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-3 py-2 text-[13px] tracking-tight resize-none focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"

function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency || "USD"} ${amount.toLocaleString()}`
  }
}

export function ChinaMoneyDashboard({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const canEdit = canManageChinaMoney(user?.role)
  const [rows, setRows] = useState<ChinaMoneyTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [proofFiles, setProofFiles] = useState<{ file: File; preview: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    sentAt: new Date().toISOString().slice(0, 10),
    method: "",
    reference: "",
    beneficiary: "",
    notes: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listChinaMoneyTransfers())
    } catch (err) {
      toast({
        title: "Load failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>()
    for (const r of rows) {
      byCurrency.set(r.currency, (byCurrency.get(r.currency) || 0) + r.amount)
    }
    return Array.from(byCurrency.entries())
  }, [rows])

  function addFiles(list: FileList | null) {
    if (!list?.length) return
    const next = Array.from(list).map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : `${file.name}-${file.size}`,
    }))
    setProofFiles((prev) => [...prev, ...next].slice(0, 8))
  }

  function removeFile(index: number) {
    setProofFiles((prev) => {
      const copy = [...prev]
      const [removed] = copy.splice(index, 1)
      if (removed?.file.type.startsWith("image/")) URL.revokeObjectURL(removed.preview)
      return copy
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit || !user) return
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Enter amount", type: "error" })
      return
    }
    setSaving(true)
    try {
      const proofUrls = proofFiles.length
        ? await uploadFiles(
            proofFiles.map((f) => f.file),
            "china-money-proofs",
          )
        : []
      await createChinaMoneyTransfer({
        amount,
        currency: form.currency.trim() || "USD",
        sentAt: form.sentAt,
        method: form.method.trim(),
        reference: form.reference.trim(),
        beneficiary: form.beneficiary.trim(),
        notes: form.notes.trim(),
        proofUrls,
        createdBy: user.name,
        createdById: user.id,
      })
      toast({ title: "Saved", type: "success" })
      proofFiles.forEach((f) => {
        if (f.file.type.startsWith("image/")) URL.revokeObjectURL(f.preview)
      })
      setProofFiles([])
      setForm({
        amount: "",
        currency: "USD",
        sentAt: new Date().toISOString().slice(0, 10),
        method: "",
        reference: "",
        beneficiary: "",
        notes: "",
      })
      setShowForm(false)
      await load()
    } catch (err) {
      toast({
        title: "Save failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string) {
    if (!canEdit || !user) return
    if (!confirm("Delete this transfer?")) return
    try {
      await deleteChinaMoneyTransfer(id, user.id)
      toast({ title: "Deleted", type: "success" })
      await load()
    } catch (err) {
      toast({
        title: "Delete failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {embedded ? (
            <h2 className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              Money to China
            </h2>
          ) : (
            <h1 className="text-[20px] font-semibold tracking-tight text-[#1d1d1f]">Money sent to China</h1>
          )}
          <p className="text-[12px] text-[#86868b]">
            {canEdit ? "Add transfers with proof" : "View only"}
            {totals.length > 0
              ? ` · ${totals.map(([c, a]) => fmtMoney(a, c)).join(" · ")}`
              : ""}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="h-9 inline-flex items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold bg-[#1d1d1f] text-white hover:bg-black cursor-pointer"
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" strokeWidth={2} />}
            {showForm ? "Close" : "Add"}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <form
          onSubmit={submit}
          className="rounded-[16px] border border-black/[0.06] bg-white p-3.5 space-y-2.5 shadow-sm"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input
              className={field}
              inputMode="decimal"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <select
              className={field}
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            >
              <option value="USD">USD</option>
              <option value="CNY">CNY</option>
              <option value="PKR">PKR</option>
              <option value="EUR">EUR</option>
            </select>
            <input
              type="date"
              className={field}
              value={form.sentAt}
              onChange={(e) => setForm((f) => ({ ...f, sentAt: e.target.value }))}
              required
            />
            <input
              className={field}
              placeholder="Method / bank"
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className={field}
              placeholder="Beneficiary"
              value={form.beneficiary}
              onChange={(e) => setForm((f) => ({ ...f, beneficiary: e.target.value }))}
            />
            <input
              className={field}
              placeholder="Reference / TT no."
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            />
          </div>
          <textarea
            className={textarea}
            rows={2}
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex flex-wrap gap-1.5 items-center">
            {proofFiles.map((f, i) => (
              <div
                key={f.preview}
                className="relative h-14 w-14 rounded-[10px] overflow-hidden border border-black/[0.06] bg-[#f2f2f7] flex items-center justify-center"
              >
                {f.file.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5 text-[#86868b]" />
                )}
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/55 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" strokeWidth={2.5} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-14 w-14 rounded-[10px] border border-dashed border-black/[0.12] flex flex-col items-center justify-center gap-0.5 text-[#86868b] hover:bg-black/[0.03] cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="text-[9px] font-medium">Proof</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ""
              }}
            />
            <button
              type="submit"
              disabled={saving}
              className="ml-auto h-9 inline-flex items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold bg-[#1d1d1f] text-white hover:bg-black disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#86868b]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-black/[0.08] py-14 text-center text-[13px] text-[#86868b]">
          No transfers yet
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-[14px] border border-black/[0.06] bg-white px-3.5 py-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] tabular-nums">
                    {fmtMoney(row.amount, row.currency)}
                  </p>
                  <p className="text-[11px] text-[#86868b] mt-0.5 truncate">
                    {[row.sentAt, row.method, row.beneficiary, row.reference]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {row.notes ? (
                    <p className="text-[12px] text-[#6e6e73] mt-1.5 whitespace-pre-wrap leading-snug">
                      {row.notes}
                    </p>
                  ) : null}
                  {row.createdBy ? (
                    <p className="text-[10px] text-[#aeaeb2] mt-1">by {row.createdBy}</p>
                  ) : null}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void onDelete(row.id)}
                    className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full text-red-600 hover:bg-red-500/10 cursor-pointer"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
              {row.proofUrls.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {row.proofUrls.map((url) => {
                    const isImg = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)
                    return (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="h-16 w-16 rounded-[10px] border border-black/[0.06] overflow-hidden flex items-center justify-center bg-[#f2f2f7]"
                      >
                        {isImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Paperclip className="h-4 w-4 text-[#86868b]" />
                        )}
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
