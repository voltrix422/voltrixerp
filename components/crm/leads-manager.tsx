"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { uploadFiles } from "@/lib/upload"
import { parseLeadImportCsv } from "@/lib/csv-leads"
import { downloadLeadsExcel } from "@/lib/crm-excel-export"
import {
  fetchLeads,
  fetchLeadDetail,
  importLeadsJson,
  importVoltrixInstallersLeads,
  patchLeadStatus,
  deleteLead,
  deleteLeadsByImportBatch,
  logLeadContact,
  fetchDailyStats,
  type CrmLeadRow,
  type CrmLeadContactRow,
} from "@/lib/crm-leads"
import {
  Upload,
  Plus,
  Phone,
  MessageSquare,
  Calendar,
  Trash2,
  X,
  ImageIcon,
  ChevronDown,
  ChevronRight,
  User,
  Download,
} from "lucide-react"

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "responded", label: "Responded" },
  { value: "closed", label: "Closed" },
]

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const SAMPLE_CSV = `name,company,email,phone,notes
Jane Doe,Acme Industries,jane@example.com,+923001234567,Interested in UPS
John Smith,,john@smith.com,,Follow up next week
`

function LeadTableRow({
  lead,
  onOpenDetail,
  onStatusChange,
  onLog,
  onDelete,
}: {
  lead: CrmLeadRow
  onOpenDetail: (id: string) => void
  onStatusChange: (lead: CrmLeadRow, status: string) => void
  onLog: (lead: CrmLeadRow) => void
  onDelete: (id: string) => void
}) {
  return (
    <tr
      className="hover:bg-[hsl(var(--muted))]/30 cursor-pointer"
      onClick={() => onOpenDetail(lead.id)}
    >
      <td className="px-3 py-2 text-xs font-medium">{lead.name}</td>
      <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{lead.company || "—"}</td>
      <td className="px-3 py-2 text-xs">
        {lead.phone && (
          <span className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
            <Phone className="h-3 w-3 shrink-0" />
            {lead.phone}
          </span>
        )}
        {lead.email && <div className="text-[hsl(var(--muted-foreground))] truncate max-w-[140px]">{lead.email}</div>}
        {!lead.phone && !lead.email && "—"}
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <select
          value={lead.status}
          onChange={(e) => onStatusChange(lead, e.target.value)}
          className="h-7 rounded border bg-[hsl(var(--background))] text-[11px] px-1.5 max-w-[120px]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-xs text-center tabular-nums">{lead.contactCount}</td>
      <td className="px-3 py-2 text-[11px] text-[hsl(var(--muted-foreground))]">
        {lead.lastContactedAt
          ? new Date(lead.lastContactedAt).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—"}
      </td>
      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-[10px] px-2"
            onClick={() => onLog(lead)}
          >
            Log outreach
          </Button>
          <button
            type="button"
            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded cursor-pointer"
            title="Delete lead"
            onClick={() => onDelete(lead.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export function LeadsManager({
  currentUser,
  currentUserId,
  userRole,
}: {
  currentUser: string
  currentUserId?: string | null
  userRole?: string
}) {
  const { toast } = useToast()
  const [leads, setLeads] = useState<CrmLeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statsDate, setStatsDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [stats, setStats] = useState<{ total: number; byMember: { name: string; userId: string | null; count: number }[] }>({
    total: 0,
    byMember: [],
  })
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<(CrmLeadRow & { contacts: CrmLeadContactRow[] }) | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [logForLead, setLogForLead] = useState<CrmLeadRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteImportBatch, setDeleteImportBatch] = useState<{
    importBatchId: string
    importUploaderName: string
    count: number
  } | null>(null)
  const [importing, setImporting] = useState(false)
  const [repairingPhonesBatchId, setRepairingPhonesBatchId] = useState<string | null>(null)
  const [loadingInstallersCsv, setLoadingInstallersCsv] = useState(false)
  const [showAddLead, setShowAddLead] = useState(false)
  const [showCsvImportModal, setShowCsvImportModal] = useState(false)
  const [openBatchIds, setOpenBatchIds] = useState<Set<string>>(() => new Set())
  const csvInputRef = useRef<HTMLInputElement>(null)
  const pendingCsvImportRef = useRef<{ importBatchId: string; importUploaderName: string } | null>(null)

  const refresh = useCallback(async () => {
    const list = await fetchLeads()
    setLeads(list)
  }, [])

  const refreshStats = useCallback(async () => {
    const s = await fetchDailyStats(statsDate)
    setStats({ total: s.total, byMember: s.byMember })
  }, [statsDate])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    fetchLeadDetail(detailId)
      .then((r) => {
        if (r?.lead) setDetail(r.lead as CrmLeadRow & { contacts: CrmLeadContactRow[] })
        else setDetail(null)
      })
      .finally(() => setDetailLoading(false))
  }, [detailId])

  const filteredAll = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return leads
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q)
    )
  }, [leads, search])

  const importBatchGroups = useMemo(() => {
    const map = new Map<string, CrmLeadRow[]>()
    for (const l of filteredAll) {
      if (!l.importBatchId) continue
      const arr = map.get(l.importBatchId) ?? []
      arr.push(l)
      map.set(l.importBatchId, arr)
    }
    const groups = [...map.entries()].map(([importBatchId, list]) => {
      const sorted = [...list].sort(
        (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
      )
      return {
        importBatchId,
        importUploaderName: sorted[0]?.importUploaderName?.trim() || "Unknown",
        importedAt: sorted[0]?.importedAt ?? "",
        leads: sorted,
      }
    })
    return groups.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())
  }, [filteredAll])

  const tableLeads = useMemo(() => filteredAll.filter((l) => !l.importBatchId), [filteredAll])

  function toggleBatch(id: string) {
    setOpenBatchIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const myTodayCount = useMemo(() => {
    const byId = currentUserId
      ? stats.byMember.find((m) => m.userId === currentUserId)
      : undefined
    if (byId) return byId.count
    return stats.byMember.find((m) => m.name === currentUser)?.count ?? 0
  }, [stats, currentUserId, currentUser])

  const requestDeleteLead = useCallback((id: string) => {
    setDeleteImportBatch(null)
    setDeleteId(id)
  }, [])

  async function onCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const meta = pendingCsvImportRef.current
    if (!meta?.importBatchId || !meta.importUploaderName?.trim()) {
      toast({
        type: "error",
        title: "Missing importer",
        message: "Use Import CSV and enter who is importing before choosing a file.",
      })
      return
    }
    setImporting(true)
    try {
      const text = await file.text()
      const rows = parseLeadImportCsv(text)
      if (rows.length === 0) {
        toast({
          type: "error",
          title: "No rows imported",
          message: "Add a header row with at least a name column, then data rows.",
        })
        return
      }
      const { created } = await importLeadsJson({
        leads: rows,
        createdBy: currentUser,
        createdById: currentUserId ?? null,
        source: "csv",
        importBatchId: meta.importBatchId,
        importUploaderName: meta.importUploaderName.trim(),
      })
      toast({ type: "success", title: "Import complete", message: `${created} lead(s) added.` })
      setOpenBatchIds((prev) => new Set(prev).add(meta.importBatchId))
      pendingCsvImportRef.current = null
      await refresh()
      await refreshStats()
    } catch (err) {
      toast({
        type: "error",
        title: "Import failed",
        message: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setImporting(false)
    }
  }

  function beginCsvImportAfterName(uploaderName: string) {
    const importBatchId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    pendingCsvImportRef.current = {
      importBatchId,
      importUploaderName: uploaderName.trim(),
    }
    setShowCsvImportModal(false)
    queueMicrotask(() => csvInputRef.current?.click())
  }

  async function loadHardcodedInstallersCsv() {
    setLoadingInstallersCsv(true)
    try {
      const result = await importVoltrixInstallersLeads({
        createdBy: currentUser,
        createdById: currentUserId ?? null,
        repairAll: true,
      })
      if (result.mode === "import") {
        toast({
          type: "success",
          title: "Installers imported",
          message: `${result.created ?? 0} leads from Voltrix installers May 2026 CSV.`,
        })
        if (result.importBatchId) {
          setOpenBatchIds((prev) => new Set(prev).add(result.importBatchId!))
        }
      } else {
        const batch = result.batchRepair?.updated ?? 0
        const all = result.allRepair?.updated ?? 0
        toast({
          type: "success",
          title: "Installers CSV applied",
          message: `Phones updated: ${batch} in official batch, ${all} across all leads.`,
        })
      }
      await refresh()
      await refreshStats()
    } catch (err) {
      toast({
        type: "error",
        title: "Installers CSV failed",
        message: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setLoadingInstallersCsv(false)
    }
  }

  async function repairBatchPhones(importBatchId: string) {
    setRepairingPhonesBatchId(importBatchId)
    try {
      const res = await fetch("/api/crm/leads/repair-phones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importBatchId, repairAll: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Repair failed")
      }
      const updated = (data as { updated?: number }).updated ?? 0
      toast({
        type: "success",
        title: "Phones updated",
        message: `${updated} lead(s) now have phone numbers.`,
      })
      await refresh()
    } catch (err) {
      toast({
        type: "error",
        title: "Could not fix phones",
        message: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setRepairingPhonesBatchId(null)
    }
  }

  async function onStatusChange(lead: CrmLeadRow, status: string) {
    try {
      await patchLeadStatus(lead.id, status)
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)))
      if (detail?.id === lead.id) setDetail((d) => (d ? { ...d, status } : d))
    } catch {
      toast({ type: "error", title: "Could not update status" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">
              Outreach stats (UTC day)
            </p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <input
                type="date"
                value={statsDate}
                onChange={(e) => setStatsDate(e.target.value)}
                className="h-8 rounded border bg-[hsl(var(--background))] px-2 text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Your contacts</p>
              <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{myTodayCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Team total</p>
              <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{stats.total}</p>
            </div>
          </div>
        </div>
        {userRole === "superadmin" && stats.byMember.length > 0 && (
          <div className="pt-2 border-t border-[hsl(var(--border))]">
            <p className="text-xs font-semibold mb-2">By team member</p>
            <div className="flex flex-wrap gap-2">
              {stats.byMember.map((m) => (
                <span
                  key={`${m.name}-${m.userId ?? "x"}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--background))] border px-2.5 py-1 text-[11px]"
                >
                  <User className="h-3 w-3 opacity-60" />
                  {m.name}: <strong>{m.count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xl">
          Import leads from CSV — <strong>simple</strong> columns (name, company, email, phone, notes),{" "}
          <strong>Meta / Facebook Lead Ads</strong> export (FULL_NAME, PHONE, COMPANY_NAME, City, Address), or a{" "}
          <strong>Google Contacts</strong>–style file. Company name becomes the lead title; city shows as{" "}
          <strong>Labels: …</strong> in notes. Export all leads as Excel anytime. Log outreach with screenshots and the
          lead&apos;s response.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onCsvFile}
          />
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs"
            disabled={loadingInstallersCsv || importing}
            onClick={() => loadHardcodedInstallersCsv()}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            {loadingInstallersCsv ? "Loading…" : "Load installers CSV"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={importing}
            onClick={() => setShowCsvImportModal(true)}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            {importing ? "Importing…" : "Import other CSV"}
          </Button>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`}
            download="leads-sample.csv"
            className="text-xs text-[hsl(var(--primary))] underline underline-offset-2"
          >
            Sample CSV
          </a>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={filteredAll.length === 0}
            onClick={() => {
              downloadLeadsExcel(filteredAll, { exportedBy: currentUser })
              toast({
                type: "success",
                title: "Download started",
                message: `${filteredAll.length} lead(s) exported for Excel.`,
              })
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export Excel
          </Button>
          <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setShowAddLead(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add lead
          </Button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="h-8 px-3 rounded border bg-[hsl(var(--background))] text-xs w-40 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
        </div>
      ) : filteredAll.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <MessageSquare className="h-10 w-10 opacity-30 mb-2" />
          {leads.length === 0 ? "No leads yet. Import a CSV or add a lead manually." : "No leads match your search."}
        </div>
      ) : (
        <div className="space-y-6">
          {importBatchGroups.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                CSV imports (by person and date)
              </p>
              <div className="space-y-2">
                {importBatchGroups.map((group) => {
                  const open = openBatchIds.has(group.importBatchId)
                  const when = new Date(group.importedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                  return (
                    <div key={group.importBatchId} className="rounded-lg border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--card))]/30">
                      <div className="flex items-stretch border-b border-transparent">
                        <button
                          type="button"
                          onClick={() => toggleBatch(group.importBatchId)}
                          className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer"
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          )}
                          <span className="font-semibold text-sm text-[hsl(var(--foreground))] truncate">
                            {group.importUploaderName}
                          </span>
                          <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{when}</span>
                          <span className="ml-auto shrink-0 text-[11px] rounded-full bg-[hsl(var(--muted))]/50 px-2 py-0.5 tabular-nums">
                            {group.leads.length} lead{group.leads.length === 1 ? "" : "s"}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 px-3 flex items-center justify-center text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]/40 border-l border-[hsl(var(--border))] cursor-pointer text-[11px] font-medium disabled:opacity-50"
                          title="Fill missing phone numbers from the installers CSV on the server"
                          disabled={repairingPhonesBatchId === group.importBatchId}
                          onClick={(e) => {
                            e.stopPropagation()
                            repairBatchPhones(group.importBatchId)
                          }}
                        >
                          {repairingPhonesBatchId === group.importBatchId ? "Fixing…" : "Fix phones"}
                        </button>
                        <button
                          type="button"
                          className="shrink-0 px-3 flex items-center justify-center text-red-500 hover:bg-red-500/10 border-l border-[hsl(var(--border))] cursor-pointer"
                          title="Delete this import and all leads in it"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteId(null)
                            setDeleteImportBatch({
                              importBatchId: group.importBatchId,
                              importUploaderName: group.importUploaderName,
                              count: group.leads.length,
                            })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {open && (
                        <div className="border-t border-[hsl(var(--border))] overflow-x-auto">
                          <table className="w-full min-w-[800px]">
                            <thead>
                              <tr className="border-b bg-[hsl(var(--muted))]/40">
                                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                                  Lead
                                </th>
                                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                                  Company
                                </th>
                                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                                  Phone
                                </th>
                                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                                  Status
                                </th>
                                <th className="h-9 px-3 text-center text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                                  Logs
                                </th>
                                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                                  Last outreach
                                </th>
                                <th className="h-9 px-3 text-center text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {group.leads.map((lead) => (
                                <LeadTableRow
                                  key={lead.id}
                                  lead={lead}
                                  onOpenDetail={setDetailId}
                                  onStatusChange={onStatusChange}
                                  onLog={setLogForLead}
                                  onDelete={requestDeleteLead}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(importBatchGroups.length === 0 ? filteredAll : tableLeads).length > 0 && (
            <div>
              {importBatchGroups.length > 0 && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
                  Other leads (manual or older imports)
                </p>
              )}
              <div className="rounded-lg border overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b bg-[hsl(var(--muted))]/40">
                      <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                        Lead
                      </th>
                      <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                        Company
                      </th>
                      <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                        Phone
                      </th>
                      <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                        Status
                      </th>
                      <th className="h-9 px-3 text-center text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                        Logs
                      </th>
                      <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                        Last outreach
                      </th>
                      <th className="h-9 px-3 text-center text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(importBatchGroups.length === 0 ? filteredAll : tableLeads).map((lead) => (
                      <LeadTableRow
                        key={lead.id}
                        lead={lead}
                        onOpenDetail={setDetailId}
                        onStatusChange={onStatusChange}
                        onLog={setLogForLead}
                        onDelete={requestDeleteLead}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showCsvImportModal && (
        <CsvImportModal
          onClose={() => setShowCsvImportModal(false)}
          onContinue={(name) => {
            if (!name.trim()) return
            beginCsvImportAfterName(name)
          }}
        />
      )}

      {showAddLead && (
        <AddLeadModal
          currentUser={currentUser}
          currentUserId={currentUserId}
          onClose={() => setShowAddLead(false)}
          onCreated={async () => {
            await refresh()
            setShowAddLead(false)
          }}
        />
      )}

      {logForLead && (
        <LogOutreachModal
          lead={logForLead}
          currentUser={currentUser}
          currentUserId={currentUserId}
          onClose={() => setLogForLead(null)}
          onSaved={async () => {
            await refresh()
            await refreshStats()
            if (detailId === logForLead.id) {
              const r = await fetchLeadDetail(logForLead.id)
              if (r?.lead) setDetail(r.lead as CrmLeadRow & { contacts: CrmLeadContactRow[] })
            }
            setLogForLead(null)
          }}
        />
      )}

      {detailId && (
        <LeadDetailDrawer
          loading={detailLoading}
          lead={detail}
          onClose={() => {
            setDetailId(null)
            setDetail(null)
          }}
          onLog={() => {
            if (detail) setLogForLead(detail)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete lead"
        message="Remove this lead and all outreach logs? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (!deleteId) return
          try {
            await deleteLead(deleteId)
            setLeads((prev) => prev.filter((l) => l.id !== deleteId))
            if (detailId === deleteId) setDetailId(null)
            toast({ type: "success", title: "Lead deleted" })
            await refreshStats()
          } catch {
            toast({ type: "error", title: "Delete failed" })
          }
          setDeleteId(null)
        }}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        isOpen={!!deleteImportBatch}
        title="Delete whole import"
        message={
          deleteImportBatch
            ? `Remove all ${deleteImportBatch.count} lead(s) from the import by ${deleteImportBatch.importUploaderName}, including every outreach log for those leads? This cannot be undone.`
            : ""
        }
        confirmText="Delete import"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (!deleteImportBatch) return
          const { importBatchId } = deleteImportBatch
          try {
            const { deleted } = await deleteLeadsByImportBatch(importBatchId)
            setLeads((prev) => prev.filter((l) => l.importBatchId !== importBatchId))
            setOpenBatchIds((prev) => {
              const next = new Set(prev)
              next.delete(importBatchId)
              return next
            })
            if (detailId && leads.some((l) => l.id === detailId && l.importBatchId === importBatchId)) {
              setDetailId(null)
            }
            toast({
              type: "success",
              title: "Import removed",
              message: `${deleted} lead(s) deleted.`,
            })
            await refreshStats()
          } catch {
            toast({ type: "error", title: "Could not delete import" })
          }
          setDeleteImportBatch(null)
        }}
        onCancel={() => setDeleteImportBatch(null)}
      />
    </div>
  )
}

function CsvImportModal({
  onClose,
  onContinue,
}: {
  onClose: () => void
  onContinue: (uploaderName: string) => void
}) {
  const [name, setName] = useState("")

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[hsl(var(--background))] rounded-lg border shadow-lg max-w-md w-full p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Import CSV</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Who is importing these leads? This name and the import date are shown on the import record so your team can
          see who uploaded each file.
        </p>
        <div>
          <label className="text-xs font-medium">Importer name *</label>
          <input
            className="mt-1 w-full h-9 rounded border px-2 text-sm"
            placeholder="e.g. Ali Khan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            disabled={!name.trim()}
            onClick={() => onContinue(name.trim())}
          >
            Choose CSV file
          </Button>
        </div>
      </div>
    </div>
  )
}

function AddLeadModal({
  currentUser,
  currentUserId,
  onClose,
  onCreated,
}: {
  currentUser: string
  currentUserId?: string | null
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company,
          email,
          phone,
          notes,
          createdBy: currentUser,
          createdById: currentUserId ?? null,
        }),
      })
      if (!res.ok) throw new Error("Failed")
      await onCreated()
    } catch {
      toast({ type: "error", title: "Could not save lead" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[hsl(var(--background))] rounded-lg border shadow-lg max-w-md w-full p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Add lead</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="block text-xs font-medium">Name *</label>
        <input
          className="w-full h-9 rounded border px-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="block text-xs font-medium">Company</label>
        <input
          className="w-full h-9 rounded border px-2 text-sm"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <label className="block text-xs font-medium">Email</label>
        <input
          className="w-full h-9 rounded border px-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="block text-xs font-medium">Phone</label>
        <input
          className="w-full h-9 rounded border px-2 text-sm"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <label className="block text-xs font-medium">Notes</label>
        <textarea className="w-full rounded border px-2 py-1.5 text-sm min-h-[72px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="cursor-pointer" disabled={saving || !name.trim()} onClick={submit}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function LogOutreachModal({
  lead,
  currentUser,
  currentUserId,
  onClose,
  onSaved,
}: {
  lead: CrmLeadRow
  currentUser: string
  currentUserId?: string | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { toast } = useToast()
  const [when, setWhen] = useState(() => toDatetimeLocalValue(new Date()))
  const [files, setFiles] = useState<File[]>([])
  const [response, setResponse] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      let screenshotUrls: string[] = []
      if (files.length > 0) {
        screenshotUrls = await uploadFiles(files, "crm-leads")
      }
      await logLeadContact({
        leadId: lead.id,
        contactedBy: currentUser,
        contactedById: currentUserId ?? null,
        contactedAt: new Date(when).toISOString(),
        screenshotUrls,
        leadResponse: response,
        notes,
      })
      toast({ type: "success", title: "Outreach logged" })
      await onSaved()
    } catch (e) {
      toast({
        type: "error",
        title: "Could not save",
        message: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[hsl(var(--background))] rounded-lg border shadow-lg max-w-lg w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3 className="text-sm font-semibold">Log outreach</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] capitalize mt-0.5">{lead.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium">When</label>
          <input
            type="datetime-local"
            className="mt-1 w-full h-9 rounded border px-2 text-sm"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" />
            Screenshots (chat or call)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            className="mt-1 text-xs w-full"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length > 0 && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{files.length} file(s) selected</p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium">Lead response</label>
          <textarea
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm min-h-[80px]"
            placeholder="What did the lead say? Next steps, objections, etc."
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium">Internal notes (optional)</label>
          <textarea className="mt-1 w-full rounded border px-2 py-1.5 text-sm min-h-[56px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" className="cursor-pointer" disabled={saving} onClick={submit}>
            {saving ? "Saving…" : "Save log"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function LeadDetailDrawer({
  loading,
  lead,
  onClose,
  onLog,
}: {
  loading: boolean
  lead: (CrmLeadRow & { contacts: CrmLeadContactRow[] }) | null
  onClose: () => void
  onLog: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-[hsl(var(--background))] border-l shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-sm font-semibold">Lead detail</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading || !lead ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-lg font-semibold">{lead.name}</p>
                {lead.company && <p className="text-sm text-[hsl(var(--muted-foreground))]">{lead.company}</p>}
                <div className="mt-2 text-xs space-y-1">
                  {lead.phone && <p>Phone: {lead.phone}</p>}
                  {lead.email && <p>Email: {lead.email}</p>}
                  {lead.notes && (
                    <p className="text-[hsl(var(--muted-foreground))] pt-1 whitespace-pre-line">Notes: {lead.notes}</p>
                  )}
                  {lead.importUploaderName && (
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] pt-2 border-t border-[hsl(var(--border))] mt-2">
                      CSV import: <span className="font-medium text-[hsl(var(--foreground))]">{lead.importUploaderName}</span>
                      {" · "}
                      {new Date(lead.importedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  )}
                </div>
                <Button size="sm" className="mt-3 h-8 text-xs cursor-pointer" onClick={onLog}>
                  Log outreach
                </Button>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[hsl(var(--muted-foreground))] mb-2">Outreach history</p>
                {lead.contacts.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No logs yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {lead.contacts.map((c) => (
                      <li key={c.id} className="rounded border p-3 text-xs space-y-2">
                        <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                          <span>{c.contactedBy}</span>
                          <span>{new Date(c.contactedAt).toLocaleString()}</span>
                        </div>
                        {c.screenshotUrls.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {c.screenshotUrls.map((url) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                                <img src={url} alt="" className="h-16 w-16 object-cover rounded border" />
                              </a>
                            ))}
                          </div>
                        )}
                        {c.leadResponse && (
                          <p>
                            <span className="font-medium text-[hsl(var(--foreground))]">Response: </span>
                            {c.leadResponse}
                          </p>
                        )}
                        {c.notes && <p className="text-[hsl(var(--muted-foreground))]">Internal: {c.notes}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
