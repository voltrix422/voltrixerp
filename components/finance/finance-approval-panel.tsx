"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, Download, Loader2 } from "lucide-react"
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

function fmtDay(iso: string) {
  const day = iso.slice(0, 10)
  const [y, m, d] = day.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

const inputCls = "h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs"

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
      map.set(r.staffId || r.userId, r.staffName || r.requesterName)
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
        r.purpose.toLowerCase().includes(q)
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
      setOpenId(null)
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs border rounded-md px-3 py-2">
        <span>
          Pending <b className="tabular-nums">{pendingCount}</b>
        </span>
        <span className="text-[hsl(var(--muted-foreground))]">·</span>
        <span>
          Amount <b className="tabular-nums">PKR {pendingTotal.toLocaleString()}</b>
        </span>
        <span className="text-[hsl(var(--muted-foreground))]">·</span>
        <span>
          Shown <b className="tabular-nums">PKR {shownTotal.toLocaleString()}</b>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {([
          ["pending", "Pending"],
          ["today", "Today"],
          ["all", "All"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`h-8 px-2.5 text-xs rounded-md border cursor-pointer ${view === id ? "bg-[#1faca6] text-white border-[#1faca6]" : ""}`}
          >
            {label}
          </button>
        ))}
        <select value={employee} onChange={(e) => setEmployee(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="all">All employees</option>
          {employees.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={dateField}
          onChange={(e) => setDateField(e.target.value as "needed" | "requested")}
          className={inputCls}
        >
          <option value="needed">Needed date</option>
          <option value="requested">Requested date</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          className={`${inputCls} flex-1 min-w-[8rem]`}
        />
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={downloadPdf}>
          <Download className="h-3.5 w-3.5" /> PDF
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No cash requests in this view.</p>
      ) : (
        <div className="border rounded-md overflow-hidden">
          {filtered.map((r) => {
            const open = openId === r.id
            const name = r.staffName || r.requesterName
            return (
              <div key={r.id} className="border-b last:border-b-0">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-[hsl(var(--muted))]/30"
                  onClick={() => setOpenId(open ? null : r.id)}
                >
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${open ? "rotate-180" : ""}`} />
                  <span className="text-xs font-medium truncate flex-1 min-w-0">{name}</span>
                  <span className="hidden sm:inline text-[11px] text-[hsl(var(--muted-foreground))] truncate max-w-[10rem]">
                    {r.purpose}
                  </span>
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))] whitespace-nowrap">{fmtDay(r.neededOn)}</span>
                  <span className="text-xs font-medium tabular-nums whitespace-nowrap">
                    PKR {r.amount.toLocaleString()}
                  </span>
                  <span className={`text-[11px] font-medium w-16 text-right ${tone(r.status)}`}>
                    {cashRequestStatusLabel(r.status)}
                  </span>
                </button>

                {open && (
                  <div className="px-3 pb-3 pt-1 bg-[hsl(var(--muted))]/15 space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px]">
                      <p>
                        <span className="text-[hsl(var(--muted-foreground))]">Email </span>
                        {r.requesterEmail || "—"}
                      </p>
                      <p>
                        <span className="text-[hsl(var(--muted-foreground))]">Pay </span>
                        {paymentMethodLabel(r.paymentMethod)}
                      </p>
                      <p>
                        <span className="text-[hsl(var(--muted-foreground))]">Category </span>
                        {r.category}
                      </p>
                      <p>
                        <span className="text-[hsl(var(--muted-foreground))]">Requested </span>
                        {fmtDay(r.createdAt)}
                      </p>
                      {r.location ? (
                        <p>
                          <span className="text-[hsl(var(--muted-foreground))]">Location </span>
                          {r.location}
                        </p>
                      ) : null}
                      {r.department ? (
                        <p>
                          <span className="text-[hsl(var(--muted-foreground))]">Dept </span>
                          {r.department}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-xs">
                      <span className="text-[hsl(var(--muted-foreground))]">Purpose </span>
                      {r.purpose}
                    </p>
                    <table className="w-full text-[11px] border">
                      <tbody>
                        {r.itemBreakdown.map((l) => (
                          <tr key={l.id} className="border-t first:border-t-0">
                            <td className="px-2 py-1">{l.description}</td>
                            <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                              PKR {l.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {r.notes ? <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{r.notes}</p> : null}
                    <div className="flex flex-wrap gap-3 text-[11px]">
                      {r.attachmentUrl ? (
                        <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="underline">
                          Employee file
                        </a>
                      ) : null}
                      {r.adminAttachmentUrl ? (
                        <a href={r.adminAttachmentUrl} target="_blank" rel="noreferrer" className="underline">
                          Admin file
                        </a>
                      ) : null}
                      {r.reviewedBy ? (
                        <span className="text-[hsl(var(--muted-foreground))]">
                          Reviewed by {r.reviewedBy}
                          {r.adminNotes ? ` · ${r.adminNotes}` : ""}
                        </span>
                      ) : null}
                    </div>

                    {r.status === "pending" && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                        <input
                          value={notes[r.id] || ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Admin note (required to reject)"
                          className={`${inputCls} flex-1`}
                        />
                        <input
                          type="file"
                          className="text-[11px] max-w-[11rem]"
                          onChange={(e) => setFiles((prev) => ({ ...prev, [r.id]: e.target.files?.[0] || null }))}
                        />
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-[#1faca6] hover:bg-[#1faca6]/90"
                            disabled={busyId === r.id}
                            onClick={() => review(r, "approve")}
                          >
                            {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busyId === r.id} onClick={() => review(r, "reject")}>
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
