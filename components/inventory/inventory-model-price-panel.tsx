"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { InventorySerialUnit } from "@/lib/inventory-serial-units"
import { formatGstPercent, formatRetailPricePkr } from "@/lib/format-inventory-price"
import { Search, X, Tag } from "lucide-react"

function formatDate(iso?: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-PK")
  } catch {
    return iso
  }
}

function priceSummary(units: InventorySerialUnit[]): string {
  const prices = units
    .map((u) => u.retailPrice)
    .filter((p): p is number => p != null && Number.isFinite(p))
  if (prices.length === 0) return "No retail prices on file"
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return formatRetailPricePkr(min)
  return `${formatRetailPricePkr(min)} – ${formatRetailPricePkr(max)}`
}

type Props = {
  open: boolean
  onClose: () => void
  modelKey: string
  title: string
  modelUnits: InventorySerialUnit[]
  inStock: number
  total: number
}

export function InventoryModelPricePanel({
  open,
  onClose,
  modelKey,
  title,
  modelUnits,
  inStock,
  total,
}: Props) {
  const [search, setSearch] = useState("")
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) {
      setSearch("")
      return
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 80)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return modelUnits
    return modelUnits.filter((u) => {
      const retail = formatRetailPricePkr(u.retailPrice).toLowerCase()
      const gst = formatGstPercent(u.gstPercent).toLowerCase()
      return (
        u.serialNumber.toLowerCase().includes(q) ||
        (u.specs || "").toLowerCase().includes(q) ||
        (u.status || "").toLowerCase().includes(q) ||
        retail.includes(q) ||
        gst.includes(q)
      )
    })
  }, [modelUnits, search])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      onMouseLeave={onClose}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Price details for ${title}`}
        className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b bg-[hsl(var(--muted))]/15 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[#1faca6] mb-1">
                <Tag className="h-5 w-5 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide">Price & units</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold truncate">{title}</h3>
              <p className="text-sm font-mono text-[hsl(var(--muted-foreground))] mt-0.5">{modelKey}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                <span className="font-medium text-[hsl(var(--foreground))]">{inStock}/{total}</span> in stock
                <span className="mx-2 opacity-40">·</span>
                <span className="font-medium text-[#1faca6]">{total} {total === 1 ? "unit" : "units"}</span>
                <span className="mx-2 opacity-40">·</span>
                Retail: <span className="font-medium text-[hsl(var(--foreground))]">{priceSummary(modelUnits)}</span>
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/30 hover:text-[hsl(var(--foreground))]"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SN, item ref, price, status…"
              className="w-full h-11 rounded-lg border bg-[hsl(var(--background))] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-[hsl(var(--card))] border-b shadow-sm">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Serial no.
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Item ref
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Retail
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  GST
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Received
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    No units match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((unit) => (
                  <tr
                    key={unit.id}
                    className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--muted))]/10"
                  >
                    <td className="px-5 py-3 font-mono text-xs break-all">{unit.serialNumber}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                      {unit.specs || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                      {formatRetailPricePkr(unit.retailPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {formatGstPercent(unit.gstPercent)}
                    </td>
                    <td className="px-5 py-3 text-[hsl(var(--muted-foreground))] whitespace-nowrap tabular-nums">
                      {formatDate(unit.scannedAt)}
                    </td>
                    <td className="px-4 py-3 capitalize text-[hsl(var(--muted-foreground))]">
                      {unit.status.replace(/_/g, " ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 border-t px-5 py-2.5 text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/10">
          Showing {filtered.length} of {modelUnits.length} unit{modelUnits.length !== 1 ? "s" : ""}
          {search.trim() ? ` matching “${search.trim()}”` : ""}
        </div>
      </div>
    </div>,
    document.body,
  )
}
