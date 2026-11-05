"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  buildBirdsEyeFromOverview,
  downloadDashboardBirdsEyeExcel,
  downloadDashboardBirdsEyePdf,
} from "@/lib/generate-dashboard-birds-eye-report"

const PERIODS = [
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "year", label: "This year" },
] as const

type PeriodId = (typeof PERIODS)[number]["id"]

/**
 * One-click bird's-eye download on Dashboard — sales / PSW / expenses big totals only.
 */
export function DashboardBirdsEyeCard() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<PeriodId>("month")
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null)
  const [error, setError] = useState("")

  async function download(format: "pdf" | "excel") {
    setBusy(format)
    setError("")
    try {
      const res = await fetch(`/api/finance/overview?period=${period}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load overview")
      const payload = buildBirdsEyeFromOverview(data, {
        exportedBy: user?.name || user?.email || "Admin",
      })
      if (format === "excel") await downloadDashboardBirdsEyeExcel(payload)
      else await downloadDashboardBirdsEyePdf(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))]/80 bg-[hsl(var(--card))] overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-2.5 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[hsl(var(--foreground))]">Financial summary</p>
          <p className="text-[9px] text-[hsl(var(--muted-foreground))]">
            Sales · Imports · Expenses — totals only
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center gap-0.5 rounded-md bg-[hsl(var(--muted))]/40 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!!busy}
                onClick={() => setPeriod(p.id)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                  period === p.id
                    ? "bg-[#1a9f9a] text-white"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void download("excel")}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 text-[10px] font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/40 disabled:opacity-60 cursor-pointer"
          >
            {busy === "excel" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3 w-3" />
            )}
            Excel
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void download("pdf")}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-[#1a9f9a] px-2 text-[10px] font-semibold text-white hover:bg-[#158a85] disabled:opacity-60 cursor-pointer"
          >
            {busy === "pdf" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            PDF
          </button>
        </div>
      </div>
      {error ? (
        <div className="px-2.5 pb-2">
          <p className="text-[10px] text-rose-600">{error}</p>
        </div>
      ) : null}
    </div>
  )
}
