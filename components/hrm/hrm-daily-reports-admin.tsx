"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Loader2, XCircle, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  dailyReportStatusLabel,
  fetchDailyReports,
  formatReportDate,
  reviewDailyReport,
  todayDateString,
  type DailyReport,
} from "@/lib/hrm-daily-reports"

export function HrmDailyReportsAdmin({ reviewedBy }: { reviewedBy: string }) {
  const { toast } = useToast()
  const [reportDate, setReportDate] = useState(todayDateString())
  const [statusFilter, setStatusFilter] = useState<string>("submitted")
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchDailyReports({
        reportDate,
        ...(statusFilter ? { status: statusFilter } : {}),
      })
      setReports(rows)
    } catch {
      toast({ title: "Error", message: "Could not load daily reports.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [reportDate, statusFilter, toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleReview(r: DailyReport, status: "approved" | "rejected") {
    setActingId(r.id)
    try {
      await reviewDailyReport({
        id: r.id,
        status,
        adminNotes: notes[r.id] ?? "",
        reviewedBy,
      })
      toast({
        title: status === "approved" ? "Marked reviewed" : "Returned to staff",
        message: `${r.staffName}'s report for ${formatReportDate(r.reportDate)}.`,
        type: "success",
      })
      load()
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Review failed",
        type: "error",
      })
    } finally {
      setActingId(null)
    }
  }

  const submittedCount = reports.filter(r => r.status === "submitted").length
  const byStaff = reports.reduce<Record<string, DailyReport[]>>((acc, r) => {
    const key = r.staffName || r.staffEmail || r.staffId
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Daily reports</h2>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Review daily KPI logs from every login user (KPI Dashboard / My KPIs). Staff submit from{" "}
          <span className="font-medium text-[hsl(var(--foreground))]">Daily reporting</span>; you approve here.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Date
          </label>
          <input
            type="date"
            value={reportDate}
            onChange={e => setReportDate(e.target.value)}
            className="h-9 px-3 rounded-lg border text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border text-sm min-w-[140px]"
          >
            <option value="">All</option>
            <option value="submitted">Pending review</option>
            <option value="approved">Reviewed</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] pb-1">
          {formatReportDate(reportDate)} · {reports.length} report(s)
          {submittedCount > 0 && ` · ${submittedCount} pending`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No daily reports for this date.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byStaff).map(([name, staffReports]) => (
            <div key={name} className="space-y-2">
              <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{name}</p>
              {staffReports.map(r => {
                const open = expandedId === r.id
                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : r.id)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[hsl(var(--accent))]/40"
                    >
                      <div>
                        <p className="text-sm font-medium">{dailyReportStatusLabel(r.status)}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {r.logs.length} log(s)
                          {r.submittedAt
                            ? ` · sent ${new Date(r.submittedAt).toLocaleString()}`
                            : ""}
                        </p>
                      </div>
                      {open ? (
                        <ChevronUp className="w-4 h-4 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" />
                      )}
                    </button>

                    {open && (
                      <div className="px-4 pb-4 space-y-3 border-t border-[hsl(var(--border))] pt-3">
                        {r.employeeNotes && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            <span className="font-medium text-[hsl(var(--foreground))]">Day summary:</span>{" "}
                            {r.employeeNotes}
                          </p>
                        )}
                        {r.logs.map((log, i) => (
                          <div
                            key={log.id}
                            className="rounded-lg bg-[hsl(var(--muted))]/30 p-3 space-y-2 text-sm"
                          >
                            <p className="text-xs font-semibold text-[#1a9f9a]">
                              {log.timeFrom} – {log.timeTo}
                            </p>
                            <p className="text-[hsl(var(--foreground))] whitespace-pre-wrap">
                              {log.details || "—"}
                            </p>
                            {log.imageUrls.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {log.imageUrls.map((url, j) => (
                                  <a
                                    key={j}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-24 h-24 rounded-lg overflow-hidden border"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                        {r.status === "submitted" && (
                          <div className="space-y-2 pt-2">
                            <textarea
                              value={notes[r.id] ?? ""}
                              onChange={e =>
                                setNotes(n => ({ ...n, [r.id]: e.target.value }))
                              }
                              rows={2}
                              placeholder="Optional note to staff…"
                              className="w-full px-3 py-2 rounded-lg border text-xs"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={actingId === r.id}
                                onClick={() => handleReview(r, "approved")}
                                className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                {actingId === r.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                Mark reviewed
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actingId === r.id}
                                onClick={() => handleReview(r, "rejected")}
                                className="gap-1 text-red-600 border-red-200"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Send back
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
