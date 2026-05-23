"use client"

import { useCallback, useRef, useState, type MouseEvent } from "react"
import type { InventorySerialUnit } from "@/lib/inventory-serial-units"
import { formatGstPercent, formatRetailPricePkr } from "@/lib/format-inventory-price"
import { InventoryModelPricePanel } from "@/components/inventory/inventory-model-price-panel"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react"

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
  onEditingNameChange,
  onStartEdit,
  onSaveName,
  onCancelEdit,
  onDeleteUnit,
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
  onEditingNameChange: (value: string) => void
  onStartEdit: (e: MouseEvent) => void
  onSaveName: () => void
  onCancelEdit: () => void
  onDeleteUnit: (unit: InventorySerialUnit) => void
}) {
  const count = modelUnits.length
  const inStock = modelUnits.filter((u) => u.status === "in_stock").length
  const title = customName || modelKey

  const [pricePanelOpen, setPricePanelOpen] = useState(false)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }, [])

  const schedulePricePanel = useCallback(() => {
    if (isEditing) return
    clearOpenTimer()
    openTimerRef.current = setTimeout(() => setPricePanelOpen(true), 400)
  }, [isEditing, clearOpenTimer])

  const cancelScheduledPricePanel = useCallback(() => {
    clearOpenTimer()
  }, [clearOpenTimer])

  const closePricePanel = useCallback(() => {
    clearOpenTimer()
    setPricePanelOpen(false)
  }, [clearOpenTimer])

  return (
    <div className="bg-[hsl(var(--background))]">
      <InventoryModelPricePanel
        open={pricePanelOpen}
        onClose={closePricePanel}
        modelKey={modelKey}
        title={title}
        modelUnits={modelUnits}
        inStock={inStock}
        total={count}
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
        <button
          type="button"
          className="w-full grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_88px_88px_64px] sm:grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_88px_88px_64px] gap-3 items-center px-4 py-3.5 text-left hover:bg-[hsl(var(--muted))]/12 transition-colors cursor-pointer"
          onClick={onToggle}
          onMouseEnter={schedulePricePanel}
          onMouseLeave={cancelScheduledPricePanel}
          aria-expanded={expanded}
          title="Hover for prices · click to expand units"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
          )}
          <span className="min-w-0 text-sm font-medium truncate text-left">{title}</span>
          <span className="min-w-0 text-xs font-mono text-[hsl(var(--muted-foreground))] truncate text-left hidden sm:block">
            {modelKey}
          </span>
          <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums text-right sm:col-start-4 col-start-3">
            {inStock}/{count}
          </span>
          <span className="text-sm font-semibold text-[#1faca6] tabular-nums text-right sm:col-start-5 col-start-4">
            {count} {count === 1 ? "pc" : "pcs"}
          </span>
          <span
            role="button"
            tabIndex={0}
            className="flex justify-end p-1 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[#1faca6] sm:col-start-6 col-start-5"
            onClick={onStartEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onStartEdit(e as unknown as MouseEvent)
            }}
            title="Edit name"
          >
            <Pencil className="h-4 w-4" />
          </span>
        </button>
      )}

      {expanded && (
        <div className="overflow-x-auto border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/5">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">SN</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Item ref</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Retail</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">GST</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Received</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {modelUnits.map((unit) => (
                <tr key={unit.id} className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--muted))]/8">
                  <td className="px-4 py-2.5 font-mono text-xs break-all">{unit.serialNumber}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[hsl(var(--muted-foreground))]">{unit.specs || "—"}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
