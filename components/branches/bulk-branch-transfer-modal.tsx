"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react"
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
  requiresApproval?: boolean
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
  requiresApproval = false,
  onSubmit,
}: Props) {
  const [toBranchId, setToBranchId] = useState("")
  const [lineState, setLineState] = useState<Record<string, LineState>>({})
  const [productSearch, setProductSearch] = useState("")
  const [destOpen, setDestOpen] = useState(false)
  const [destSearch, setDestSearch] = useState("")

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

  const filteredDestinations = useMemo(() => {
    const q = destSearch.trim().toLowerCase()
    if (!q) return destinations
    return destinations.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        b.type.replace(/_/g, " ").toLowerCase().includes(q),
    )
  }, [destinations, destSearch])

  const selectedDestination = destinations.find((b) => b.id === toBranchId) || null

  const visibleProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        (p.sublabel || "").toLowerCase().includes(q) ||
        (p.model || "").toLowerCase().includes(q),
    )
  }, [products, productSearch])

  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }

    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true

    if (justOpened) {
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
      setProductSearch("")
      setDestSearch("")
      setDestOpen(false)
      return
    }

    // Parent re-rendered with new `products` reference — keep selections, sync new rows only
    setLineState((prev) => {
      const next: Record<string, LineState> = { ...prev }
      for (const p of products) {
        if (!next[p.id]) {
          next[p.id] = { selected: false, qty: "", note: "" }
        }
      }
      for (const id of Object.keys(next)) {
        if (!products.some((p) => p.id === id)) delete next[id]
      }
      return next
    })
  }, [open, products, preselectedProductId])

  const selectableProducts = useMemo(
    () => products.filter((p) => p.selectable !== false),
    [products],
  )

  function selectAll() {
    setLineState((prev) => {
      const next = { ...prev }
      for (const p of selectableProducts) {
        const cur = next[p.id] ?? { selected: false, qty: "", note: "" }
        next[p.id] = {
          ...cur,
          selected: true,
          qty: cur.qty.trim() ? cur.qty : p.maxQty > 0 ? "1" : "",
        }
      }
      return next
    })
  }

  function clearSelection() {
    setLineState((prev) => {
      const next = { ...prev }
      for (const p of products) {
        if (next[p.id]) {
          next[p.id] = { ...next[p.id], selected: false }
        }
      }
      return next
    })
  }

  function toggleLine(id: string, product: BulkTransferProduct) {
    if (product.selectable === false) return
    const state = lineState[id] ?? { selected: false, qty: "", note: "" }
    const nextSelected = !state.selected
    updateLine(id, {
      selected: nextSelected,
      qty: nextSelected && !state.qty.trim() ? (product.maxQty > 0 ? "1" : "") : state.qty,
    })
  }

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

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-3 sm:p-6"
      style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
      onClick={onClose}
    >
      <div
        className="relative z-[1] flex h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-[22px] border border-white/40 bg-[#f5f5f7]/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[hsl(var(--card))]/95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-6 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              {title}
            </p>
            <p className="mt-0.5 text-[12px] text-[#86868b]">
              {requiresApproval
                ? "Stock moves after approval. Each line saves its own transfer record."
                : "Pick destination, select products, set qty. SN units link automatically when available."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] cursor-pointer dark:bg-white/10 dark:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <div className="relative shrink-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
              Destination
            </p>
            <button
              type="button"
              onClick={() => setDestOpen((v) => !v)}
              className="flex h-11 w-full items-center justify-between gap-3 rounded-[14px] border-0 bg-white px-3.5 text-left shadow-sm ring-1 ring-black/[0.06] cursor-pointer dark:bg-[hsl(var(--background))] dark:ring-white/10"
            >
              <span className="min-w-0 truncate">
                {selectedDestination ? (
                  <>
                    <span className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                      {selectedDestination.name}
                    </span>
                    <span className="ml-2 text-[12px] text-[#86868b]">
                      {selectedDestination.code} · {selectedDestination.type.replace(/_/g, " ")}
                    </span>
                  </>
                ) : (
                  <span className="text-[14px] text-[#86868b]">Choose branch…</span>
                )}
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-[#86868b] transition-transform ${destOpen ? "rotate-180" : ""}`} />
            </button>
            {destOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDestOpen(false)} />
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-xl dark:border-white/10 dark:bg-[hsl(var(--card))]">
                  <div className="border-b border-black/[0.06] p-2 dark:border-white/10">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#aeaeb2]" />
                      <input
                        value={destSearch}
                        onChange={(e) => setDestSearch(e.target.value)}
                        placeholder="Search branches…"
                        autoFocus
                        className="h-9 w-full rounded-[10px] border-0 bg-[#f2f2f7] pl-8 pr-3 text-[13px] outline-none dark:bg-white/10"
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-1.5">
                    {filteredDestinations.length === 0 ? (
                      <p className="px-3 py-4 text-center text-[12px] text-[#86868b]">No matches</p>
                    ) : (
                      filteredDestinations.map((b) => {
                        const active = b.id === toBranchId
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setToBranchId(b.id)
                              setDestOpen(false)
                              setDestSearch("")
                            }}
                            className={`flex w-full items-center justify-between gap-2 rounded-[12px] px-3 py-2.5 text-left cursor-pointer ${
                              active ? "bg-[#1a9f9a]/12" : "hover:bg-black/[0.04] dark:hover:bg-white/5"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                                {b.name}
                              </span>
                              <span className="block truncate text-[11px] text-[#86868b]">
                                {b.code} · {b.type.replace(/_/g, " ")}
                              </span>
                            </span>
                            {active ? <Check className="h-4 w-4 shrink-0 text-[#1a9f9a]" /> : null}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
                Products · {selectedLines.length} selected · {visibleProducts.length} shown
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#aeaeb2]" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products…"
                    className="h-8 w-[11rem] rounded-full border-0 bg-white pl-8 pr-3 text-[12px] shadow-sm ring-1 ring-black/[0.06] outline-none sm:w-[14rem] dark:bg-[hsl(var(--background))] dark:ring-white/10"
                  />
                </div>
                {selectableProducts.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={selectAll}
                      className="h-8 rounded-full bg-black/[0.06] px-3 text-[11px] font-semibold text-[#1d1d1f] cursor-pointer hover:bg-black/[0.09] dark:bg-white/10 dark:text-white"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={selectedLines.length === 0}
                      className="h-8 rounded-full bg-black/[0.06] px-3 text-[11px] font-semibold text-[#1d1d1f] cursor-pointer hover:bg-black/[0.09] disabled:opacity-40 dark:bg-white/10 dark:text-white"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {products.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-[#86868b]">No stock to send</p>
            ) : visibleProducts.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-[#86868b]">No matches</p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleProducts.map((p) => {
                    const state = lineState[p.id] ?? { selected: false, qty: "", note: "" }
                    const disabled = p.selectable === false
                    const qtyError =
                      state.selected && !disabled ? getQtyValidationError(state.qty, p.maxQty) : null
                    return (
                      <div
                        key={p.id}
                        role={disabled ? undefined : "button"}
                        tabIndex={disabled ? undefined : 0}
                        className={`rounded-[16px] bg-white p-3 shadow-sm ring-1 transition-colors dark:bg-[hsl(var(--background))] ${
                          state.selected
                            ? "ring-[#1a9f9a] bg-[#1a9f9a]/[0.06]"
                            : "ring-black/[0.05] dark:ring-white/10"
                        } ${disabled ? "opacity-55" : "cursor-pointer hover:ring-[#1a9f9a]/40"}`}
                        onClick={() => !disabled && toggleLine(p.id, p)}
                        onKeyDown={(e) => {
                          if (!disabled && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault()
                            toggleLine(p.id, p)
                          }
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              state.selected
                                ? "border-[#1a9f9a] bg-[#1a9f9a] text-white"
                                : "border-black/15 dark:border-white/20"
                            }`}
                          >
                            {state.selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                              {p.label}
                            </p>
                            {p.sublabel ? (
                              <p className="truncate text-[11px] text-[#aeaeb2]">{p.sublabel}</p>
                            ) : null}
                            <p className="mt-1 text-[12px] tabular-nums font-medium text-[#1a9f9a]">
                              {p.maxQty} {p.unit} available
                            </p>
                          </div>
                        </div>
                        {state.selected && (
                          <div className="mt-3 space-y-2 border-t border-black/[0.05] pt-3 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
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
                                className={`h-9 w-20 rounded-[10px] border-0 bg-[#f2f2f7] px-2 text-center text-[13px] tabular-nums outline-none dark:bg-white/10 ${
                                  qtyError ? "ring-1 ring-[#ff3b30]" : ""
                                }`}
                              />
                              <button
                                type="button"
                                className="h-9 rounded-full bg-black/[0.06] px-3 text-[11px] font-semibold cursor-pointer dark:bg-white/10"
                                onClick={() => updateLine(p.id, { qty: String(p.maxQty) })}
                              >
                                Max
                              </button>
                              {qtyError ? (
                                <p className="text-[11px] text-[#ff3b30]">{qtyError}</p>
                              ) : null}
                            </div>
                            <input
                              value={state.note}
                              onChange={(e) => updateLine(p.id, { note: e.target.value })}
                              placeholder="Note (optional)"
                              className="h-9 w-full rounded-[10px] border-0 bg-[#f2f2f7] px-3 text-[12px] outline-none dark:bg-white/10"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-black/[0.06] bg-white/70 px-5 py-4 sm:px-6 dark:border-white/10 dark:bg-black/20">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 flex-1 rounded-full bg-black/[0.06] text-[14px] font-semibold text-[#1d1d1f] cursor-pointer hover:bg-black/[0.09] disabled:opacity-40 dark:bg-white/10 dark:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !toBranchId || selectedLines.length === 0 || hasInvalidSelectedQty}
            onClick={() => void handleSubmit()}
            className="inline-flex h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-[#1a9f9a] text-[14px] font-semibold text-white cursor-pointer hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : requiresApproval ? (
              `Submit ${selectedLines.length} for approval`
            ) : (
              `${mode === "dispatch" ? "Send" : "Transfer"} ${selectedLines.length}`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
