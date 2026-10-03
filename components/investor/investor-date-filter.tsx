"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { CalendarRange, RotateCcw, X } from "lucide-react"
import { INVESTOR_CRM2_FROM, INVESTOR_CRM2_TO } from "@/lib/investor-fake-crm"
import { cn } from "@/lib/utils"

export function InvestorDateFilter({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  onClear,
  rangeLabel,
}: {
  fromDate: string
  toDate: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onClear: () => void
  rangeLabel: string
}) {
  const [open, setOpen] = useState(false)
  const isDefault = fromDate === INVESTOR_CRM2_FROM && toDate === INVESTOR_CRM2_TO

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Date filter"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all cursor-pointer",
          open || !isDefault
            ? "border-[#1a9f9a] bg-[#1a9f9a] text-white shadow-sm shadow-[#1a9f9a]/30"
            : "border-[#1a9f9a]/30 bg-[hsl(var(--card))] text-[#1a9f9a] hover:bg-[#1a9f9a]/10",
        )}
      >
        {open ? <X className="h-4 w-4" /> : <CalendarRange className="h-4 w-4" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-11 z-20 w-[min(100vw-2rem,20rem)] rounded-2xl border border-[#1a9f9a]/25 bg-[hsl(var(--card))] p-3 shadow-xl shadow-black/10 dark:shadow-black/40"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1a9f9a]">Date range</p>
              <p className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">{rangeLabel}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">From</span>
                <input
                  type="date"
                  value={fromDate}
                  min={INVESTOR_CRM2_FROM}
                  max={INVESTOR_CRM2_TO}
                  onChange={(e) => onFromChange(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 text-xs text-[hsl(var(--foreground))] focus:border-[#1a9f9a] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/20 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">To</span>
                <input
                  type="date"
                  value={toDate}
                  min={INVESTOR_CRM2_FROM}
                  max={INVESTOR_CRM2_TO}
                  onChange={(e) => onToChange(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 text-xs text-[hsl(var(--foreground))] focus:border-[#1a9f9a] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/20 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                onClear()
                setOpen(false)
              }}
              className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border))] text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/40 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              All dates
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
