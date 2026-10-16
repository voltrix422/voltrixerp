"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/components/auth-provider"
import { isErpAdmin } from "@/lib/auth"
import { downloadCashRequestReportExcel } from "@/lib/generate-cash-request-report-excel"
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

export function FinanceApprovalPanel() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [view, setView] = useState<View>("today")
  const [rows, setRows] = useState<CashRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [employee, setEmployee] = useState("all")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
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
      if (view === "today" && r.neededOn !== today && r.createdAt.slice(0, 10) !== today) {
        const createdPkt = new Date(r.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
        if (r.neededOn !== today && createdPkt !== today) return false
      }
      if (employee !== "all") {
        const key = r.staffId || r.userId
        if (key !== employee) return false
      }
      if (!q) return true
      return (
        r.requesterName.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      )
    })
  }, [rows, view, today, employee, search])

  const pendingToday = rows.filter((r) => r.status === "pending" && (r.neededOn === today || new Date(r.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }) === today))
  const pendingTotal = rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0)
  const todayAmount = filtered.reduce((s, r) => s + r.amount, 0)

  async function review(row: CashRequest, action: "approve" | "reject") {
    if (!user || !isErpAdmin(user.role)) return
    if (action === "reject" && !(notes[row.id] || "").trim()) {
      toast({ title: "Add a note", message: "Explain why this cash request is rejected.", type: "error" })
      return
    }
    setBusyId(row.id)
    try {
      const updated = await reviewCashRequest({
        id: row.id,
        action,
        reviewedBy: user.name,
        reviewedByUserId: user.id,
        adminNotes: notes[row.id] || "",
        actorRole: user.role,
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

  async function download(list: CashRequest[], title: string, employeeName?: string) {
    if (!list.length) {
      toast({ title: "Nothing to download", type: "info" })
      return
    }
    await downloadCashRequestReportExcel(list, { title, employeeName })
  }

  const selectedEmployeeName = employees.find(([id]) => id === employee)?.[1]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border p-3">
          <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Today’s requests</p>
          <p className="text-lg font-semibold tabular-nums">{pendingToday.length}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Pending amount</p>
          <p className="text-lg font-semibold tabular-nums">PKR {pendingTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Shown total</p>
          <p className="text-lg font-semibold tabular-nums">PKR {todayAmount.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex rounded-md border p-0.5">
          {([
            ["today", "Today"],
            ["pending", "Pending"],
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee or purpose"
          className="h-9 flex-1 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs"
        />
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
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => download(filtered, view === "today" ? "Today" : "Cash requests", selectedEmployeeName)}>
          <Download className="h-3.5 w-3.5" /> Download shown
        </Button>
        {employee !== "all" && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() =>
              download(
                rows.filter((r) => (r.staffId || r.userId) === employee),
                `${selectedEmployeeName} cash requests`,
                selectedEmployeeName,
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> This employee report
          </Button>
        )}
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
            const open = openId === r.id
            return (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <button type="button" className="w-full text-left cursor-pointer" onClick={() => setOpenId(open ? null : r.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{r.staffName || r.requesterName}</p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        Needed {r.neededOn} · {r.category} · {paymentMethodLabel(r.paymentMethod)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {r.currency} {r.amount.toLocaleString()}
                      </p>
                      <p className={`text-[11px] font-medium ${tone(r.status)}`}>{cashRequestStatusLabel(r.status)}</p>
                    </div>
                  </div>
                  <p className="text-xs mt-1">{r.purpose}</p>
                </button>
                {open && (
                  <div className="space-y-2 border-t pt-2">
                    {r.itemBreakdown.map((l) => (
                      <div key={l.id} className="flex justify-between text-xs">
                        <span>{l.description}</span>
                        <span className="tabular-nums">
                          {r.currency} {l.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {r.location ? <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Location: {r.location}</p> : null}
                    {r.paymentMethod === "bank" ? (
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {r.bankAccountTitle} · {r.bankName} · {r.bankAccountNumber}
                      </p>
                    ) : null}
                    {r.notes ? <p className="text-xs">{r.notes}</p> : null}
                    {r.attachmentUrl ? (
                      <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs underline">
                        {r.attachmentName || "Attachment"}
                      </a>
                    ) : null}
                    {r.status === "pending" && (
                      <>
                        <textarea
                          value={notes[r.id] || ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Admin notes (required when rejecting)"
                          className="w-full rounded-md border px-2.5 py-2 text-xs"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-[#1faca6] hover:bg-[#1faca6]/90"
                            disabled={busyId === r.id}
                            onClick={() => review(r, "approve")}
                          >
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
                      </>
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
