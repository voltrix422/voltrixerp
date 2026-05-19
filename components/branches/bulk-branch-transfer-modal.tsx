"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, X } from "lucide-react"
import type { Branch } from "@/lib/branches"

export type BulkTransferProduct = {
  id: string
  label: string
  sublabel?: string
  model?: string
  productName?: string
  maxQty: number
  unit: string
  inventoryId?: string
  fromBranchInventoryId?: string
  selectable?: boolean
  unselectableReason?: string
}

type LineState = {
  selected: boolean
  qty: string
  note: string
}

function getQtyValidationError(qtyStr: string, maxQty: number): string | null {
  if (!qtyStr.trim()) return "Enter quantity"
  const qty = parseFloat(qtyStr)
  if (isNaN(qty) || qty <= 0) return "Enter a valid quantity"
  if (qty > maxQty) return `Cannot exceed ${maxQty} available`
  return null
}

function clampQtyInput(raw: string, maxQty: number): string {
  if (raw === "" || raw === ".") return raw
  const qty = parseFloat(raw)
  if (isNaN(qty)) return raw
  if (qty > maxQty) return String(maxQty)
  if (qty < 0) return "0"
  return raw
}

type Props = {
  open: boolean
  onClose: () => void
  title: string
  mode: "dispatch" | "transfer"
  products: BulkTransferProduct[]
  branches: Branch[]
  currentBranchId: string
  destinationFilter?: (branch: Branch) => boolean
  preselectedProductId?: string | null
  submitting?: boolean
  onSubmit: (payload: {
    toBranchId: string
    lines: Array<{
      inventoryId?: string
      fromBranchInventoryId?: string
      quantity: number
      unit?: string
      userNote?: string
    }>
  }) => Promise<void>
}

export function BulkBranchTransferModal({
  open,
  onClose,
  title,
  mode,
  products,
  branches,
  currentBranchId,
  destinationFilter,
  preselectedProductId,
  submitting = false,
  onSubmit,
}: Props) {
  const [toBranchId, setToBranchId] = useState("")
  const [lineState, setLineState] = useState<Record<string, LineState>>({})

  const destinations = useMemo(
    () =>
      branches.filter(
        (b) =>
          b.id !== currentBranchId &&
          b.status === "active" &&
          (destinationFilter ? destinationFilter(b) : true),
      ),
    [branches, currentBranchId, destinationFilter],
  )

  useEffect(() => {
    if (!open) return
    const initial: Record<string, LineState> = {}
    for (const p of products) {
      const preselected = preselectedProductId === p.id
      initial[p.id] = {
        selected: preselected && p.selectable !== false,
        qty: preselected && p.maxQty > 0 ? "1" : "",
        note: "",
      }
    }
    setLineState(initial)
    setToBranchId("")
  }, [open, products, preselectedProductId])

  function updateLine(id: string, patch: Partial<LineState>) {
    setLineState((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }))
  }

  const selectedLines = useMemo(() => {
    return products
      .map((p) => {
        const state = lineState[p.id]
        if (!state?.selected || p.selectable === false) return null
        if (getQtyValidationError(state.qty, p.maxQty)) return null
        const qty = parseFloat(state.qty)
        return {
          product: p,
          quantity: qty,
          userNote: state.note.trim(),
        }
      })
      .filter(Boolean) as Array<{
      product: BulkTransferProduct
      quantity: number
      userNote: string
    }>
  }, [products, lineState])

  const hasInvalidSelectedQty = useMemo(() => {
    return products.some((p) => {
      const state = lineState[p.id]
      if (!state?.selected || p.selectable === false) return false
      return Boolean(getQtyValidationError(state.qty, p.maxQty))
    })
  }, [products, lineState])

  async function handleSubmit() {
    if (!toBranchId || selectedLines.length === 0 || hasInvalidSelectedQty) return
    await onSubmit({
      toBranchId,
      lines: selectedLines.map(({ product, quantity, userNote }) => ({
        inventoryId: product.inventoryId,
        fromBranchInventoryId: product.fromBranchInventoryId,
        model: product.model,
        productName: product.productName || product.label,
        quantity,
        unit: product.unit,
        userNote: userNote || undefined,
      })),
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
              Select products, set qty and a note for each. Scanned inventory is linked automatically — each line saves its own transfer history record.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1">
            <label className="text-xs font-medium">Destination</label>
            <select
              value={toBranchId}
              onChange={(e) => setToBranchId(e.target.value)}
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            >
              <option value="">-- Select destination --</option>
              {destinations.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code}) — {b.type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Products ({selectedLines.length} selected)</p>
            {products.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">No products available.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {products.map((p) => {
                  const state = lineState[p.id] ?? { selected: false, qty: "", note: "" }
                  const disabled = p.selectable === false
                  const qtyError =
                    state.selected && !disabled
                      ? getQtyValidationError(state.qty, p.maxQty)
                      : null
                  return (
                    <div
                      key={p.id}
                      className={`rounded-lg border p-3 space-y-2 ${state.selected ? "border-[#1faca6] bg-[#1faca6]/5" : "bg-[hsl(var(--background))]"} ${disabled ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border cursor-pointer"
                          checked={state.selected}
                          disabled={disabled}
                          onChange={(e) =>
                            updateLine(p.id, {
                              selected: e.target.checked,
                              qty: e.target.checked && !state.qty ? "1" : state.qty,
                            })
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{p.label}</p>
                          {p.sublabel && (
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{p.sublabel}</p>
                          )}
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                            Available: {p.maxQty} {p.unit}
                            {disabled && p.unselectableReason ? ` · ${p.unselectableReason}` : ""}
                          </p>
                        </div>
                        {state.selected && (
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={p.maxQty}
                              step={1}
                              value={state.qty}
                              onChange={(e) =>
                                updateLine(p.id, { qty: clampQtyInput(e.target.value, p.maxQty) })
                              }
                              onBlur={(e) =>
                                updateLine(p.id, { qty: clampQtyInput(e.target.value, p.maxQty) })
                              }
                              className={`w-16 h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs text-center ${
                                qtyError ? "border-red-500 focus:ring-red-500" : ""
                              }`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-[10px] px-2"
                              onClick={() => updateLine(p.id, { qty: String(p.maxQty) })}
                            >
                              Max
                            </Button>
                            </div>
                            {qtyError && (
                              <p className="text-[10px] text-red-600 max-w-[140px] text-right leading-tight">
                                {qtyError}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {state.selected && (
                        <div className="pl-6 space-y-1">
                          <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                            Note for this transfer
                          </label>
                          <textarea
                            value={state.note}
                            onChange={(e) => updateLine(p.id, { note: e.target.value })}
                            rows={2}
                            placeholder={`Note for ${p.label}…`}
                            className="w-full rounded-md border bg-[hsl(var(--background))] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-9" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1 h-9 bg-[#1faca6] hover:bg-[#17857f] text-white"
            disabled={submitting || !toBranchId || selectedLines.length === 0 || hasInvalidSelectedQty}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                Saving…
              </>
            ) : (
              `${mode === "dispatch" ? "Send" : "Transfer"} ${selectedLines.length} product${selectedLines.length === 1 ? "" : "s"}`
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
