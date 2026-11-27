"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, Plus, Trash2, Calculator, X, Search } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { canWriteInstallments } from "@/lib/auth"
import {
  buildCrmPriceMap,
  getCrmProductPrices,
  type CrmProductPrice,
} from "@/lib/crm-product-prices"
import { getSalePrice } from "@/lib/product-display"
import { isProductPublished } from "@/lib/product-published"
import {
  DEFAULT_ADVANCE_PERCENT,
  DEFAULT_BOS_RS_PER_WATT,
  DEFAULT_FACTOR,
  DEFAULT_INSTALLATION_RS_PER_WATT,
  DEFAULT_MONTHS,
  DEFAULT_PANEL_RS_PER_WATT,
  DEFAULT_RAISED_MAX_FT,
  DEFAULT_RAISED_RS_PER_WATT,
  DEFAULT_STRUCTURE_RS_PER_WATT,
  calcInstallmentBreakdown,
} from "@/lib/installment-estimate"

type CostLine = {
  id: string
  name: string
  amount: string
  kind?: string
  productId?: string
  model?: string
  qty?: string
  unitPrice?: string
}

type CatalogProduct = {
  id: string
  name: string
  model: string
  category: string
  price: number
  dealershipPrice: number
  quoteMode: boolean
}

type SavedEstimate = {
  id: string
  title: string
  clientName: string
  systemKw: number
  factor: number
  lines: {
    name: string
    amount?: number
    rate?: number
    kind?: string
    productId?: string
    model?: string
    qty?: number
    unitPrice?: number
  }[]
  worksheet?: {
    panelRsPerWatt?: number
    bosRsPerWatt?: number
    installationRsPerWatt?: number
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

function newLine(
  name = "",
  amount = "",
  kind?: string,
  extra?: Partial<CostLine>,
): CostLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    amount,
    kind,
    ...extra,
  }
}

function catalogUnitPrice(p: CatalogProduct) {
  if (p.dealershipPrice > 0) return p.dealershipPrice
  if (p.price > 0) return p.price
  return 0
}

function defaultLines(opts?: {
  panelAmount?: number
  bosAmount?: number
  installationAmount?: number
}): CostLine[] {
  const panelAmount = opts?.panelAmount ?? 0
  const bosAmount = opts?.bosAmount ?? 0
  const installationAmount = opts?.installationAmount ?? 0
  return [
    newLine("Panels", panelAmount > 0 ? String(Math.round(panelAmount)) : "", "panels"),
    newLine("BOS", bosAmount > 0 ? String(Math.round(bosAmount)) : "", "bos"),
    newLine(
      "Installation",
      installationAmount > 0 ? String(Math.round(installationAmount)) : "",
      "installation",
    ),
    newLine("Transportation", "15000", "transport"),
    newLine("Structure (L2/L3)", "", "structure"),
    newLine("Raised structure", "", "raised"),
  ]
}

function defaultSizedLines(systemKw = 10) {
  const watts = Math.max(0, Math.round(systemKw * 1000))
  return defaultLines({
    panelAmount: watts * DEFAULT_PANEL_RS_PER_WATT,
    bosAmount: watts * DEFAULT_BOS_RS_PER_WATT,
    installationAmount: watts * DEFAULT_INSTALLATION_RS_PER_WATT,
  })
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
  const [panelRsPerWatt, setPanelRsPerWatt] = useState(String(DEFAULT_PANEL_RS_PER_WATT))
  const [bosRsPerWatt, setBosRsPerWatt] = useState(String(DEFAULT_BOS_RS_PER_WATT))
  const [installationRsPerWatt, setInstallationRsPerWatt] = useState(
    String(DEFAULT_INSTALLATION_RS_PER_WATT),
  )
  const [factor, setFactor] = useState(String(DEFAULT_FACTOR))
  const [advancePercent, setAdvancePercent] = useState(String(DEFAULT_ADVANCE_PERCENT))
  const [months, setMonths] = useState(String(DEFAULT_MONTHS))
  const [structureRsPerWatt, setStructureRsPerWatt] = useState(
    String(DEFAULT_STRUCTURE_RS_PER_WATT),
  )
  const [raisedRsPerWatt, setRaisedRsPerWatt] = useState(String(DEFAULT_RAISED_RS_PER_WATT))
  const [raisedMaxFt] = useState(String(DEFAULT_RAISED_MAX_FT))
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<CostLine[]>(() => defaultSizedLines(10))
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [productSearch, setProductSearch] = useState("")

  const kwNum = Number(systemKw) || 0
  const panelRsPerWattNum = Number(panelRsPerWatt)
  const bosRsPerWattNum = Number(bosRsPerWatt)
  const installationRsPerWattNum = Number(installationRsPerWatt)
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
        panelRsPerWatt: Number.isFinite(panelRsPerWattNum)
          ? panelRsPerWattNum
          : DEFAULT_PANEL_RS_PER_WATT,
        bosRsPerWatt: Number.isFinite(bosRsPerWattNum)
          ? bosRsPerWattNum
          : DEFAULT_BOS_RS_PER_WATT,
        installationRsPerWatt: Number.isFinite(installationRsPerWattNum)
          ? installationRsPerWattNum
          : DEFAULT_INSTALLATION_RS_PER_WATT,
        structureRsPerWatt: Number(structureRsPerWatt) || 0,
        raisedRsPerWatt: Number(raisedRsPerWatt) || 0,
        advancePercent: advanceNum,
        factor: factorNum,
        months: monthsNum,
        lines: amountLines.map((l) => ({ amount: l.amountNum })),
      }),
    [
      kwNum,
      panelRsPerWattNum,
      bosRsPerWattNum,
      installationRsPerWattNum,
      structureRsPerWatt,
      raisedRsPerWatt,
      advanceNum,
      factorNum,
      monthsNum,
      amountLines,
    ],
  )

  // Keep Panels / BOS / Installation = system watts × Rs/watt when sizing changes.
  useEffect(() => {
    const updates: Record<string, number> = {
      panels: Math.round(breakdown.panelAmount),
      bos: Math.round(breakdown.bosAmount),
      installation: Math.round(breakdown.installationAmount),
    }
    setLines((prev) => {
      let changed = false
      const next = prev.map((l) => {
        const kind = l.kind || ""
        if (!(kind in updates)) return l
        const amount = String(updates[kind])
        if (String(Math.round(Number(l.amount) || 0)) === amount) return l
        changed = true
        return { ...l, amount }
      })
      return changed ? next : prev
    })
  }, [breakdown.panelAmount, breakdown.bosAmount, breakdown.installationAmount])

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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setCatalogLoading(true)
      try {
        const [productsRes, crmPrices] = await Promise.all([
          fetch("/api/products", { cache: "no-store" }).then((r) => r.json()),
          getCrmProductPrices().catch(() => [] as CrmProductPrice[]),
        ])
        if (cancelled) return
        const priceMap = buildCrmPriceMap(Array.isArray(crmPrices) ? crmPrices : [])
        const list = Array.isArray(productsRes) ? productsRes : []
        const mapped: CatalogProduct[] = list
          .filter((p: Record<string, unknown>) => isProductPublished(p))
          .map((p: Record<string, unknown>) => {
            const model = String(p.model ?? "").trim()
            const crm = model ? priceMap.get(model.toLowerCase()) : undefined
            const webPrice = getSalePrice({
              price: p.price as number | string | null,
              quoteMode: Boolean(p.quoteMode),
            })
            return {
              id: String(p.id ?? ""),
              name: String(p.name ?? "").trim() || model || "Product",
              model,
              category: String(p.category ?? "").trim(),
              price: webPrice ?? 0,
              dealershipPrice: Number(crm?.dealershipPrice) || 0,
              quoteMode: Boolean(p.quoteMode) || (webPrice ?? 0) <= 0,
            }
          })
          .filter((p: CatalogProduct) => p.id)
          .sort((a: CatalogProduct, b: CatalogProduct) => a.name.localeCompare(b.name))
        setCatalog(mapped)
      } catch {
        if (!cancelled) setCatalog([])
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredCatalog = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return catalog
    return catalog.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    )
  }, [catalog, productSearch])

  function addProductLine(product: CatalogProduct) {
    const unit = catalogUnitPrice(product)
    const label = product.model
      ? `${product.name} (${product.model})`
      : product.name
    setLines((prev) => [
      ...prev,
      newLine(label, String(unit || ""), "product", {
        productId: product.id,
        model: product.model,
        qty: "1",
        unitPrice: String(unit || ""),
      }),
    ])
    setShowProductPicker(false)
    setProductSearch("")
  }

  function resetForm() {
    setEditingId(null)
    setTitle("")
    setClientName("")
    setSystemKw("10")
    setPanelRsPerWatt(String(DEFAULT_PANEL_RS_PER_WATT))
    setBosRsPerWatt(String(DEFAULT_BOS_RS_PER_WATT))
    setInstallationRsPerWatt(String(DEFAULT_INSTALLATION_RS_PER_WATT))
    setFactor(String(DEFAULT_FACTOR))
    setAdvancePercent(String(DEFAULT_ADVANCE_PERCENT))
    setMonths(String(DEFAULT_MONTHS))
    setStructureRsPerWatt(String(DEFAULT_STRUCTURE_RS_PER_WATT))
    setRaisedRsPerWatt(String(DEFAULT_RAISED_RS_PER_WATT))
    setNotes("")
    setLines(defaultSizedLines(10))
  }

  function loadIntoForm(row: SavedEstimate) {
    setEditingId(row.id)
    setTitle(row.title || "")
    setClientName(row.clientName || "")
    setSystemKw(String(row.systemKw ?? ""))
    setFactor(String(row.factor ?? DEFAULT_FACTOR))
    const ws = row.worksheet || {}
    setPanelRsPerWatt(String(ws.panelRsPerWatt ?? DEFAULT_PANEL_RS_PER_WATT))
    setBosRsPerWatt(String(ws.bosRsPerWatt ?? DEFAULT_BOS_RS_PER_WATT))
    setInstallationRsPerWatt(String(ws.installationRsPerWatt ?? DEFAULT_INSTALLATION_RS_PER_WATT))
    setAdvancePercent(String(ws.advancePercent ?? DEFAULT_ADVANCE_PERCENT))
    setMonths(String(ws.months ?? DEFAULT_MONTHS))
    setStructureRsPerWatt(String(ws.structureRsPerWatt ?? DEFAULT_STRUCTURE_RS_PER_WATT))
    setRaisedRsPerWatt(String(ws.raisedRsPerWatt ?? DEFAULT_RAISED_RS_PER_WATT))
    setNotes(row.notes || "")
    const nextLines =
      Array.isArray(row.lines) && row.lines.length > 0
        ? row.lines.map((l, i) => {
            const raw = l as {
              name: string
              amount?: number
              rate?: number
              kind?: string
              productId?: string
              model?: string
              qty?: number
              unitPrice?: number
            }
            const amount = Number.isFinite(Number(raw.amount))
              ? Number(raw.amount)
              : Number.isFinite(Number(raw.rate))
                ? Number(raw.rate)
                : 0
            return {
              id: `${row.id}-${i}`,
              name: raw.name,
              amount: String(amount),
              kind: raw.kind,
              productId: raw.productId,
              model: raw.model,
              qty: raw.qty != null ? String(raw.qty) : raw.kind === "product" ? "1" : undefined,
              unitPrice:
                raw.unitPrice != null
                  ? String(raw.unitPrice)
                  : raw.kind === "product"
                    ? String(amount)
                    : undefined,
            }
          })
        : defaultSizedLines(Number(row.systemKw) || 10)
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
        ...(l.productId ? { productId: l.productId } : {}),
        ...(l.model ? { model: l.model } : {}),
        ...(l.qty != null ? { qty: Number(l.qty) || 1 } : {}),
        ...(l.unitPrice != null ? { unitPrice: Number(l.unitPrice) || 0 } : {}),
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
          panelRsPerWatt: Number.isFinite(panelRsPerWattNum)
            ? panelRsPerWattNum
            : DEFAULT_PANEL_RS_PER_WATT,
          bosRsPerWatt: Number.isFinite(bosRsPerWattNum)
            ? bosRsPerWattNum
            : DEFAULT_BOS_RS_PER_WATT,
          installationRsPerWatt: Number.isFinite(installationRsPerWattNum)
            ? installationRsPerWattNum
            : DEFAULT_INSTALLATION_RS_PER_WATT,
          factor: factorNum,
          advancePercent: advanceNum,
          months: monthsNum,
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
            Cost − {advanceNum || 26}% → Y × {factorNum || 1.5} + Advance = Actual → ÷{" "}
            {monthsNum || 18}
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
              <label className={labelClass}>Panel rate (Rs/W)</label>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={panelRsPerWatt}
                onChange={(e) => setPanelRsPerWatt(e.target.value)}
                placeholder="4"
              />
            </div>
            <div>
              <label className={labelClass}>BOS rate (Rs/W)</label>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={bosRsPerWatt}
                onChange={(e) => setBosRsPerWatt(e.target.value)}
                placeholder="8"
              />
            </div>
            <div>
              <label className={labelClass}>Installation (Rs/W)</label>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={installationRsPerWatt}
                onChange={(e) => setInstallationRsPerWatt(e.target.value)}
                placeholder="3"
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[12px]">
              <div>
                <p className="text-[#86868b]">System watts</p>
                <p className="font-semibold tabular-nums text-[#1d1d1f]">
                  {breakdown.systemWatts.toLocaleString()} W
                </p>
              </div>
              <div>
                <p className="text-[#86868b]">Panel / BOS / Install</p>
                <p className="text-[10px] text-[#6e6e73] mt-0.5 tabular-nums">
                  {money(breakdown.panelAmount)} · {money(breakdown.bosAmount)} ·{" "}
                  {money(breakdown.installationAmount)}
                </p>
              </div>
              <div>
                <p className="text-[#86868b]">Raised max height</p>
                <p className="font-semibold tabular-nums text-[#1d1d1f]">
                  ≤ {raisedMaxFt} ft
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
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
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#86868b] w-[5rem]">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#86868b] w-[9rem]">
                    Amount (PKR)
                  </th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045]">
                {amountLines.map((line) => {
                  const isProduct = line.kind === "product"
                  return (
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
                      {line.model ? (
                        <p className="text-[10px] text-[#aeaeb2] mt-0.5 font-mono">{line.model}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {isProduct ? (
                        <input
                          className="w-full h-8 rounded-lg border-0 bg-[#f2f2f7] px-2.5 text-[12px] tabular-nums outline-none focus:ring-2 focus:ring-[#007aff]/25"
                          inputMode="numeric"
                          value={line.qty ?? "1"}
                          onChange={(e) => {
                            const qty = e.target.value
                            setLines((prev) =>
                              prev.map((l) => {
                                if (l.id !== line.id) return l
                                const unit = Number(l.unitPrice) || 0
                                const q = Number(qty) || 0
                                return {
                                  ...l,
                                  qty,
                                  amount: String(Math.round(unit * q)),
                                }
                              }),
                            )
                          }}
                        />
                      ) : (
                        <span className="text-[12px] text-[#aeaeb2]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full h-8 rounded-lg border-0 bg-[#f2f2f7] px-2.5 text-[12px] tabular-nums outline-none focus:ring-2 focus:ring-[#007aff]/25"
                        inputMode="decimal"
                        value={line.amount}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) => {
                              if (l.id !== line.id) return l
                              const amount = e.target.value
                              if (l.kind === "product") {
                                const q = Number(l.qty) || 1
                                return {
                                  ...l,
                                  amount,
                                  unitPrice: q > 0 ? String(Math.round((Number(amount) || 0) / q)) : l.unitPrice,
                                }
                              }
                              return { ...l, amount }
                            }),
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
                  )
                })}
              </tbody>
            </table>
            <div className="px-3 py-2 border-t border-black/[0.05] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowProductPicker(true)}
                  className="h-7 inline-flex items-center gap-1 px-2.5 rounded-full text-[11px] font-semibold text-white bg-[#007aff] hover:bg-[#0066d6] cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Add product
                </button>
                <button
                  type="button"
                  onClick={() => setLines((prev) => [...prev, newLine("", "", "other")])}
                  className="h-7 inline-flex items-center gap-1 px-2.5 rounded-full text-[11px] font-semibold text-[#007aff] hover:bg-[#007aff]/08 cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Custom cost
                </button>
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
              <span className="text-[#6e6e73]">Y × {breakdown.factor}</span>
              <span className="font-semibold tabular-nums">{money(breakdown.financedAmount)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-[#6e6e73]">
                Actual (Advance + Y × {breakdown.factor})
              </span>
              <span className="font-semibold tabular-nums text-[#1d1d1f]">
                {money(breakdown.actualCost)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-[#007aff]/15">
              <span className="text-[14px] font-semibold text-[#1d1d1f]">
                Monthly (Actual ÷ {breakdown.months})
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

      {showProductPicker && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
              onClick={() => setShowProductPicker(false)}
            >
              <div
                className="w-full sm:max-w-lg max-h-[85vh] rounded-t-[18px] sm:rounded-[18px] border border-black/[0.06] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06]">
                  <div>
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">Add product</p>
                    <p className="text-[11px] text-[#86868b]">
                      Website catalog · dealership price when set
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProductPicker(false)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-4 py-2.5 border-b border-black/[0.05]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#aeaeb2]" />
                    <input
                      className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] pl-8 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-[#007aff]/25"
                      placeholder="Search name or model…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  {catalogLoading ? (
                    <p className="text-center text-[12px] text-[#86868b] py-10">Loading products…</p>
                  ) : filteredCatalog.length === 0 ? (
                    <p className="text-center text-[12px] text-[#86868b] py-10">No products found</p>
                  ) : (
                    <ul className="divide-y divide-black/[0.045]">
                      {filteredCatalog.map((p) => {
                        const unit = catalogUnitPrice(p)
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => addProductLine(p)}
                              className="w-full text-left px-4 py-3 hover:bg-[#f5f8ff] cursor-pointer transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                                    {p.name}
                                  </p>
                                  {p.model ? (
                                    <p className="text-[11px] font-mono text-[#86868b] mt-0.5">
                                      {p.model}
                                    </p>
                                  ) : null}
                                  {p.category ? (
                                    <p className="text-[10px] text-[#aeaeb2] mt-0.5">{p.category}</p>
                                  ) : null}
                                </div>
                                <div className="shrink-0 text-right">
                                  {unit > 0 ? (
                                    <p className="text-[13px] font-semibold tabular-nums text-[#1d1d1f]">
                                      {money(unit)}
                                    </p>
                                  ) : (
                                    <p className="text-[11px] font-medium text-[#9a6700]">Quote</p>
                                  )}
                                  {p.dealershipPrice > 0 && p.price > 0 && p.dealershipPrice !== p.price ? (
                                    <p className="text-[10px] text-[#aeaeb2] tabular-nums">
                                      web {money(p.price)}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
