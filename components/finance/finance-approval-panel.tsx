"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/components/auth-provider"
import { isErpAdmin } from "@/lib/auth"
import { uploadFile } from "@/lib/upload"
import { downloadCashRequestReportPdf } from "@/lib/generate-cash-request-report-pdf"
import {
  cashRequestStatusLabel,
  fetchCashRequests,
  karachiToday,
  paymentMethodLabel,
  reviewCashRequest,
  type CashRequest,
} from "@/lib/finance-cash-requests"

type View = "today" | "pending" | "all"

function tone(status: string) {
  if (status === "approved") return "text-emerald-600"
  if (status === "rejected") return "text-red-600"
  return "text-amber-600"
}

function inRange(day: string, from: string, to: string) {
  if (!day) return false
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-xs py-1 border-b border-[hsl(var(--border))] last:border-0">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="whitespace-pre-wrap break-words">{value}</span>
    </div>
  )
}

export function FinanceApprovalPanel() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [view, setView] = useState<View>("pending")
  const [rows, setRows] = useState<CashRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [employee, setEmployee] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [dateField, setDateField] = useState<"needed" | "requested">("needed")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [openId, setOpenId] = useState<string | null>(null)

  const today = karachiToday()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchCashRequests()
      setRows(list)
    } catch {
      toast({ title: "Could not load cash requests", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const employees = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      const key = r.staffId || r.userId
      map.set(key, r.staffName || r.requesterName)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (view === "pending" && r.status !== "pending") return false
      if (view === "today") {
        const createdPkt = new Date(r.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
        if (r.neededOn !== today && createdPkt !== today) return false
      }
      if (employee !== "all" && (r.staffId || r.userId) !== employee) return false
      if (dateFrom || dateTo) {
        const day =
          dateField === "requested"
            ? new Date(r.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
            : r.neededOn
        if (!inRange(day, dateFrom, dateTo)) return false
      }
      if (!q) return true
      return (
        r.requesterName.toLowerCase().includes(q) ||
        (r.staffName || "").toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      )
    })
  }, [rows, view, today, employee, search, dateFrom, dateTo, dateField])

  const pendingCount = rows.filter((r) => r.status === "pending").length
  const pendingTotal = rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0)
  const shownTotal = filtered.reduce((s, r) => s + r.amount, 0)
  const selectedEmployeeName = employees.find(([id]) => id === employee)?.[1]

  async function review(row: CashRequest, action: "approve" | "reject") {
    if (!user || !isErpAdmin(user.role)) return
    if (action === "reject" && !(notes[row.id] || "").trim()) {
      toast({ title: "Add a note", message: "Explain why this cash request is rejected.", type: "error" })
      return
    }
    setBusyId(row.id)
    try {
      let adminAttachmentUrl = ""
      let adminAttachmentName = ""
      const file = files[row.id]
      if (file) {
        adminAttachmentUrl = await uploadFile(file, "cash-requests")
        adminAttachmentName = file.name
      }
      const updated = await reviewCashRequest({
        id: row.id,
        action,
        reviewedBy: user.name,
        reviewedByUserId: user.id,
        adminNotes: notes[row.id] || "",
        actorRole: user.role,
        adminAttachmentUrl,
        adminAttachmentName,
      })
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      toast({
        title: action === "approve" ? "Approved" : "Rejected",
        type: action === "approve" ? "success" : "info",
      })
    } catch (e) {
      toast({ title: "Update failed", message: e instanceof Error ? e.message : "Try again", type: "error" })
    } finally {
      setBusyId(null)
    }
  }

  async function downloadPdf() {
    if (!filtered.length) {
      toast({ title: "Nothing to download", type: "info" })
      return
    }
    try {
      await downloadCashRequestReportPdf(filtered, {
        title: selectedEmployeeName ? `Cash requests — ${selectedEmployeeName}` : "Cash requests",
        employeeName: selectedEmployeeName,
        dateFrom,
        dateTo,
      })
    } catch (e) {
      toast({ title: "PDF failed", message: e instanceof Error ? e.message : "Try again", type: "error" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border p-3">
          <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Pending requests</p>
          <p className="text-lg font-semibold tabular-nums">{pendingCount}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Pending amount</p>
          <p className="text-lg font-semibold tabular-nums">PKR {pendingTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Shown total</p>
          <p className="text-lg font-semibold tabular-nums">PKR {shownTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-lg border p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex rounded-md border p-0.5">
            {([
              ["pending", "Pending"],
              ["today", "Today"],
              ["all", "All"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`px-3 py-1.5 text-xs rounded cursor-pointer ${view === id ? "bg-[#1faca6] text-white" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            className="h-9 rounded-md border bg-[hsl(var(--background))] px-2 text-xs sm:w-52"
          >
            <option value="all">All employees</option>
            {employees.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee or purpose"
            className="h-9 flex-1 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={dateField}
            onChange={(e) => setDateField(e.target.value as "needed" | "requested")}
            className="h-9 rounded-md border bg-[hsl(var(--background))] px-2 text-xs sm:w-40"
          >
            <option value="needed">Needed date</option>
            <option value="requested">Requested date</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-md border bg-[hsl(var(--background))] px-2 text-xs"
          />
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-md border bg-[hsl(var(--background))] px-2 text-xs"
          />
          {(dateFrom || dateTo || employee !== "all" || search) && (
            <button
              type="button"
              className="h-9 px-3 text-xs border rounded-md cursor-pointer"
              onClick={() => {
                setDateFrom("")
                setDateTo("")
                setEmployee("all")
                setSearch("")
              }}
            >
              Clear filters
            </button>
          )}
          <Button size="sm" variant="outline" className="h-9 text-xs sm:ml-auto" onClick={downloadPdf}>
            <Download className="h-3.5 w-3.5" /> Download PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No cash requests in this view.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const open = openId === r.id || r.status === "pending"
            return (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <button type="button" className="w-full text-left cursor-pointer" onClick={() => setOpenId(open && openId === r.id ? null : r.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{r.staffName || r.requesterName}</p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        Needed {r.neededOn} · Requested {new Date(r.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })} · {r.category} · {paymentMethodLabel(r.paymentMethod)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {r.currency} {r.amount.toLocaleString()}
                      </p>
                      <p className={`text-[11px] font-medium ${tone(r.status)}`}>{cashRequestStatusLabel(r.status)}</p>
                    </div>
                  </div>
                </button>
                {open && (
                  <div className="space-y-2 border-t pt-2">
                    <DetailRow label="Employee" value={r.staffName || r.requesterName} />
                    <DetailRow label="Email" value={r.requesterEmail} />
                    <DetailRow label="Department" value={r.department} />
                    <DetailRow label="Purpose" value={r.purpose} />
                    <DetailRow label="Category" value={r.category} />
                    <DetailRow label="Pay by" value={paymentMethodLabel(r.paymentMethod)} />
                    <DetailRow label="Needed on" value={r.neededOn} />
                    <DetailRow label="Location" value={r.location} />
                    {r.paymentMethod === "bank" ? (
                      <DetailRow
                        label="Bank"
                        value={[r.bankAccountTitle, r.bankName, r.bankAccountNumber].filter(Boolean).join(" · ")}
                      />
                    ) : null}
                    <div className="text-xs">
                      <p className="text-[hsl(var(--muted-foreground))] mb-1">Cash details</p>
                      <table className="w-full border text-xs">
                        <tbody>
                          {r.itemBreakdown.map((l) => (
                            <tr key={l.id} className="border-t first:border-t-0">
                              <td className="px-2 py-1">{l.description}</td>
                              <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                                {r.currency} {l.amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t font-medium">
                            <td className="px-2 py-1">Total</td>
                            <td className="px-2 py-1 text-right tabular-nums">
                              {r.currency} {r.amount.toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <DetailRow label="Notes" value={r.notes} />
                    {r.attachmentUrl ? (
                      <div className="text-xs">
                        <span className="text-[hsl(var(--muted-foreground))]">Employee file: </span>
                        <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="underline">
                          {r.attachmentName || "Open attachment"}
                        </a>
                      </div>
                    ) : null}
                    {r.adminNotes ? <DetailRow label="Admin notes" value={r.adminNotes} /> : null}
                    {r.adminAttachmentUrl ? (
                      <div className="text-xs">
                        <span className="text-[hsl(var(--muted-foreground))]">Admin file: </span>
                        <a href={r.adminAttachmentUrl} target="_blank" rel="noreferrer" className="underline">
                          {r.adminAttachmentName || "Open attachment"}
                        </a>
                      </div>
                    ) : null}
                    {r.reviewedBy ? (
                      <DetailRow
                        label="Reviewed"
                        value={`${r.reviewedBy}${r.reviewedAt ? ` · ${new Date(r.reviewedAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}` : ""}`}
                      />
                    ) : null}

                    {r.status === "pending" && (
                      <div className="space-y-2 pt-1">
                        <textarea
                          value={notes[r.id] || ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Admin notes (required when rejecting)"
                          className="w-full rounded-md border px-2.5 py-2 text-xs"
                          rows={2}
                        />
                        <label className="block text-[11px] space-y-1">
                          <span className="text-[hsl(var(--muted-foreground))]">Attachment for approve / reject</span>
                          <input
                            type="file"
                            className="block text-xs"
                            onChange={(e) => setFiles((prev) => ({ ...prev, [r.id]: e.target.files?.[0] || null }))}
                          />
                        </label>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-[#1faca6] hover:bg-[#1faca6]/90"
                            disabled={busyId === r.id}
                            onClick={() => review(r, "approve")}
                          >
                            {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={busyId === r.id}
                            onClick={() => review(r, "reject")}
                          >
                            Reject
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
      )}
    </div>
  )
}
