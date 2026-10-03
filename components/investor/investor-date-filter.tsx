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
            : "border-[#1a9f9a]/25 bg-white text-[#1a9f9a] hover:bg-[#1a9f9a]/8",
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
            className="absolute right-0 top-11 z-20 w-[min(100vw-2rem,20rem)] rounded-2xl border border-[#1a9f9a]/20 bg-white p-3 shadow-xl shadow-[#1a9f9a]/10"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1a9f9a]">Date range</p>
              <p className="truncate text-[10px] text-neutral-500">{rangeLabel}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] text-neutral-500">From</span>
                <input
                  type="date"
                  value={fromDate}
                  min={INVESTOR_CRM2_FROM}
                  max={INVESTOR_CRM2_TO}
                  onChange={(e) => onFromChange(e.target.value)}
                  className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 text-xs focus:border-[#1a9f9a] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/20"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-neutral-500">To</span>
                <input
                  type="date"
                  value={toDate}
                  min={INVESTOR_CRM2_FROM}
                  max={INVESTOR_CRM2_TO}
                  onChange={(e) => onToChange(e.target.value)}
                  className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 text-xs focus:border-[#1a9f9a] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/20"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                onClear()
                setOpen(false)
              }}
              className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50 cursor-pointer"
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
