"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Trash2, Calculator } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { canWriteInstallments } from "@/lib/auth"
import {
  DEFAULT_ADVANCE_PERCENT,
  DEFAULT_FACTOR,
  DEFAULT_MONTHS,
  DEFAULT_PANEL_WATT,
  DEFAULT_RAISED_MAX_FT,
  DEFAULT_RAISED_RS_PER_WATT,
  DEFAULT_STRUCTURE_RS_PER_WATT,
  DEFAULT_STRUCTURE_UNIT_PRICE,
  calcInstallmentBreakdown,
} from "@/lib/installment-estimate"

type CostLine = { id: string; name: string; amount: string; kind?: string }

type SavedEstimate = {
  id: string
  title: string
  clientName: string
  systemKw: number
  factor: number
  lines: { name: string; amount?: number; rate?: number; kind?: string }[]
  worksheet?: {
    panelWatt?: number
    structureUnitPrice?: number
    structureRsPerWatt?: number
    raisedRsPerWatt?: number
    raisedMaxFt?: number
    advancePercent?: number
    months?: number
    breakdown?: {
      cost?: number
      advance?: number
      remainingY?: number
      actualCost?: number
      monthlyInstallment?: number
      panelCount?: number
    }
  }
  totalAmount: number
  notes: string
  updatedBy: string
  updatedAt: string
}

function money(n: number) {
  return `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function newLine(name = "", amount = "", kind?: string): CostLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    amount,
    kind,
  }
}

function defaultLines(): CostLine[] {
  return [
    newLine("Panels", "", "panels"),
    newLine("BOS", "", "bos"),
    newLine("Installation", "", "installation"),
    newLine("Transportation", "15000", "transport"),
    newLine("Structure (L2/L3)", "", "structure"),
    newLine("Raised structure", "", "raised"),
  ]
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
  const [panelWatt, setPanelWatt] = useState(String(DEFAULT_PANEL_WATT))
  const [factor, setFactor] = useState(String(DEFAULT_FACTOR))
  const [advancePercent, setAdvancePercent] = useState(String(DEFAULT_ADVANCE_PERCENT))
  const [months, setMonths] = useState(String(DEFAULT_MONTHS))
  const [structureUnitPrice, setStructureUnitPrice] = useState(
    String(DEFAULT_STRUCTURE_UNIT_PRICE),
  )
  const [structureRsPerWatt, setStructureRsPerWatt] = useState(
    String(DEFAULT_STRUCTURE_RS_PER_WATT),
  )
  const [raisedRsPerWatt, setRaisedRsPerWatt] = useState(String(DEFAULT_RAISED_RS_PER_WATT))
  const [raisedMaxFt] = useState(String(DEFAULT_RAISED_MAX_FT))
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<CostLine[]>(defaultLines)

  const kwNum = Number(systemKw) || 0
  const panelWattNum = Number(panelWatt) || 0
  const factorNum = Number(factor) || 0
  const advanceNum = Number(advancePercent) || 0
  const monthsNum = Number(months) || 0

  const amountLines = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        amountNum: Number(line.amount) || 0,
      })),
    [lines],
  )

  const breakdown = useMemo(
    () =>
      calcInstallmentBreakdown({
        systemKw: kwNum,
        panelWatt: panelWattNum,
        structureUnitPrice: Number(structureUnitPrice) || 0,
        structureRsPerWatt: Number(structureRsPerWatt) || 0,
        raisedRsPerWatt: Number(raisedRsPerWatt) || 0,
        advancePercent: advanceNum,
        factor: factorNum,
        months: monthsNum,
        lines: amountLines.map((l) => ({ amount: l.amountNum })),
      }),
    [
      kwNum,
      panelWattNum,
      structureUnitPrice,
      structureRsPerWatt,
      raisedRsPerWatt,
      advanceNum,
      factorNum,
      monthsNum,
      amountLines,
    ],
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
    setPanelWatt(String(DEFAULT_PANEL_WATT))
    setFactor(String(DEFAULT_FACTOR))
    setAdvancePercent(String(DEFAULT_ADVANCE_PERCENT))
    setMonths(String(DEFAULT_MONTHS))
    setStructureUnitPrice(String(DEFAULT_STRUCTURE_UNIT_PRICE))
    setStructureRsPerWatt(String(DEFAULT_STRUCTURE_RS_PER_WATT))
    setRaisedRsPerWatt(String(DEFAULT_RAISED_RS_PER_WATT))
    setNotes("")
    setLines(defaultLines())
  }

  function loadIntoForm(row: SavedEstimate) {
    setEditingId(row.id)
    setTitle(row.title || "")
    setClientName(row.clientName || "")
    setSystemKw(String(row.systemKw ?? ""))
    setFactor(String(row.factor ?? DEFAULT_FACTOR))
    const ws = row.worksheet || {}
    setPanelWatt(String(ws.panelWatt ?? DEFAULT_PANEL_WATT))
    setAdvancePercent(String(ws.advancePercent ?? DEFAULT_ADVANCE_PERCENT))
    setMonths(String(ws.months ?? DEFAULT_MONTHS))
    setStructureUnitPrice(String(ws.structureUnitPrice ?? DEFAULT_STRUCTURE_UNIT_PRICE))
    setStructureRsPerWatt(String(ws.structureRsPerWatt ?? DEFAULT_STRUCTURE_RS_PER_WATT))
    setRaisedRsPerWatt(String(ws.raisedRsPerWatt ?? DEFAULT_RAISED_RS_PER_WATT))
    setNotes(row.notes || "")
    const nextLines =
      Array.isArray(row.lines) && row.lines.length > 0
        ? row.lines.map((l, i) => ({
            id: `${row.id}-${i}`,
            name: l.name,
            amount: String(
              Number.isFinite(Number(l.amount))
                ? Number(l.amount)
                : Number.isFinite(Number(l.rate))
                  ? Number(l.rate)
                  : 0,
            ),
            kind: l.kind,
          }))
        : defaultLines()
    setLines(nextLines)
  }

  function setLineAmountByKind(kind: string, amount: number) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.kind === kind)
      if (idx >= 0) {
        return prev.map((l, i) => (i === idx ? { ...l, amount: String(Math.round(amount)) } : l))
      }
      const name =
        kind === "structure"
          ? "Structure (L2/L3)"
          : kind === "raised"
            ? "Raised structure"
            : kind
      return [...prev, newLine(name, String(Math.round(amount)), kind)]
    })
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
    if (advanceNum <= 0 || advanceNum >= 100) {
      setError("Advance % must be between 0 and 100.")
      return
    }
    if (monthsNum <= 0) {
      setError("Months must be greater than 0.")
      return
    }
    const payloadLines = amountLines
      .filter((l) => l.name.trim())
      .map((l) => ({
        name: l.name.trim(),
        amount: l.amountNum,
        ...(l.kind ? { kind: l.kind } : {}),
      }))
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
          panelWatt: panelWattNum,
          factor: factorNum,
          advancePercent: advanceNum,
          months: monthsNum,
          structureUnitPrice: Number(structureUnitPrice) || DEFAULT_STRUCTURE_UNIT_PRICE,
          structureRsPerWatt: Number(structureRsPerWatt) || DEFAULT_STRUCTURE_RS_PER_WATT,
          raisedRsPerWatt: Number(raisedRsPerWatt) || DEFAULT_RAISED_RS_PER_WATT,
          raisedMaxFt: Number(raisedMaxFt) || DEFAULT_RAISED_MAX_FT,
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
            Cost − {advanceNum || 26}% advance → Y × {factorNum || 1.5} → ÷ {monthsNum || 18} months
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
              <label className={labelClass}>Panel watt</label>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={panelWatt}
                onChange={(e) => setPanelWatt(e.target.value)}
                placeholder="645"
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

          <div className="rounded-[12px] border border-black/[0.06] bg-[#fafafa] px-3.5 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">
              System sizing
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
              <div>
                <p className="text-[#86868b]">System watts</p>
                <p className="font-semibold tabular-nums text-[#1d1d1f]">
                  {breakdown.systemWatts.toLocaleString()} W
                </p>
              </div>
              <div>
                <p className="text-[#86868b]">Panels</p>
                <p className="font-semibold tabular-nums text-[#1d1d1f]">
                  {breakdown.panelCount}
                  <span className="text-[10px] font-normal text-[#aeaeb2] ml-1">
                    ({breakdown.systemWatts}÷{panelWattNum || 0})
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[#86868b]">L2 structures</p>
                <p className="font-semibold tabular-nums text-[#1d1d1f]">
                  {breakdown.structureCount}
                  <span className="text-[10px] font-normal text-[#aeaeb2] ml-1">
                    (panels÷2)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[#86868b]">Raised max height</p>
                <p className="font-semibold tabular-nums text-[#1d1d1f]">
                  ≤ {raisedMaxFt} ft
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="rounded-[10px] bg-white border border-black/[0.05] px-3 py-2">
                <p className="text-[10px] text-[#86868b]">Structure L2 @ unit</p>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    className="w-20 h-7 rounded-lg border-0 bg-[#f2f2f7] px-2 text-[12px] tabular-nums outline-none"
                    inputMode="decimal"
                    value={structureUnitPrice}
                    onChange={(e) => setStructureUnitPrice(e.target.value)}
                  />
                  <span className="text-[11px] text-[#6e6e73] tabular-nums">
                    → {money(breakdown.structureFromUnit)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLineAmountByKind("structure", breakdown.structureFromUnit)}
                  className="mt-1.5 text-[11px] font-semibold text-[#007aff] cursor-pointer"
                >
                  Fill structure line
                </button>
              </div>
              <div className="rounded-[10px] bg-white border border-black/[0.05] px-3 py-2">
                <p className="text-[10px] text-[#86868b]">Structure Rs/watt</p>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    className="w-20 h-7 rounded-lg border-0 bg-[#f2f2f7] px-2 text-[12px] tabular-nums outline-none"
                    inputMode="decimal"
                    value={structureRsPerWatt}
                    onChange={(e) => setStructureRsPerWatt(e.target.value)}
                  />
                  <span className="text-[11px] text-[#6e6e73] tabular-nums">
                    → {money(breakdown.structureFromRsPerWatt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLineAmountByKind("structure", breakdown.structureFromRsPerWatt)}
                  className="mt-1.5 text-[11px] font-semibold text-[#007aff] cursor-pointer"
                >
                  Fill structure line
                </button>
              </div>
              <div className="rounded-[10px] bg-white border border-black/[0.05] px-3 py-2">
                <p className="text-[10px] text-[#86868b]">Raised Rs/watt</p>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    className="w-20 h-7 rounded-lg border-0 bg-[#f2f2f7] px-2 text-[12px] tabular-nums outline-none"
                    inputMode="decimal"
                    value={raisedRsPerWatt}
                    onChange={(e) => setRaisedRsPerWatt(e.target.value)}
                  />
                  <span className="text-[11px] text-[#6e6e73] tabular-nums">
                    → {money(breakdown.raisedStructureAmount)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLineAmountByKind("raised", breakdown.raisedStructureAmount)}
                  className="mt-1.5 text-[11px] font-semibold text-[#007aff] cursor-pointer"
                >
                  Fill raised line
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Advance %</label>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={advancePercent}
                onChange={(e) => setAdvancePercent(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Factor</label>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Months</label>
              <input
                className={fieldClass}
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-[12px] border border-black/[0.06] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#fafafa] border-b border-black/[0.05]">
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">
                    Cost item
                  </th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#86868b] w-[10rem]">
                    Amount (PKR)
                  </th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045]">
                {amountLines.map((line) => (
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
                        placeholder="e.g. Battery / Inverter"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full h-8 rounded-lg border-0 bg-[#f2f2f7] px-2.5 text-[12px] tabular-nums outline-none focus:ring-2 focus:ring-[#007aff]/25"
                        inputMode="decimal"
                        value={line.amount}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id ? { ...l, amount: e.target.value } : l,
                            ),
                          )
                        }
                        placeholder="0"
                      />
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
            <div className="px-3 py-2 border-t border-black/[0.05] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setLines((prev) => [...prev, newLine("", "", "product")])}
                  className="h-7 inline-flex items-center gap-1 px-2.5 rounded-full text-[11px] font-semibold text-[#007aff] hover:bg-[#007aff]/08 cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Add product / cost
                </button>
                {["Battery", "Inverter", "EV Charger", "BESS"].map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setLines((prev) => [...prev, newLine(name, "", "product")])}
                    className="h-7 px-2.5 rounded-full text-[11px] font-medium text-[#6e6e73] border border-black/[0.06] hover:bg-black/[0.03] cursor-pointer"
                  >
                    + {name}
                  </button>
                ))}
              </div>
              <p className="text-[13px] font-semibold tabular-nums text-[#1d1d1f]">
                Cost {money(breakdown.cost)}
              </p>
            </div>
          </div>

          <div className="rounded-[12px] border border-black/[0.06] bg-[#f5f8ff] px-4 py-3 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#007aff]">
              Installment breakdown
            </p>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-[#6e6e73]">Cost</span>
              <span className="font-semibold tabular-nums">{money(breakdown.cost)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-[#6e6e73]">Advance ({breakdown.advancePercent}%)</span>
              <span className="font-semibold tabular-nums text-[#9a6700]">
                − {money(breakdown.advance)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-[#6e6e73]">Remaining Y</span>
              <span className="font-semibold tabular-nums">{money(breakdown.remainingY)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-[#6e6e73]">Actual (Y × {breakdown.factor})</span>
              <span className="font-semibold tabular-nums text-[#1d1d1f]">
                {money(breakdown.actualCost)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-[#007aff]/15">
              <span className="text-[14px] font-semibold text-[#1d1d1f]">
                Monthly × {breakdown.months}
              </span>
              <span className="text-[18px] font-semibold tracking-tight tabular-nums text-[#007aff]">
                {money(breakdown.monthlyInstallment)}
              </span>
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
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-[#fafafa] border-b border-black/[0.05]">
                  {["Title", "Client", "kW", "Cost", "Monthly", "Updated", ""].map((h) => (
                    <th
                      key={h || "a"}
                      className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#86868b]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045]">
                {saved.map((row) => {
                  const bd = row.worksheet?.breakdown
                  const monthly =
                    bd?.monthlyInstallment ??
                    (row.factor > 0 && row.totalAmount
                      ? Math.round((row.totalAmount / DEFAULT_MONTHS) * 100) / 100
                      : 0)
                  const cost = bd?.cost
                  return (
                    <tr key={row.id} className="hover:bg-[#f5f8ff]">
                      <td className="px-3 py-2.5 text-[12px] font-semibold text-[#1d1d1f]">
                        {row.title || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-[#6e6e73]">
                        {row.clientName || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] tabular-nums">{row.systemKw}</td>
                      <td className="px-3 py-2.5 text-[12px] tabular-nums text-[#6e6e73]">
                        {cost != null ? money(cost) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-semibold tabular-nums text-[#1d1d1f]">
                        {money(monthly)}
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
