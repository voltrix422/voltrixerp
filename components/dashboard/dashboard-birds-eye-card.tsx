"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, Loader2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
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
    <div className="rounded-xl border bg-[hsl(var(--card))] shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#1faca6]" />
            Bird&apos;s-eye report
          </p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
            Sales (CRM + POS) · PSW &amp; charges · Petty cash · Ledger · Salaries — one sheet, totals only
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5 bg-[hsl(var(--muted))]/15">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!!busy}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                  period === p.id
                    ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={!!busy}
            onClick={() => void download("excel")}
          >
            {busy === "excel" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            {busy === "excel" ? "Building…" : "Excel"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs bg-[#1a9f9a] hover:bg-[#158a85] text-white"
            disabled={!!busy}
            onClick={() => void download("pdf")}
          >
            {busy === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {busy === "pdf" ? "Building…" : "PDF"}
          </Button>
        </div>
      </div>
      {error ? (
        <div className="px-4 pb-3">
          <p className="text-[11px] text-rose-600">{error}</p>
        </div>
      ) : null}
    </div>
  )
}
