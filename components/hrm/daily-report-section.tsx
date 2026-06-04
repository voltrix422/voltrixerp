"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Plus,
  Trash2,
  Loader2,
  Send,
  Save,
  Clock,
  ImagePlus,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { uploadFiles } from "@/lib/upload"
import {
  dailyReportStatusLabel,
  fetchDailyReports,
  formatReportDate,
  newDailyLog,
  saveDailyReport,
  todayDateString,
  type DailyReport,
  type DailyReportLog,
} from "@/lib/hrm-daily-reports"

type Props = {
  staffId: string
  staffName: string
  actorName: string
}

function statusTone(status: string) {
  if (status === "submitted") return "text-blue-600"
  if (status === "approved") return "text-emerald-600"
  if (status === "rejected") return "text-red-600"
  return "text-amber-600"
}

export function DailyReportSection({ staffId, staffName, actorName }: Props) {
  const { toast } = useToast()
  const [reportDate, setReportDate] = useState(todayDateString())
  const [report, setReport] = useState<DailyReport | null>(null)
  const [logs, setLogs] = useState<DailyReportLog[]>([])
  const [employeeNotes, setEmployeeNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogId, setUploadingLogId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const editable =
    !report || report.status === "draft" || report.status === "rejected"

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchDailyReports({ staffId, reportDate })
      const current = rows[0] ?? null
      setReport(current)
      if (current) {
        setLogs(current.logs.length ? current.logs : [newDailyLog()])
        setEmployeeNotes(current.employeeNotes)
      } else {
        setLogs([newDailyLog()])
        setEmployeeNotes("")
      }
    } catch {
      toast({ title: "Error", message: "Could not load daily report.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [staffId, reportDate, toast])

  useEffect(() => {
    load()
  }, [load])

  function updateLog(id: string, patch: Partial<DailyReportLog>) {
    setLogs(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
  }

  function removeLog(id: string) {
    setLogs(prev => (prev.length <= 1 ? prev : prev.filter(l => l.id !== id)))
  }

  async function handleUpload(logId: string, files: FileList | null) {
    if (!files?.length || !editable) return
    setUploadingLogId(logId)
    try {
      const urls = await uploadFiles(Array.from(files), "daily-reports")
      const log = logs.find(l => l.id === logId)
      if (log) {
        updateLog(logId, { imageUrls: [...log.imageUrls, ...urls] })
      }
      toast({ title: "Uploaded", message: `${urls.length} image(s) added.`, type: "success" })
    } catch {
      toast({ title: "Error", message: "Image upload failed.", type: "error" })
    } finally {
      setUploadingLogId(null)
      const input = fileRefs.current[logId]
      if (input) input.value = ""
    }
  }

  async function persist(mode: "draft" | "submitted") {
    const validLogs = logs.filter(l => l.timeFrom && l.timeTo && l.details.trim())
    if (mode === "submitted" && validLogs.length === 0) {
      toast({
        title: "Add activity",
        message: "Add at least one log with time range and details before sending.",
        type: "error",
      })
      return
    }
    setSaving(true)
    try {
      const saved = await saveDailyReport({
        staffId,
        reportDate,
        logs: mode === "submitted" ? validLogs : logs,
        employeeNotes,
        status: mode,
        submittedBy: actorName,
      })
      setReport(saved)
      setLogs(saved.logs.length ? saved.logs : [newDailyLog()])
      toast({
        title: mode === "submitted" ? "Sent to admin" : "Draft saved",
        message:
          mode === "submitted"
            ? `Your report for ${formatReportDate(reportDate)} was submitted.`
            : "You can continue editing until you send the day.",
        type: "success",
      })
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Save failed",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Daily reporting</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Log your work for the day — add times, details, and photos, then send to admin when done.
          </p>
        </div>
        {report && (
          <p className={`text-xs font-semibold ${statusTone(report.status)}`}>
            {dailyReportStatusLabel(report.status)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Report date
          </label>
          <input
            type="date"
            value={reportDate}
            onChange={e => setReportDate(e.target.value)}
            className="h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] bg-[hsl(var(--card))]"
          />
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] pb-1">
          {formatReportDate(reportDate)} · {staffName}
        </p>
      </div>

      {report?.status === "submitted" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2 text-xs text-blue-800">
          Waiting for admin review. You cannot edit until admin responds or rejects.
        </div>
      )}
      {report?.status === "rejected" && report.adminNotes && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-800">
          <span className="font-semibold">Admin note:</span> {report.adminNotes}
        </div>
      )}
      {report?.status === "approved" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800">
          This day was reviewed by admin{report.reviewedBy ? ` (${report.reviewedBy})` : ""}.
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[hsl(var(--foreground))]">Activity logs</p>
          {editable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setLogs(p => [...p, newDailyLog()])}
            >
              <Plus className="w-3.5 h-3.5" /> Add log
            </Button>
          )}
        </div>

        {logs.map((log, idx) => (
          <div
            key={log.id}
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Log {idx + 1}
              </p>
              {editable && logs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLog(log.id)}
                  className="text-[hsl(var(--muted-foreground))] hover:text-red-600"
                  aria-label="Remove log"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> From
                </label>
                <input
                  type="time"
                  value={log.timeFrom}
                  disabled={!editable}
                  onChange={e => updateLog(log.id, { timeFrom: e.target.value })}
                  className="w-full h-9 px-2 rounded-lg border text-sm disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">To</label>
                <input
                  type="time"
                  value={log.timeTo}
                  disabled={!editable}
                  onChange={e => updateLog(log.id, { timeTo: e.target.value })}
                  className="w-full h-9 px-2 rounded-lg border text-sm disabled:opacity-60"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Details</label>
              <textarea
                value={log.details}
                disabled={!editable}
                onChange={e => updateLog(log.id, { details: e.target.value })}
                rows={3}
                placeholder="What did you do in this time block?"
                className="w-full px-3 py-2 rounded-lg border text-sm resize-y disabled:opacity-60"
              />
            </div>

            {log.imageUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {log.imageUrls.map((url, i) => (
                  <div key={`${url}-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {editable && (
                      <button
                        type="button"
                        onClick={() =>
                          updateLog(log.id, {
                            imageUrls: log.imageUrls.filter((_, j) => j !== i),
                          })
                        }
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {editable && (
              <div>
                <input
                  ref={el => { fileRefs.current[log.id] = el }}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => handleUpload(log.id, e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  disabled={uploadingLogId === log.id}
                  onClick={() => fileRefs.current[log.id]?.click()}
                >
                  {uploadingLogId === log.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-3.5 h-3.5" />
                  )}
                  Upload images
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          End-of-day notes (optional)
        </label>
        <textarea
          value={employeeNotes}
          disabled={!editable}
          onChange={e => setEmployeeNotes(e.target.value)}
          rows={2}
          placeholder="Summary for admin…"
          className="w-full px-3 py-2 rounded-lg border text-sm disabled:opacity-60"
        />
      </div>

      {editable && (
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => persist("draft")}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save draft
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => persist("submitted")}
            className="gap-1.5 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send day to admin
          </Button>
        </div>
      )}
    </div>
  )
}
