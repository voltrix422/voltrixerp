"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, Plus, Trash2, Calculator, X, Search, FileDown, FolderOpen } from "lucide-react"
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
import {
  downloadInstallmentEstimatePdf,
  generateInstallmentEstimatePdf,
} from "@/lib/generate-installment-estimate-pdf"

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
    structureRsPerWatt?: number
    raisedRsPerWatt?: number
    raisedMaxFt?: number
    advancePercent?: number
    months?: number
    breakdown?: {
      cost?: number
      advance?: number
      remainingY?: number
      financedAmount?: number
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
  return `PKR ${Math.round(n).toLocaleString()}`
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

function defaultSizedLines(systemKw = 10) {
  const watts = Math.max(0, Math.round(systemKw * 1000))
  return [
    newLine("Panels", String(watts * DEFAULT_PANEL_RS_PER_WATT), "panels"),
    newLine("BOS", String(watts * DEFAULT_BOS_RS_PER_WATT), "bos"),
    newLine("Installation", String(watts * DEFAULT_INSTALLATION_RS_PER_WATT), "installation"),
    newLine("Transportation", "15000", "transport"),
    newLine(
      "Structure (L2/L3)",
      String(Math.round(watts * DEFAULT_STRUCTURE_RS_PER_WATT)),
      "structure",
    ),
    newLine(
      "Raised structure",
      String(Math.round(watts * DEFAULT_RAISED_RS_PER_WATT)),
      "raised",
    ),
  ]
}

const fieldClass =
  "w-full h-8 rounded-[10px] border-0 bg-[#f2f2f7] px-2.5 text-[12px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#007aff]/25"
const labelClass = "block text-[10px] font-medium text-[#86868b] mb-0.5"

export function InstallmentsEstimate() {
  const { user } = useAuth()
  const canWrite = canWriteInstallments(user?.role)
  const [view, setView] = useState<"calculator" | "saved">("calculator")
  const [saved, setSaved] = useState<SavedEstimate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pdfBusy, setPdfBusy] = useState<string | null>(null)
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
    () => lines.map((line) => ({ ...line, amountNum: Number(line.amount) || 0 })),
    [lines],
  )

  const breakdown = useMemo(
    () =>
      calcInstallmentBreakdown({
        systemKw: kwNum,
        panelRsPerWatt: Number.isFinite(panelRsPerWattNum)
          ? panelRsPerWattNum
          : DEFAULT_PANEL_RS_PER_WATT,
        bosRsPerWatt: Number.isFinite(bosRsPerWattNum) ? bosRsPerWattNum : DEFAULT_BOS_RS_PER_WATT,
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

  useEffect(() => {
    const updates: Record<string, number> = {
      panels: Math.round(breakdown.panelAmount),
      bos: Math.round(breakdown.bosAmount),
      installation: Math.round(breakdown.installationAmount),
      structure: Math.round(breakdown.structureFromRsPerWatt),
      raised: Math.round(breakdown.raisedStructureAmount),
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
  }, [
    breakdown.panelAmount,
    breakdown.bosAmount,
    breakdown.installationAmount,
    breakdown.structureFromRsPerWatt,
    breakdown.raisedStructureAmount,
  ])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(
        `/api/db/installments/estimates?actorUserId=${encodeURIComponent(user.id)}`,
      )
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
          .sort((a, b) => a.name.localeCompare(b.name))
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
    const label = product.model ? `${product.name} (${product.model})` : product.name
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
            const amount = Number.isFinite(Number(l.amount))
              ? Number(l.amount)
              : Number.isFinite(Number(l.rate))
                ? Number(l.rate)
                : 0
            return {
              id: `${row.id}-${i}`,
              name: l.name,
              amount: String(amount),
              kind: l.kind,
              productId: l.productId,
              model: l.model,
              qty: l.qty != null ? String(l.qty) : l.kind === "product" ? "1" : undefined,
              unitPrice:
                l.unitPrice != null
                  ? String(l.unitPrice)
                  : l.kind === "product"
                    ? String(amount)
                    : undefined,
            }
          })
        : defaultSizedLines(Number(row.systemKw) || 10)
    setLines(nextLines)
    setView("calculator")
  }

  function pdfPayloadFromForm() {
    return {
      title: title.trim() || `${kwNum || 10} kW estimate`,
      clientName: clientName.trim(),
      systemKw: kwNum,
      notes: notes.trim(),
      lines: amountLines
        .filter((l) => l.name.trim())
        .map((l) => ({
          name: l.name.trim(),
          amount: l.amountNum,
          qty: Number(l.qty) || undefined,
          model: l.model,
        })),
      breakdown,
      panelRsPerWatt: Number.isFinite(panelRsPerWattNum)
        ? panelRsPerWattNum
        : DEFAULT_PANEL_RS_PER_WATT,
      bosRsPerWatt: Number.isFinite(bosRsPerWattNum) ? bosRsPerWattNum : DEFAULT_BOS_RS_PER_WATT,
      installationRsPerWatt: Number.isFinite(installationRsPerWattNum)
        ? installationRsPerWattNum
        : DEFAULT_INSTALLATION_RS_PER_WATT,
      structureRsPerWatt: Number(structureRsPerWatt) || DEFAULT_STRUCTURE_RS_PER_WATT,
      raisedRsPerWatt: Number(raisedRsPerWatt) || DEFAULT_RAISED_RS_PER_WATT,
    }
  }

  function pdfPayloadFromSaved(row: SavedEstimate) {
    const ws = row.worksheet || {}
    const bd = calcInstallmentBreakdown({
      systemKw: row.systemKw,
      panelRsPerWatt: ws.panelRsPerWatt,
      bosRsPerWatt: ws.bosRsPerWatt,
      installationRsPerWatt: ws.installationRsPerWatt,
      structureRsPerWatt: ws.structureRsPerWatt,
      raisedRsPerWatt: ws.raisedRsPerWatt,
      advancePercent: ws.advancePercent,
      factor: row.factor,
      months: ws.months,
      lines: (row.lines || []).map((l) => ({ amount: Number(l.amount) || 0 })),
    })
    return {
      title: row.title || `${row.systemKw} kW estimate`,
      clientName: row.clientName || "",
      systemKw: row.systemKw,
      notes: row.notes || "",
      lines: (row.lines || []).map((l) => ({
        name: l.name,
        amount: Number(l.amount) || 0,
        qty: l.qty,
        model: l.model,
      })),
      breakdown: bd,
      panelRsPerWatt: ws.panelRsPerWatt,
      bosRsPerWatt: ws.bosRsPerWatt,
      installationRsPerWatt: ws.installationRsPerWatt,
      structureRsPerWatt: ws.structureRsPerWatt,
      raisedRsPerWatt: ws.raisedRsPerWatt,
    }
  }

  async function exportPdf(source: "form" | SavedEstimate) {
    const key = source === "form" ? "form" : source.id
    setPdfBusy(key)
    setError("")
    try {
      const payload = source === "form" ? pdfPayloadFromForm() : pdfPayloadFromSaved(source)
      const blob = await generateInstallmentEstimatePdf(payload)
      const safe = (payload.title || "estimate").replace(/[^\w.-]+/g, "_").slice(0, 48)
      downloadInstallmentEstimatePdf(blob, `Voltrix-Estimate-${safe}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF export failed")
    } finally {
      setPdfBusy(null)
    }
  }

  async function saveEstimate(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id || !canWrite) return
    if (kwNum <= 0) {
      setError("Enter system size in kW.")
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
          bosRsPerWatt: Number.isFinite(bosRsPerWattNum) ? bosRsPerWattNum : DEFAULT_BOS_RS_PER_WATT,
          installationRsPerWatt: Number.isFinite(installationRsPerWattNum)
            ? installationRsPerWattNum
            : DEFAULT_INSTALLATION_RS_PER_WATT,
          factor: factorNum || DEFAULT_FACTOR,
          advancePercent: advanceNum || DEFAULT_ADVANCE_PERCENT,
          months: monthsNum || DEFAULT_MONTHS,
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
      setView("saved")
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

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f]">Estimate</h1>
          <p className="text-[11px] text-[#86868b]">
            Cost − {advanceNum || 26}% → Y × {factorNum || 1.5} ÷ {monthsNum || 18}
          </p>
        </div>
        <div className="inline-flex rounded-full bg-[#e8e8ed] p-0.5">
          {(
            [
              { id: "calculator" as const, label: "Calculator", icon: Calculator },
              { id: "saved" as const, label: `Saved (${saved.length})`, icon: FolderOpen },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`h-8 px-3.5 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                view === tab.id
                  ? "bg-white text-[#1d1d1f] shadow-sm"
                  : "text-[#6e6e73] hover:text-[#1d1d1f]"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-[12px] text-[#ff3b30] bg-[#ff3b30]/08 rounded-[12px] px-3 py-2">{error}</p>
      ) : null}

      {view === "saved" ? (
        <div className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          {loading ? (
            <p className="text-center text-[12px] text-[#86868b] py-12">Loading…</p>
          ) : saved.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <p className="text-[13px] font-medium text-[#1d1d1f]">No saved estimates</p>
              <button
                type="button"
                onClick={() => setView("calculator")}
                className="text-[12px] font-semibold text-[#007aff] cursor-pointer"
              >
                Open calculator
              </button>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.045]">
              {saved.map((row) => {
                const monthly =
                  row.worksheet?.breakdown?.monthlyInstallment ??
                  Math.round((Number(row.totalAmount) || 0) / DEFAULT_MONTHS)
                const cost = row.worksheet?.breakdown?.cost
                return (
                  <div
                    key={row.id}
                    className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between hover:bg-[#f5f8ff]"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                        {row.title || "—"}
                      </p>
                      <p className="text-[11px] text-[#86868b] mt-0.5">
                        {row.clientName || "No client"} · {row.systemKw} kW ·{" "}
                        {new Date(row.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-[#aeaeb2]">Cost</p>
                        <p className="text-[12px] tabular-nums text-[#6e6e73]">
                          {cost != null ? money(cost) : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-[#aeaeb2]">Monthly</p>
                        <p className="text-[13px] font-semibold tabular-nums text-[#007aff]">
                          {money(monthly)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void exportPdf(row)}
                          disabled={pdfBusy === row.id}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-full text-[#007aff] hover:bg-[#007aff]/08 cursor-pointer disabled:opacity-50"
                          title="Export PDF"
                        >
                          {pdfBusy === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadIntoForm(row)}
                          className="h-8 px-3 rounded-full text-[11px] font-semibold text-[#007aff] hover:bg-[#007aff]/08 cursor-pointer"
                        >
                          Open
                        </button>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => void deleteEstimate(row.id)}
                            className="h-8 px-2.5 rounded-full text-[11px] font-semibold text-[#ff3b30] hover:bg-[#ff3b30]/08 cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={saveEstimate} className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 items-start">
            <div className="space-y-3 min-w-0">
              <div className="rounded-[16px] border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-[#1d1d1f]">
                    {editingId ? "Edit estimate" : "New estimate"}
                  </p>
                  {editingId ? (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-[11px] font-semibold text-[#007aff] cursor-pointer"
                    >
                      New
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className={labelClass}>System kW</label>
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      value={systemKw}
                      onChange={(e) => setSystemKw(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Panel Rs/W</label>
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      value={panelRsPerWatt}
                      onChange={(e) => setPanelRsPerWatt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>BOS Rs/W</label>
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      value={bosRsPerWatt}
                      onChange={(e) => setBosRsPerWatt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Install Rs/W</label>
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      value={installationRsPerWatt}
                      onChange={(e) => setInstallationRsPerWatt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Structure Rs/W</label>
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      value={structureRsPerWatt}
                      onChange={(e) => setStructureRsPerWatt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Raised Rs/W</label>
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      value={raisedRsPerWatt}
                      onChange={(e) => setRaisedRsPerWatt(e.target.value)}
                    />
                  </div>
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
                    <label className={labelClass}>Factor / Months</label>
                    <div className="flex gap-1.5">
                      <input
                        className={fieldClass}
                        inputMode="decimal"
                        value={factor}
                        onChange={(e) => setFactor(e.target.value)}
                        title="Factor"
                      />
                      <input
                        className={fieldClass}
                        inputMode="numeric"
                        value={months}
                        onChange={(e) => setMonths(e.target.value)}
                        title="Months"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Client</label>
                    <input
                      className={fieldClass}
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Title</label>
                    <input
                      className={fieldClass}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={`${kwNum || 10} kW estimate`}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-[#aeaeb2] tabular-nums">
                  {breakdown.systemWatts.toLocaleString()} W · raised ≤ {raisedMaxFt} ft
                </p>
              </div>

              <div className="rounded-[16px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="px-3.5 py-2 border-b border-black/[0.05] flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-[#1d1d1f]">Cost lines</p>
                  <p className="text-[12px] font-semibold tabular-nums">{money(breakdown.cost)}</p>
                </div>
                <div className="max-h-[280px] overflow-y-auto divide-y divide-black/[0.04]">
                  {amountLines.map((line) => {
                    const isProduct = line.kind === "product"
                    return (
                      <div key={line.id} className="px-3 py-2 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <input
                            className="w-full h-7 rounded-lg border-0 bg-[#f2f2f7] px-2 text-[12px] outline-none focus:ring-2 focus:ring-[#007aff]/25"
                            value={line.name}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.id === line.id ? { ...l, name: e.target.value } : l,
                                ),
                              )
                            }
                          />
                        </div>
                        {isProduct ? (
                          <input
                            className="w-12 h-7 rounded-lg border-0 bg-[#f2f2f7] px-1.5 text-[12px] tabular-nums outline-none"
                            inputMode="numeric"
                            value={line.qty ?? "1"}
                            onChange={(e) => {
                              const qty = e.target.value
                              setLines((prev) =>
                                prev.map((l) => {
                                  if (l.id !== line.id) return l
                                  const unit = Number(l.unitPrice) || 0
                                  return {
                                    ...l,
                                    qty,
                                    amount: String(Math.round(unit * (Number(qty) || 0))),
                                  }
                                }),
                              )
                            }}
                          />
                        ) : null}
                        <input
                          className="w-[6.5rem] h-7 rounded-lg border-0 bg-[#f2f2f7] px-2 text-[12px] tabular-nums outline-none"
                          inputMode="decimal"
                          value={line.amount}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.id === line.id ? { ...l, amount: e.target.value } : l,
                              ),
                            )
                          }
                        />
                        {lines.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                            className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/08 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                <div className="px-3 py-2 border-t border-black/[0.05] flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowProductPicker(true)}
                    className="h-7 px-2.5 rounded-full bg-[#007aff] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, newLine("", "", "other")])}
                    className="h-7 px-2.5 rounded-full text-[11px] font-semibold text-[#007aff] hover:bg-[#007aff]/08 cursor-pointer"
                  >
                    + Custom
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  className="w-full min-h-[52px] rounded-[10px] border-0 bg-white border border-black/[0.06] px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-[#007aff]/25 resize-y"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="lg:sticky lg:top-3 space-y-2">
              <div className="rounded-[16px] border border-black/[0.06] bg-[#f5f8ff] p-3.5 space-y-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#007aff]">
                  Breakdown
                </p>
                {(
                  [
                    ["Cost", money(breakdown.cost)],
                    [`Advance ${breakdown.advancePercent}%`, `− ${money(breakdown.advance)}`],
                    ["Y", money(breakdown.remainingY)],
                    [`Y × ${breakdown.factor}`, money(breakdown.financedAmount)],
                    ["With advance", money(breakdown.actualCost)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 text-[12px]">
                    <span className="text-[#6e6e73]">{k}</span>
                    <span className="font-semibold tabular-nums text-[#1d1d1f]">{v}</span>
                  </div>
                ))}
                <div className="pt-2 mt-1 border-t border-[#007aff]/15">
                  <p className="text-[10px] text-[#86868b]">
                    Monthly · Y×{breakdown.factor}÷{breakdown.months}
                  </p>
                  <p className="text-[22px] font-semibold tracking-tight tabular-nums text-[#007aff]">
                    {money(breakdown.monthlyInstallment)}
                  </p>
                </div>
              </div>
              {canWrite ? (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-9 rounded-full bg-[#007aff] text-white text-[13px] font-semibold hover:bg-[#0066d6] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {editingId ? "Update" : "Save"} estimate
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportPdf("form")}
                    disabled={pdfBusy === "form"}
                    className="h-9 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.03] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {pdfBusy === "form" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" />
                    )}
                    Export PDF
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </form>
      )}

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
                  <p className="text-[14px] font-semibold text-[#1d1d1f]">Add product</p>
                  <button
                    type="button"
                    onClick={() => setShowProductPicker(false)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-4 py-2.5 border-b border-black/[0.05]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#aeaeb2]" />
                    <input
                      className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] pl-8 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-[#007aff]/25"
                      placeholder="Search…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  {catalogLoading ? (
                    <p className="text-center text-[12px] text-[#86868b] py-10">Loading…</p>
                  ) : filteredCatalog.length === 0 ? (
                    <p className="text-center text-[12px] text-[#86868b] py-10">No products</p>
                  ) : (
                    <ul className="divide-y divide-black/[0.045]">
                      {filteredCatalog.map((p) => {
                        const unit = catalogUnitPrice(p)
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => addProductLine(p)}
                              className="w-full text-left px-4 py-3 hover:bg-[#f5f8ff] cursor-pointer"
                            >
                              <div className="flex justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                                    {p.name}
                                  </p>
                                  {p.model ? (
                                    <p className="text-[11px] font-mono text-[#86868b]">{p.model}</p>
                                  ) : null}
                                </div>
                                <p className="text-[13px] font-semibold tabular-nums shrink-0">
                                  {unit > 0 ? money(unit) : "Quote"}
                                </p>
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
