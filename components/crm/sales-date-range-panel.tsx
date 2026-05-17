"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Calendar, ChevronDown, Download } from "lucide-react"

type Props = {
  dateFrom: string
  dateTo: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onApply: () => void
  onClear: () => void
  onExport?: () => void
  loading?: boolean
  exporting?: boolean
  showExport?: boolean
  defaultOpen?: boolean
  subtitle?: string
}

export function SalesDateRangePanel({
  dateFrom,
  dateTo,
  onFromChange,
  onToChange,
  onApply,
  onClear,
  onExport,
  loading,
  exporting,
  showExport,
  defaultOpen = false,
  subtitle,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const rangeLabel =
    dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `From ${dateFrom}` : dateTo ? `Until ${dateTo}` : "All time"

  return (
    <motion className="w-full max-w-full min-w-0 rounded-lg border overflow-hidden shadow-sm box-border">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full max-w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-[#1faca6]/15 to-transparent hover:from-[#1faca6]/20 transition-colors cursor-pointer text-left min-w-0"
      >
        <Image src="/logo.png" alt="Voltrix" width={28} height={28} className="shrink-0 rounded" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#1faca6] flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            Date range & export
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
            {open ? subtitle || "Filter stats and export PDF" : rangeLabel}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="p-3 pt-2 space-y-3 border-t bg-[hsl(var(--card))]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div className="min-w-0">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                From
              </label>
              <input
                type="date"
                className="mt-1 w-full h-9 rounded-md border border-[hsl(var(--border))] px-2.5 text-sm bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
                value={dateFrom}
                onChange={e => onFromChange(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                To
              </label>
              <input
                type="date"
                className="mt-1 w-full h-9 rounded-md border border-[hsl(var(--border))] px-2.5 text-sm bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
                value={dateTo}
                onChange={e => onToChange(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="h-8 text-xs min-w-[88px] flex-1 sm:flex-none bg-[#1faca6] hover:bg-[#1a9b96] text-white cursor-pointer"
              disabled={loading}
              onClick={onApply}
            >
              {loading ? "Loading…" : "Apply"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={onClear}>
              All time
            </Button>
            {showExport && onExport && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 cursor-pointer border-[#1faca6]/40 text-[#1faca6]"
                disabled={exporting || loading}
                onClick={onExport}
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? "Exporting…" : "Export PDF"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
