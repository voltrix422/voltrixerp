"use client"

import { useState, type MouseEvent } from "react"
import type { InventorySerialUnit } from "@/lib/inventory-serial-units"
import { formatGstPercent, formatRetailPricePkr } from "@/lib/format-inventory-price"
import {
  parseSerialDispatchClient,
  parseSerialOrderRef,
} from "@/lib/parse-serial-order-ref"
import { InventoryModelPricePanel } from "@/components/inventory/inventory-model-price-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { StockOnlyMeta } from "@/lib/unified-inventory-groups"
import { ChevronDown, ChevronRight, Loader2, Minus, Pencil, Trash2, X } from "lucide-react"

function formatDate(iso?: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-PK")
  } catch {
    return iso
  }
}

export function InventoryModelGroup({
  modelKey,
  modelUnits,
  expanded,
  onToggle,
  customName,
  isEditing,
  editingName,
  savingModelLabel,
  deletingId,
  deletingModel,
  onEditingNameChange,
  onStartEdit,
  onSaveName,
  onCancelEdit,
  onDeleteUnit,
  onDeleteModel,
  onSubtractManualStock,
  onSubtractManualUnits,
  adjustingManual,
  stockOnly,
}: {
  modelKey: string
  modelUnits: InventorySerialUnit[]
  expanded: boolean
  onToggle: () => void
  customName: string
  isEditing: boolean
  editingName: string
  savingModelLabel: boolean
  deletingId: string | null
  deletingModel?: boolean
  onEditingNameChange: (value: string) => void
  onStartEdit: (e: MouseEvent) => void
  onSaveName: () => void
  onCancelEdit: () => void
  onDeleteUnit: (unit: InventorySerialUnit) => void
  onDeleteModel: () => void | Promise<boolean | void>
  onSubtractManualStock?: (manualId: string, qty: number) => boolean | Promise<boolean>
  onSubtractManualUnits?: (manualId: string, qty: number) => boolean | Promise<boolean>
  adjustingManual?: { id: string; mode: "stock" | "units" } | null
  stockOnly?: StockOnlyMeta
}) {
  const count = modelUnits.length > 0 ? modelUnits.length : (stockOnly?.total ?? 0)
  const inStock =
    modelUnits.length > 0
      ? modelUnits.filter((u) => u.status === "in_stock").length
      : (stockOnly?.inStock ?? 0)
  const unitLabel = stockOnly?.unit || "pcs"
  const title = customName || modelKey
  const hasSerials = modelUnits.length > 0

  const [pricePanelOpen, setPricePanelOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustMode, setAdjustMode] = useState<"stock" | "units">("stock")
  const [adjustQty, setAdjustQty] = useState("1")

  const manualId = stockOnly?.manualId
  const isManualStock = Boolean(stockOnly?.isManual && manualId)
  const isAdjusting =
    Boolean(manualId && adjustingManual?.id === manualId && adjustingManual?.mode === adjustMode)

  function openPricePanel() {
    if (!isEditing) setPricePanelOpen(true)
  }

  function openAdjust(mode: "stock" | "units") {
    setAdjustMode(mode)
    setAdjustQty("1")
    setAdjustOpen(true)
  }

  async function confirmAdjust() {
    if (!manualId) return
    const qty = Math.floor(Number(adjustQty))
    const max = adjustMode === "stock" ? inStock : count
    if (!Number.isFinite(qty) || qty <= 0 || qty > max) return
    const ok =
      adjustMode === "stock"
        ? await onSubtractManualStock?.(manualId, qty)
        : await onSubtractManualUnits?.(manualId, qty)
    if (ok) setAdjustOpen(false)
  }

  return (
    <div className="bg-[hsl(var(--background))]">
      <InventoryModelPricePanel
        open={pricePanelOpen}
        onClose={() => setPricePanelOpen(false)}
        modelKey={modelKey}
        title={title}
        modelUnits={modelUnits}
        inStock={inStock}
        total={count}
        deletingId={deletingId}
        deletingModel={deletingModel}
        onDeleteUnit={onDeleteUnit}
        onDeleteModel={async () => {
          const ok = await onDeleteModel()
          if (ok !== false) setPricePanelOpen(false)
        }}
      />
      {isEditing ? (
        <div
          className="flex flex-wrap items-center gap-2.5 px-4 py-3 bg-[hsl(var(--muted))]/10"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            placeholder="Friendly name"
            autoFocus
            className="h-9 min-w-[140px] flex-1 max-w-sm rounded-lg border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveName()
              if (e.key === "Escape") onCancelEdit()
            }}
          />
          <Button type="button" size="sm" className="h-9 text-xs px-3" disabled={savingModelLabel} onClick={onSaveName}>
            {savingModelLabel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-9 text-xs px-3" onClick={onCancelEdit}>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="sm:hidden px-3 py-3 hover:bg-[hsl(var(--muted))]/12 transition-colors">
            <div className="flex gap-2">
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/20"
                onClick={onToggle}
                aria-expanded={expanded}
                title="Expand serial numbers"
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <button
                type="button"
                className="flex-1 min-w-0 text-left rounded-md py-0.5 pr-1 hover:bg-[#1faca6]/5"
                onClick={openPricePanel}
                title="Click for prices"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold leading-snug break-words text-[hsl(var(--foreground))]">
                    {title}
                  </span>
                  {stockOnly?.isManual && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      Manual
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[11px] font-mono text-[hsl(var(--muted-foreground))] break-all leading-relaxed">
                  {modelKey}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Stock{" "}
                    <span className="font-semibold tabular-nums text-[hsl(var(--foreground))]">
                      {inStock}/{count}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-[#1faca6]">
                    {count} {count === 1 ? unitLabel.replace(/s$/, "") : unitLabel}
                  </span>
                </div>
              </button>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1 pl-10">
              {isManualStock ? (
                <>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-amber-600 hover:bg-amber-500/10 disabled:opacity-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      openAdjust("stock")
                    }}
                    disabled={inStock <= 0 || isAdjusting}
                    title="Subtract from stock"
                  >
                    {isAdjusting && adjustingManual?.mode === "stock" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Minus className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-orange-600 hover:bg-orange-500/10 disabled:opacity-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      openAdjust("units")
                    }}
                    disabled={count <= 0 || isAdjusting}
                    title="Subtract units"
                  >
                    {isAdjusting && adjustingManual?.mode === "units" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-bold">U−</span>
                    )}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:text-[#1faca6] hover:bg-[hsl(var(--muted))]/20"
                onClick={onStartEdit}
                title="Edit name"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation()
                  void onDeleteModel()
                }}
                disabled={deletingModel || count === 0}
                title="Delete model"
              >
                {deletingModel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Desktop table row */}
          <div className="hidden sm:grid w-full grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_88px_88px_minmax(100px,1fr)] gap-3 items-center px-4 py-3.5 hover:bg-[hsl(var(--muted))]/12 transition-colors">
            <button
              type="button"
              className="flex items-center justify-center p-0.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/20 shrink-0"
              onClick={onToggle}
              aria-expanded={expanded}
              title="Expand serial numbers"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="col-span-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_88px] gap-3 items-center min-w-0 text-left cursor-pointer rounded-md -my-1 py-1 hover:bg-[#1faca6]/5"
              onClick={openPricePanel}
              title="Click for prices"
            >
              <span className="min-w-0 text-sm font-medium truncate flex items-center gap-1.5">
                {title}
                {stockOnly?.isManual && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    Manual
                  </Badge>
                )}
              </span>
              <span className="min-w-0 text-xs font-mono text-[hsl(var(--muted-foreground))] truncate">
                {modelKey}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums text-right">
                {inStock}/{count}
                {isManualStock && count > inStock && (
                  <span className="block text-[10px] font-normal text-amber-700 dark:text-amber-400">
                    {count - inStock} out
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-[#1faca6] tabular-nums text-right">
                {count} {count === 1 ? unitLabel.replace(/s$/, "") : unitLabel}
              </span>
            </button>
            <div className="flex justify-end items-center gap-0.5 shrink-0">
              {isManualStock ? (
                <>
                  <button
                    type="button"
                    className="p-1 rounded-md text-amber-600 hover:bg-amber-500/10 disabled:opacity-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      openAdjust("stock")
                    }}
                    disabled={inStock <= 0 || isAdjusting}
                    title="Subtract from stock (available qty)"
                  >
                    {isAdjusting && adjustingManual?.mode === "stock" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Minus className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded-md text-orange-600 hover:bg-orange-500/10 disabled:opacity-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      openAdjust("units")
                    }}
                    disabled={count <= 0 || isAdjusting}
                    title="Subtract from units (total qty)"
                  >
                    {isAdjusting && adjustingManual?.mode === "units" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-bold leading-none px-0.5">U−</span>
                    )}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="p-1 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[#1faca6]"
                onClick={onStartEdit}
                title="Edit name"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="p-1 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-red-600 disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation()
                  void onDeleteModel()
                }}
                disabled={deletingModel || count === 0}
                title="Delete model and all serial numbers"
              >
                {deletingModel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </>
      )}

      {expanded && (
        <div className="overflow-x-auto border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/5">
          {!hasSerials ? (
            <div className="px-4 py-4 text-xs text-[hsl(var(--muted-foreground))] space-y-2">
              <p>
                <span className="font-semibold text-[hsl(var(--foreground))]">{inStock}</span> of{" "}
                <span className="font-semibold text-[hsl(var(--foreground))]">{count}</span>{" "}
                {unitLabel} available
                {stockOnly?.isManual ? " (manual inventory)" : ""}.
              </p>
              {isManualStock ? (
                <p>
                  Use <span className="font-medium text-amber-600">−</span> to subtract from stock only, or{" "}
                  <span className="font-medium text-orange-600">U−</span> to subtract from total units.
                </p>
              ) : (
                <p>Scan QR codes at dispatch or use Scan QR above to register serial numbers.</p>
              )}
            </div>
          ) : (
          <>
            <div className="sm:hidden divide-y divide-[hsl(var(--border))]/60">
              {modelUnits.map((unit) => {
                const orderRef = parseSerialOrderRef(unit.notes, unit.specs)
                const client = parseSerialDispatchClient(unit.notes)
                return (
                  <div key={unit.id} className="px-3 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-xs break-all leading-relaxed">{unit.serialNumber}</p>
                      <button
                        type="button"
                        className="shrink-0 p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-500/10"
                        disabled={deletingId === unit.id}
                        onClick={() => onDeleteUnit(unit)}
                        title="Remove"
                      >
                        {deletingId === unit.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      <span className="text-[hsl(var(--muted-foreground))]">Order</span>
                      <span className="font-mono text-right">{orderRef ?? "—"}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">Client</span>
                      <span className="text-right truncate">{client ?? "—"}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">Retail</span>
                      <span className="text-right tabular-nums">{formatRetailPricePkr(unit.retailPrice)}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">GST</span>
                      <span className="text-right tabular-nums">{formatGstPercent(unit.gstPercent)}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">Received</span>
                      <span className="text-right tabular-nums">{formatDate(unit.scannedAt)}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">Status</span>
                      <span className="text-right capitalize">{unit.status.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <table className="hidden sm:table w-full text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">SN</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Order</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Client</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Retail</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">GST</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Received</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {modelUnits.map((unit) => {
                  const orderRef = parseSerialOrderRef(unit.notes, unit.specs)
                  const client = parseSerialDispatchClient(unit.notes)
                  return (
                  <tr key={unit.id} className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--muted))]/8">
                    <td className="px-4 py-2.5 font-mono text-xs break-all">{unit.serialNumber}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{orderRef ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{client ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {formatRetailPricePkr(unit.retailPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {formatGstPercent(unit.gstPercent)}
                    </td>
                    <td className="px-4 py-2.5 text-[hsl(var(--muted-foreground))] whitespace-nowrap tabular-nums">
                      {formatDate(unit.scannedAt)}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-[hsl(var(--muted-foreground))]">
                      {unit.status.replace(/_/g, " ")}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-500/10"
                        disabled={deletingId === unit.id}
                        onClick={() => onDeleteUnit(unit)}
                        title="Remove"
                      >
                        {deletingId === unit.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </>
          )}
        </div>
      )}

      {adjustOpen && isManualStock ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAdjustOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border bg-[hsl(var(--background))] p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-sm font-semibold">
                  {adjustMode === "stock" ? "Subtract from stock" : "Subtract from units"}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{title}</p>
              </div>
              <button
                type="button"
                className="p-1 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/20"
                onClick={() => setAdjustOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
              {adjustMode === "stock" ? (
                <>
                  Current stock: <span className="font-semibold text-[hsl(var(--foreground))]">{inStock}</span> /{" "}
                  {count} {unitLabel}
                </>
              ) : (
                <>
                  Current units: <span className="font-semibold text-[hsl(var(--foreground))]">{count}</span>{" "}
                  {unitLabel} ({inStock} in stock)
                </>
              )}
            </p>
            <label className="block text-xs font-medium mb-1.5">Quantity to subtract</label>
            <input
              type="number"
              min={1}
              max={adjustMode === "stock" ? inStock : count}
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAdjustOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isAdjusting}
                onClick={() => void confirmAdjust()}
              >
                {isAdjusting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Subtract"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
