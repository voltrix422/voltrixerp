"use client"

import { useState } from "react"
import {
  formatMovementDate,
  getReferenceTypeLabel,
  type InventoryMovementRow,
} from "@/lib/inventory-movement-display"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp } from "lucide-react"

function BalanceChip({ before, after, unit }: { before?: number | null; after?: number | null; unit: string }) {
  if (before == null || after == null) {
    return <span className="text-[10px] text-[hsl(var(--muted-foreground))]">—</span>
  }
  return (
    <span className="text-[11px] tabular-nums whitespace-nowrap">
      <span className="text-[hsl(var(--muted-foreground))]">{before}</span>
      <span className="mx-1 text-[hsl(var(--muted-foreground))]">→</span>
      <span className="font-semibold text-[hsl(var(--foreground))]">{after}</span>
      <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-0.5">{unit}</span>
    </span>
  )
}

function TypeBadge({ inbound }: { inbound: boolean }) {
  return inbound ? (
    <Badge variant="success" className="text-[10px] px-1.5 py-0 shrink-0">
      <TrendingUp className="h-3 w-3 mr-0.5" /> IN
    </Badge>
  ) : (
    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
      <TrendingDown className="h-3 w-3 mr-0.5" /> OUT
    </Badge>
  )
}

function ItemName({ movement: m, compact }: { movement: InventoryMovementRow; compact?: boolean }) {
  const showCode =
    m.item_model_code &&
    normalizeProductText(m.item_model_code) !== normalizeProductText(m.item_description)

  return (
    <div className="min-w-0">
      <p className={`${compact ? "text-xs" : "text-sm"} font-medium leading-snug break-words`}>
        {m.item_description}
      </p>
      {showCode && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono mt-0.5">{m.item_model_code}</p>
      )}
    </div>
  )
}

function normalizeProductText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="text-xs break-words">{value}</p>
    </div>
  )
}

export function InventoryMovementRowCard({ movement: m }: { movement: InventoryMovementRow }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b last:border-b-0 bg-[hsl(var(--background))]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2.5 hover:bg-[hsl(var(--muted))]/25 transition-colors"
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-[hsl(var(--muted-foreground))] shrink-0">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge inbound={m.is_inbound} />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums">
                {formatMovementDate(m.created_at)}
              </span>
              {m.order_number && (
                <span className="text-[10px] font-semibold text-[#1faca6]">{m.order_number}</span>
              )}
            </div>
            <ItemName movement={m} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span
                className={`font-bold tabular-nums ${
                  m.is_inbound ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {m.is_inbound ? "+" : "−"}
                {m.abs_quantity} {m.unit}
              </span>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Main WH:{" "}
                <BalanceChip before={m.balance_before} after={m.balance_after} unit={m.unit} />
              </span>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] line-clamp-1">
              {m.source} → {m.destination}
            </p>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-0 pl-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-dashed bg-[hsl(var(--muted))]/10">
          <DetailBlock label="From" value={m.source} />
          <DetailBlock label="To" value={m.destination} />
          <DetailBlock label="Client" value={m.client_name} />
          <DetailBlock label="Order" value={m.order_number} />
          <DetailBlock label="Reference" value={`${getReferenceTypeLabel(m.reference_type)} · ${m.reference_number}`} />
          <DetailBlock label="Recorded by" value={m.created_by} />
          <DetailBlock
            label="Main warehouse stock"
            value={
              m.balance_before != null && m.balance_after != null
                ? `${m.balance_before} ${m.unit} before → ${m.balance_after} ${m.unit} after (${m.is_inbound ? "+" : "−"}${m.abs_quantity})`
                : "—"
            }
          />
          {m.notes && (
            <div className="sm:col-span-2 lg:col-span-3 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Notes</p>
              <p className="text-xs break-words whitespace-pre-wrap">{m.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function InventoryMovementTableRow({
  movement: m,
  expanded,
  onToggle,
}: {
  movement: InventoryMovementRow
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-2 py-2 text-[11px] whitespace-nowrap tabular-nums">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 inline mr-1" /> : <ChevronRight className="h-3.5 w-3.5 inline mr-1" />}
          {formatMovementDate(m.created_at)}
        </td>
        <td className="px-2 py-2">
          <TypeBadge inbound={m.is_inbound} />
        </td>
        <td className="px-2 py-2 text-xs font-medium max-w-[200px]">
          <div title={m.item_description}>
            <ItemName movement={m} compact />
          </div>
        </td>
        <td className="px-2 py-2 text-center whitespace-nowrap">
          <span
            className={`text-xs font-bold tabular-nums ${
              m.is_inbound ? "text-green-600" : "text-red-600"
            }`}
          >
            {m.is_inbound ? "+" : "−"}
            {m.abs_quantity} {m.unit}
          </span>
        </td>
        <td className="px-2 py-2 text-center whitespace-nowrap">
          <BalanceChip before={m.balance_before} after={m.balance_after} unit={m.unit} />
        </td>
        <td className="px-2 py-2 text-[11px] text-[hsl(var(--muted-foreground))] max-w-[120px]">
          <span className="line-clamp-1" title={m.source}>{m.source}</span>
        </td>
        <td className="px-2 py-2 text-[11px] max-w-[120px]">
          <span className="line-clamp-1" title={m.destination}>{m.destination}</span>
        </td>
        <td className="px-2 py-2 text-[11px] font-semibold text-[#1faca6] whitespace-nowrap">
          {m.order_number || "—"}
        </td>
        <td className="px-2 py-2 text-[11px] max-w-[100px]">
          <span className="line-clamp-1" title={m.client_name}>{m.client_name || "—"}</span>
        </td>
        <td className="px-2 py-2 text-[11px] text-[hsl(var(--muted-foreground))] whitespace-nowrap">
          {m.created_by}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[hsl(var(--muted))]/15">
          <td colSpan={10} className="px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <DetailBlock label="Reference" value={`${getReferenceTypeLabel(m.reference_type)} (${m.reference_number})`} />
              <DetailBlock
                label="Stock change (main warehouse)"
                value={
                  m.balance_before != null && m.balance_after != null
                    ? `Was ${m.balance_before} ${m.unit} → now ${m.balance_after} ${m.unit}`
                    : "—"
                }
              />
              {m.notes && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <DetailBlock label="Full notes" value={m.notes} />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
