"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Trash2, Calculator } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { canWriteInstallments } from "@/lib/auth"

type EstimateLine = { id: string; name: string; rate: string }

type SavedEstimate = {
  id: string
  title: string
  clientName: string
  systemKw: number
  factor: number
  lines: { name: string; rate: number; amount: number }[]
  totalAmount: number
  notes: string
  updatedBy: string
  updatedAt: string
}

function money(n: number) {
  return `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function calcAmount(rate: number, kw: number, factor: number) {
  if (!Number.isFinite(rate) || !Number.isFinite(kw) || !Number.isFinite(factor)) return 0
  return Math.round(rate * kw * factor * 100) / 100
}

function newLine(name = ""): EstimateLine {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, rate: "" }
}

export function InstallmentsEstimate() {
  const { user } = useAuth()
  const canWrite = canWriteInstallments(user?.role)
  const [saved, setSaved] = useState<SavedEstimate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [clientName, setClientName] = useState("")
  const [systemKw, setSystemKw] = useState("10")
  const [factor, setFactor] = useState("1.5")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<EstimateLine[]>([
    newLine("Integration cost"),
  ])

  const kwNum = Number(systemKw) || 0
  const factorNum = Number(factor) || 0

  const computedLines = useMemo(
    () =>
      lines.map((line) => {
        const rate = Number(line.rate) || 0
        return {
          ...line,
          rateNum: rate,
          amount: calcAmount(rate, kwNum, factorNum),
        }
      }),
    [lines, kwNum, factorNum],
  )

  const total = useMemo(
    () => Math.round(computedLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
    [computedLines],
  )

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/db/installments/estimates?actorUserId=${encodeURIComponent(user.id)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setSaved(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  function resetForm() {
    setEditingId(null)
    setTitle("")
    setClientName("")
    setSystemKw("10")
    setFactor("1.5")
    setNotes("")
    setLines([newLine("Integration cost")])
  }

  function loadIntoForm(row: SavedEstimate) {
    setEditingId(row.id)
    setTitle(row.title || "")
    setClientName(row.clientName || "")
    setSystemKw(String(row.systemKw ?? ""))
    setFactor(String(row.factor ?? 1.5))
    setNotes(row.notes || "")
    const nextLines = Array.isArray(row.lines) && row.lines.length > 0
      ? row.lines.map((l) => ({
          id: `${row.id}-${l.name}`,
          name: l.name,
          rate: String(l.rate ?? ""),
        }))
      : [newLine("Integration cost")]
    setLines(nextLines)
  }

  async function saveEstimate(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id || !canWrite) return
    if (kwNum <= 0) {
      setError("Enter system size in kW.")
      return
    }
    if (factorNum <= 0) {
      setError("Factor must be greater than 0.")
      return
    }
    const payloadLines = computedLines
      .filter((l) => l.name.trim())
      .map((l) => ({ name: l.name.trim(), rate: l.rateNum, amount: l.amount }))
    if (payloadLines.length === 0) {
      setError("Add at least one cost line.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/db/installments/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          actorUserId: user.id,
          title: title.trim() || `${kwNum} kW estimate`,
          clientName: clientName.trim(),
          systemKw: kwNum,
          factor: factorNum,
          lines: payloadLines,
          notes: notes.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function deleteEstimate(id: string) {
    if (!user?.id || !canWrite) return
    if (!window.confirm("Delete this estimate?")) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/db/installments/estimates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, actorUserId: user.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      if (editingId === id) resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setSaving(false)
    }
  }

  const fieldClass =
    "w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] px-3 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#007aff]/25"
  const labelClass = "block text-[11px] font-medium text-[#6e6e73] mb-1"

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2 justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f]">Estimate</h1>
          <p className="text-[12px] text-[#86868b] mt-0.5">
            Cost × kW × factor ({factorNum || 1.5}) = line total
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="h-8 px-3 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold cursor-pointer"
          >
            New estimate
          </button>
        )}
      </div>

      {error ? (
        <p className="text-[12px] text-[#ff3b30] bg-[#ff3b30]/08 rounded-[12px] px-3.5 py-2.5">{error}</p>
      ) : null}

      <form
        onSubmit={saveEstimate}
        className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-black/[0.05] bg-[#fafafa]">
          <Calculator className="h-3.5 w-3.5 text-[#007aff]" />
          <p className="text-[12px] font-medium text-[#86868b]">
            {editingId ? "Edit estimate" : "New estimate"}
          </p>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>System size (kW)</label>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={systemKw}
                onChange={(e) => setSystemKw(e.target.value)}
                placeholder="10"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Factor</label>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                placeholder="1.5"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Client name</label>
              <input
                className={fieldClass}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>Title</label>
              <input
                className={fieldClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${kwNum || 10} kW estimate`}
              />
            </div>
          </div>

          <div className="rounded-[12px] border border-black/[0.06] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#fafafa] border-b border-black/[0.05]">
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">Cost item</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#86868b] w-[8rem]">Rate</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#86868b] w-[9rem]">Amount</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045]">
                {computedLines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2">
                      <input
                        className="w-full h-8 rounded-lg border-0 bg-[#f2f2f7] px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-[#007aff]/25"
                        value={line.name}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) => (l.id === line.id ? { ...l, name: e.target.value } : l)),
                          )
                        }
                        placeholder="e.g. Integration cost"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full h-8 rounded-lg border-0 bg-[#f2f2f7] px-2.5 text-[12px] tabular-nums outline-none focus:ring-2 focus:ring-[#007aff]/25"
                        inputMode="decimal"
                        value={line.rate}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) => (l.id === line.id ? { ...l, rate: e.target.value } : l)),
                          )
                        }
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-[12px] font-semibold tabular-nums text-[#1d1d1f]">
                      {money(line.amount)}
                      <p className="text-[9px] font-normal text-[#aeaeb2] mt-0.5">
                        {line.rateNum || 0} × {kwNum || 0} × {factorNum || 0}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/08 cursor-pointer"
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 border-t border-black/[0.05] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, newLine()])}
                className="h-7 inline-flex items-center gap-1 px-2.5 rounded-full text-[11px] font-semibold text-[#007aff] hover:bg-[#007aff]/08 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add cost
              </button>
              <p className="text-[14px] font-semibold tabular-nums text-[#1d1d1f]">
                Total {money(total)}
              </p>
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              className="w-full min-h-[64px] rounded-[10px] border-0 bg-[#f2f2f7] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007aff]/25 resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </div>

        {canWrite && (
          <div className="px-4 sm:px-5 py-3 border-t border-black/[0.05] bg-[#fafafa] flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="h-8 px-3 rounded-full text-[12px] font-medium cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="h-8 px-4 rounded-full bg-[#007aff] text-white text-[12px] font-semibold hover:bg-[#0066d6] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {editingId ? "Update estimate" : "Save estimate"}
            </button>
          </div>
        )}
      </form>

      <div className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="px-4 py-3 border-b border-black/[0.05]">
          <p className="text-[13px] font-semibold text-[#1d1d1f]">Saved estimates</p>
        </div>
        {loading ? (
          <p className="text-center text-[12px] text-[#86868b] py-10">Loading…</p>
        ) : saved.length === 0 ? (
          <p className="text-center text-[12px] text-[#86868b] py-10">No estimates yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="bg-[#fafafa] border-b border-black/[0.05]">
                  {["Title", "Client", "kW", "Factor", "Total", "Updated", ""].map((h) => (
                    <th key={h || "a"} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045]">
                {saved.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f5f8ff]">
                    <td className="px-3 py-2.5 text-[12px] font-semibold text-[#1d1d1f]">{row.title || "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#6e6e73]">{row.clientName || "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums">{row.systemKw}</td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums">{row.factor}</td>
                    <td className="px-3 py-2.5 text-[12px] font-semibold tabular-nums text-[#1d1d1f]">
                      {money(row.totalAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[#86868b] whitespace-nowrap">
                      {new Date(row.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => loadIntoForm(row)}
                        className="text-[11px] font-semibold text-[#007aff] hover:underline cursor-pointer mr-2"
                      >
                        Open
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => void deleteEstimate(row.id)}
                          className="text-[11px] font-semibold text-[#ff3b30] hover:underline cursor-pointer"
                        >
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
      </div>
    </div>
  )
}
