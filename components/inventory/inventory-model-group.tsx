"use client"

import type { MouseEvent } from "react"
import type { InventorySerialUnit } from "@/lib/inventory-serial-units"
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

  return (
    <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      {isEditing ? (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[hsl(var(--border))]"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            placeholder="Friendly name"
            autoFocus
            className="h-7 min-w-[120px] flex-1 max-w-sm rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveName()
              if (e.key === "Escape") onCancelEdit()
            }}
          />
          <Button type="button" size="sm" className="h-7 text-[10px] px-2" disabled={savingModelLabel} onClick={onSaveName}>
            {savingModelLabel ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={onCancelEdit}>
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[hsl(var(--muted))]/15"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
          )}
          <span className="min-w-0 flex-1 text-xs font-medium truncate">{title}</span>
          {customName && customName !== modelKey ? (
            <span className="hidden sm:inline text-[10px] font-mono text-[hsl(var(--muted-foreground))] truncate max-w-[36%]">
              {modelKey}
            </span>
          ) : null}
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums shrink-0">
            {inStock}/{count}
          </span>
          <span className="text-[10px] font-medium text-[#1faca6] tabular-nums shrink-0">
            {count} {count === 1 ? "pc" : "pcs"}
          </span>
          <span
            role="button"
            tabIndex={0}
            className="p-0.5 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[#1faca6]"
            onClick={onStartEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onStartEdit(e as unknown as MouseEvent)
            }}
            title="Edit name"
          >
            <Pencil className="h-3 w-3" />
          </span>
        </button>
      )}

      {expanded && (
        <div className="overflow-x-auto border-t border-[hsl(var(--border))]">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="px-3 py-1.5 text-left font-medium text-[hsl(var(--muted-foreground))]">SN</th>
                <th className="px-3 py-1.5 text-left font-medium text-[hsl(var(--muted-foreground))]">Item ref</th>
                <th className="px-3 py-1.5 text-left font-medium text-[hsl(var(--muted-foreground))]">Received</th>
                <th className="px-3 py-1.5 text-left font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {modelUnits.map((unit) => (
                <tr key={unit.id} className="border-b border-[hsl(var(--border))] last:border-b-0">
                  <td className="px-3 py-1.5 font-mono break-all">{unit.serialNumber}</td>
                  <td className="px-3 py-1.5 font-mono text-[hsl(var(--muted-foreground))]">{unit.specs || "—"}</td>
                  <td className="px-3 py-1.5 text-[hsl(var(--muted-foreground))] whitespace-nowrap tabular-nums">
                    {formatDate(unit.scannedAt)}
                  </td>
                  <td className="px-3 py-1.5 capitalize text-[hsl(var(--muted-foreground))]">
                    {unit.status.replace(/_/g, " ")}
                  </td>
                  <td className="px-1 py-1.5 text-right">
                    <button
                      type="button"
                      className="p-1 text-[hsl(var(--muted-foreground))] hover:text-red-600"
                      disabled={deletingId === unit.id}
                      onClick={() => onDeleteUnit(unit)}
                      title="Remove"
                    >
                      {deletingId === unit.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
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
