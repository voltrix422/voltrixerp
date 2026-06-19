"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { uploadFiles } from "@/lib/upload"
import { enrichLeadRowsWithPhonesFromCsv, parseLeadImportCsv } from "@/lib/csv-leads"
import {
  facebookLeadAdsImportSummary,
  isFacebookLeadAdsCsv,
  FACEBOOK_LEAD_ADS_HEADERS,
} from "@/lib/facebook-lead-ads-csv"
import { downloadLeadsExcel } from "@/lib/crm-excel-export"
import { isErpAdmin } from "@/lib/auth"
import {
  fetchLeads,
  fetchLeadDetail,
  fetchLeadContacts,
  importLeadsJson,
  importFacebookLeadAdsCsv,
  syncInstallersPhonesFromBrowser,
  syncPhonesFromCsvText,
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
  RefreshCw,
  Filter,
  SlidersHorizontal,
} from "lucide-react"

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "responded", label: "Responded" },
  { value: "closed", label: "Closed" },
] as const

type LeadStatusFilter = "all" | (typeof STATUS_OPTIONS)[number]["value"]

const LEAD_STATUS_FILTER_OPTIONS: { value: LeadStatusFilter; label: string; hint?: string }[] = [
  { value: "all", label: "All leads" },
  { value: "responded", label: "Qualified (responded)", hint: "Leads who replied" },
  { value: "contacted", label: "Contacted", hint: "Outreach logged, no reply yet" },
  { value: "new", label: "New / not contacted", hint: "No outreach logged" },
  { value: "closed", label: "Closed" },
]

const CONTACT_DATE_FILTER_OPTIONS: { value: ContactDateFilter; label: string }[] = [
  { value: "all", label: "Any outreach date" },
  { value: "today", label: "Contacted today" },
  { value: "never", label: "Never contacted" },
  { value: "range", label: "Contacted between dates" },
]

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function dayStartMs(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

function dayEndMs(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

function matchesContactDateFilter(
  lead: CrmLeadRow,
  contactFilter: ContactDateFilter,
  contactFrom: string,
  contactTo: string,
) {
  if (contactFilter === "all") return true
  if (contactFilter === "never") return !lead.lastContactedAt
  if (!lead.lastContactedAt) return false

  const contactedAt = new Date(lead.lastContactedAt).getTime()

  if (contactFilter === "today") {
    const today = todayIsoDate()
    return contactedAt >= dayStartMs(today) && contactedAt <= dayEndMs(today)
  }

  if (contactFilter === "range") {
    if (!contactFrom && !contactTo) return true
    if (contactFrom && contactedAt < dayStartMs(contactFrom)) return false
    if (contactTo && contactedAt > dayEndMs(contactTo)) return false
    return true
  }

  return true
}

function applyLeadFilters(
  leads: CrmLeadRow[],
  {
    search,
    statusFilter,
    contactFilter,
    contactFrom,
    contactTo,
  }: {
    search: string
    statusFilter: LeadStatusFilter
    contactFilter: ContactDateFilter
    contactFrom: string
    contactTo: string
  },
) {
  const q = search.toLowerCase().trim()

  return leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false
    if (!matchesContactDateFilter(l, contactFilter, contactFrom, contactTo)) return false
    if (!q) return true
    return (
      l.name.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q) ||
      (l.city ?? "").toLowerCase().includes(q) ||
      (l.address ?? "").toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.phone.toLowerCase().includes(q)
    )
  })
}

function isLeadFiltersActive(
  statusFilter: LeadStatusFilter,
  contactFilter: ContactDateFilter,
  contactFrom: string,
  contactTo: string,
) {
  if (statusFilter !== "all") return true
  if (contactFilter === "today" || contactFilter === "never") return true
  if (contactFilter === "range" && (contactFrom || contactTo)) return true
  return false
}

function LeadFiltersPanel({
  statusFilter,
  contactFilter,
  contactFrom,
  contactTo,
  open,
  totalCount,
  filteredCount,
  onToggleOpen,
  onStatusFilter,
  onContactFilter,
  onContactFrom,
  onContactTo,
  onClear,
}: {
  statusFilter: LeadStatusFilter
  contactFilter: ContactDateFilter
  contactFrom: string
  contactTo: string
  open: boolean
  totalCount: number
  filteredCount: number
  onToggleOpen: () => void
  onStatusFilter: (v: LeadStatusFilter) => void
  onContactFilter: (v: ContactDateFilter) => void
  onContactFrom: (v: string) => void
  onContactTo: (v: string) => void
  onClear: () => void
}) {
  const filtersActive = isLeadFiltersActive(statusFilter, contactFilter, contactFrom, contactTo)

  const statusLabel =
    LEAD_STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "All leads"
  const contactLabel =
    CONTACT_DATE_FILTER_OPTIONS.find((o) => o.value === contactFilter)?.label ?? "Any outreach date"

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 overflow-hidden">
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full flex items-center gap-2 px-3 py-2.5 sm:py-2 text-left hover:bg-[hsl(var(--muted))]/30 transition-colors min-h-[44px] sm:min-h-0"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
        <span className="text-xs font-semibold flex-1 min-w-0 truncate">Filter leads</span>
        {filtersActive && (
          <span className="shrink-0 text-[10px] rounded-full bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] px-2 py-0.5 font-medium">
            Active
          </span>
        )}
        <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))] tabular-nums">
          {filteredCount}/{totalCount}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
        )}
      </button>

      {!open && filtersActive && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-[hsl(var(--border))] pt-2">
          {statusFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))]/50 px-2 py-0.5 text-[10px]">
              <Filter className="h-3 w-3 opacity-60" />
              {statusLabel}
            </span>
          )}
          {contactFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))]/50 px-2 py-0.5 text-[10px]">
              <Calendar className="h-3 w-3 opacity-60" />
              {contactLabel}
              {contactFilter === "range" && (contactFrom || contactTo) && (
                <span className="text-[hsl(var(--muted-foreground))]">
                  ({contactFrom || "…"} → {contactTo || "…"})
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="border-t border-[hsl(var(--border))] p-3 space-y-3 bg-[hsl(var(--background))]/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Lead status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilter(e.target.value as LeadStatusFilter)}
                className="mt-1 w-full h-10 sm:h-9 rounded border bg-[hsl(var(--background))] px-2 text-sm sm:text-xs"
              >
                {LEAD_STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {LEAD_STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.hint && (
                <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                  {LEAD_STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.hint}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Outreach date
              </label>
              <select
                value={contactFilter}
                onChange={(e) => onContactFilter(e.target.value as ContactDateFilter)}
                className="mt-1 w-full h-10 sm:h-9 rounded border bg-[hsl(var(--background))] px-2 text-sm sm:text-xs"
              >
                {CONTACT_DATE_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {contactFilter === "range" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  From
                </label>
                <input
                  type="date"
                  value={contactFrom}
                  onChange={(e) => onContactFrom(e.target.value)}
                  className="mt-1 w-full h-10 sm:h-9 rounded border bg-[hsl(var(--background))] px-2 text-sm sm:text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  To
                </label>
                <input
                  type="date"
                  value={contactTo}
                  onChange={(e) => onContactTo(e.target.value)}
                  className="mt-1 w-full h-10 sm:h-9 rounded border bg-[hsl(var(--background))] px-2 text-sm sm:text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Showing <strong className="text-[hsl(var(--foreground))]">{filteredCount}</strong> of{" "}
              {totalCount} lead{totalCount === 1 ? "" : "s"}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={onClear}
                className="text-[11px] text-[hsl(var(--primary))] hover:underline cursor-pointer min-h-[36px] px-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type ContactDateFilter = "all" | "today" | "never" | "range"

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const SAMPLE_CSV = `name,company,email,phone,notes
Jane Doe,Acme Industries,jane@example.com,+923001234567,Interested in UPS
John Smith,,john@smith.com,,Follow up next week
`

const CRM_LEAD_DETAIL_KEY = "crm-lead-detail-id"

function toWhatsAppDigits(phone: string) {
  let digits = phone.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("0") && digits.length >= 10) digits = `92${digits.slice(1)}`
  else if (!digits.startsWith("92") && digits.length === 10) digits = `92${digits}`
  return digits
}

function whatsAppHref(phone: string, leadName?: string) {
  const digits = toWhatsAppDigits(phone)
  const greeting = leadName?.trim()
    ? `Hi ${leadName.trim()}, this is Voltrix Batteries. `
    : "Hi, this is Voltrix Batteries. "
  return `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`
}

function LeadPhoneLinks({
  phone,
  leadName,
  layout = "inline",
}: {
  phone: string
  leadName?: string
  layout?: "inline" | "card"
}) {
  const trimmed = phone.trim()
  if (!trimmed) return <>—</>

  const telHref = `tel:${trimmed.replace(/\s/g, "")}`
  const waHref = whatsAppHref(trimmed, leadName)

  if (layout === "card") {
    return (
      <div className="flex gap-2 w-full" onClick={(e) => e.stopPropagation()}>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 min-h-[44px] px-3 rounded-lg bg-[#25D366] text-white text-sm font-medium active:scale-[0.98] transition-transform"
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          WhatsApp
        </a>
        <a
          href={telHref}
          className="flex flex-1 items-center justify-center gap-2 min-h-[44px] px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm font-medium active:scale-[0.98] transition-transform"
        >
          <Phone className="h-4 w-4 shrink-0" />
          Call
        </a>
      </div>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-[#25D366] hover:underline"
        title="Message on WhatsApp"
      >
        <MessageSquare className="h-3 w-3 shrink-0" />
        {trimmed}
      </a>
      <a
        href={telHref}
        className="inline-flex p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50"
        title="Call"
      >
        <Phone className="h-3 w-3 shrink-0" />
      </a>
    </span>
  )
}

function LeadStatusSelect({
  lead,
  onStatusChange,
  className = "",
}: {
  lead: CrmLeadRow
  onStatusChange: (lead: CrmLeadRow, status: string) => void
  className?: string
}) {
  return (
    <select
      value={lead.status}
      onChange={(e) => onStatusChange(lead, e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`h-8 sm:h-7 rounded border bg-[hsl(var(--background))] text-[11px] px-1.5 ${className}`}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function LeadCard({
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
    <div
      className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 space-y-2.5 active:bg-[hsl(var(--muted))]/20"
      onClick={() => onOpenDetail(lead.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-snug">{lead.name}</p>
          {lead.company?.trim() && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">{lead.company}</p>
          )}
          {lead.city?.trim() && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">{lead.city}</p>
          )}
        </div>
        <LeadStatusSelect lead={lead} onStatusChange={onStatusChange} className="shrink-0 max-w-[110px]" />
      </div>

      {lead.phone?.trim() ? (
        <LeadPhoneLinks phone={lead.phone} leadName={lead.name} layout="card" />
      ) : (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No phone</p>
      )}

      <div className="flex items-center justify-between gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
        <span>{lead.contactCount} log{lead.contactCount === 1 ? "" : "s"}</span>
        <span className="text-right truncate">
          {lead.lastContactedAt
            ? new Date(lead.lastContactedAt).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "No outreach yet"}
        </span>
      </div>

      <div className="flex gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="secondary"
          className="flex-1 h-10 text-xs"
          onClick={() => onLog(lead)}
        >
          Log outreach
        </Button>
        <button
          type="button"
          className="shrink-0 flex items-center justify-center w-10 h-10 text-red-500 hover:bg-red-500/10 rounded-lg border border-[hsl(var(--border))] cursor-pointer"
          title="Delete lead"
          onClick={() => onDelete(lead.id)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function LeadsListView({
  leads,
  onOpenDetail,
  onStatusChange,
  onLog,
  onDelete,
}: {
  leads: CrmLeadRow[]
  onOpenDetail: (id: string) => void
  onStatusChange: (lead: CrmLeadRow, status: string) => void
  onLog: (lead: CrmLeadRow) => void
  onDelete: (id: string) => void
}) {
  return (
    <>
      <div className="md:hidden space-y-2 p-2">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onOpenDetail={onOpenDetail}
            onStatusChange={onStatusChange}
            onLog={onLog}
            onDelete={onDelete}
          />
        ))}
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b bg-[hsl(var(--muted))]/40">
              <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                Lead
              </th>
              <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                Company
              </th>
              <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                City
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
            {leads.map((lead) => (
              <LeadTableRow
                key={lead.id}
                lead={lead}
                onOpenDetail={onOpenDetail}
                onStatusChange={onStatusChange}
                onLog={onLog}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

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
      <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{lead.city || "—"}</td>
      <td className="px-3 py-2 text-xs tabular-nums" onClick={(e) => e.stopPropagation()}>
        <LeadPhoneLinks phone={lead.phone} leadName={lead.name} />
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <LeadStatusSelect lead={lead} onStatusChange={onStatusChange} className="max-w-[120px]" />
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
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>("all")
  const [contactFilter, setContactFilter] = useState<ContactDateFilter>("all")
  const [contactFrom, setContactFrom] = useState("")
  const [contactTo, setContactTo] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
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
  const [showFacebookImportModal, setShowFacebookImportModal] = useState(false)
  const [openBatchIds, setOpenBatchIds] = useState<Set<string>>(() => new Set())
  const csvInputRef = useRef<HTMLInputElement>(null)
  const facebookCsvInputRef = useRef<HTMLInputElement>(null)
  const pendingCsvImportRef = useRef<{ importBatchId: string; importUploaderName: string } | null>(null)
  const autoSyncPhonesDone = useRef(false)

  const refresh = useCallback(async () => {
    const list = await fetchLeads()
    setLeads(list)
  }, [])

  const reloadLeadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const [detailRes, contacts] = await Promise.all([fetchLeadDetail(id), fetchLeadContacts(id)])
      if (detailRes?.lead) {
        const lead = detailRes.lead as CrmLeadRow & { contacts: CrmLeadContactRow[] }
        setDetail({
          ...lead,
          contacts: contacts.length > 0 ? contacts : lead.contacts,
          contactCount: contacts.length > 0 ? contacts.length : lead.contactCount,
        })
      } else {
        setDetail(null)
      }
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const openLeadDetail = useCallback((id: string) => {
    setDetailId(id)
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(CRM_LEAD_DETAIL_KEY, id)
    }
  }, [])

  const closeLeadDetail = useCallback(() => {
    setDetailId(null)
    setDetail(null)
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(CRM_LEAD_DETAIL_KEY)
    }
  }, [])

  const refreshStats = useCallback(async () => {
    const s = await fetchDailyStats(statsDate)
    setStats({ total: s.total, byMember: s.byMember })
  }, [statsDate])

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      const saved = sessionStorage.getItem(CRM_LEAD_DETAIL_KEY)
      if (saved) setDetailId(saved)
    }
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  useEffect(() => {
    if (loading || autoSyncPhonesDone.current) return
    const missingPhones = leads.some((l) => !l.phone?.trim())
    if (!missingPhones) return
    autoSyncPhonesDone.current = true
    syncInstallersPhonesFromBrowser()
      .then(async (r) => {
        if (r.updated > 0) {
          toast({
            type: "success",
            title: "Phones synced",
            message: `Filled ${r.updated} phone number(s) from installers CSV.`,
          })
          await refresh()
        } else if ((r.lookupSize ?? 0) > 0 && r.notMatched > 0) {
          toast({
            type: "error",
            title: "Could not match phones",
            message: `${r.notMatched} lead(s) had no matching row in the CSV. Try re-importing the Facebook file.`,
          })
        }
      })
      .catch((err) => {
        autoSyncPhonesDone.current = false
        toast({
          type: "error",
          title: "Phone sync failed",
          message: err instanceof Error ? err.message : "Could not load installers CSV.",
        })
      })
  }, [loading, leads, refresh, toast])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      return
    }
    reloadLeadDetail(detailId)
  }, [detailId, reloadLeadDetail])

  const filteredAll = useMemo(
    () =>
      applyLeadFilters(leads, {
        search,
        statusFilter,
        contactFilter,
        contactFrom,
        contactTo,
      }),
    [leads, search, statusFilter, contactFilter, contactFrom, contactTo],
  )

  function clearLeadFilters() {
    setStatusFilter("all")
    setContactFilter("all")
    setContactFrom("")
    setContactTo("")
  }

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
      if (isFacebookLeadAdsCsv(text)) {
        const { created, importBatchId, withPhone } = await importFacebookLeadAdsCsv({
          csvText: text,
          createdBy: currentUser,
          createdById: currentUserId ?? null,
          importUploaderName: meta.importUploaderName.trim(),
          importBatchId: meta.importBatchId,
        })
        await syncPhonesFromCsvText({ csvText: text, importBatchId })
        toast({
          type: "success",
          title: "Facebook leads imported",
          message: `${created} lead(s) imported${withPhone != null ? `, ${withPhone} with phone` : ""}.`,
        })
        setOpenBatchIds((prev) => new Set(prev).add(importBatchId))
        pendingCsvImportRef.current = null
        await refresh()
        await refreshStats()
        return
      }
      const rows = enrichLeadRowsWithPhonesFromCsv(parseLeadImportCsv(text), text)
      if (rows.length === 0) {
        toast({
          type: "error",
          title: "No rows imported",
          message: "Use Facebook Lead Ads CSV or a file with name / phone columns.",
        })
        return
      }
      const { created, withPhone } = await importLeadsJson({
        leads: rows,
        csvText: text,
        createdBy: currentUser,
        createdById: currentUserId ?? null,
        source: "csv",
        importBatchId: meta.importBatchId,
        importUploaderName: meta.importUploaderName.trim(),
      })
      await syncPhonesFromCsvText({ csvText: text, importBatchId: meta.importBatchId })
      toast({
        type: "success",
        title: "Import complete",
        message: `${created} lead(s) added${withPhone != null ? `, ${withPhone} with phone` : ""}.`,
      })
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

  async function onFacebookCsvFile(e: React.ChangeEvent<HTMLInputElement>, uploaderName: string) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const summary = facebookLeadAdsImportSummary(text)
      if (!summary.valid) {
        toast({ type: "error", title: "Invalid file", message: summary.message })
        return
      }
      const importBatchId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `fb-${Date.now()}`
      const { created, importBatchId: batchId, withPhone } = await importFacebookLeadAdsCsv({
        csvText: text,
        createdBy: currentUser,
        createdById: currentUserId ?? null,
        importUploaderName: uploaderName.trim() || "Facebook Lead Ads",
        importBatchId,
      })
      await syncPhonesFromCsvText({ csvText: text, importBatchId: batchId })
      toast({
        type: "success",
        title: "Facebook leads imported",
        message: `${created} lead(s) added${withPhone != null ? `, ${withPhone} with phone` : ""}.`,
      })
      setOpenBatchIds((prev) => new Set(prev).add(batchId))
      setShowFacebookImportModal(false)
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

  async function loadHardcodedInstallersCsv(importBatchId?: string) {
    setLoadingInstallersCsv(true)
    try {
      const result = await syncInstallersPhonesFromBrowser(importBatchId)
      if (result.updated === 0 && (result.lookupSize ?? 0) === 0) {
        throw new Error("CSV has no PHONE column data. Re-upload the Facebook export.")
      }
      toast({
        type: "success",
        title: "Installers CSV synced",
        message: `Updated ${result.updated} of ${result.total} leads (${result.notMatched} not matched).`,
      })
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
      const result = await syncInstallersPhonesFromBrowser(importBatchId)
      toast({
        type: "success",
        title: "Phones updated",
        message: `${result.updated} lead(s) synced from installers CSV (${result.notMatched} not matched).`,
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
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-end gap-3 sm:gap-4">
          <div className="min-w-0 sm:flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">
              Outreach stats (UTC day)
            </p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <input
                type="date"
                value={statsDate}
                onChange={(e) => setStatsDate(e.target.value)}
                className="h-9 sm:h-8 flex-1 min-w-0 rounded border bg-[hsl(var(--background))] px-2 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-6 text-sm">
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
        {isErpAdmin(userRole) && stats.byMember.length > 0 && (
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

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="h-10 sm:h-8 flex-1 min-w-0 px-3 rounded border bg-[hsl(var(--background))] text-sm sm:text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <LeadFiltersPanel
          statusFilter={statusFilter}
          contactFilter={contactFilter}
          contactFrom={contactFrom}
          contactTo={contactTo}
          open={filtersOpen}
          totalCount={leads.length}
          filteredCount={filteredAll.length}
          onToggleOpen={() => setFiltersOpen((v) => !v)}
          onStatusFilter={setStatusFilter}
          onContactFilter={(v) => {
            setContactFilter(v)
            if (v === "today") {
              const today = todayIsoDate()
              setContactFrom(today)
              setContactTo(today)
            } else if (v !== "range") {
              setContactFrom("")
              setContactTo("")
            }
          }}
          onContactFrom={setContactFrom}
          onContactTo={setContactTo}
          onClear={clearLeadFilters}
        />

        <p className="hidden lg:block text-xs text-[hsl(var(--muted-foreground))] max-w-xl">
          Import <strong>Facebook Lead Ads</strong> CSV (FULL_NAME, PHONE, COMPANY_NAME, City, Address) or other CSV
          formats. Outreach logs are saved in the database — open a lead to view full history after refresh. Export
          leads as Excel anytime.
        </p>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onCsvFile}
          />
          <input
            ref={facebookCsvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const name = pendingCsvImportRef.current?.importUploaderName || currentUser
              onFacebookCsvFile(e, name)
            }}
          />
          <Button
            size="sm"
            variant="default"
            className="h-10 sm:h-8 text-xs col-span-2 sm:col-span-1"
            disabled={importing}
            onClick={() => setShowFacebookImportModal(true)}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            {importing ? "Importing…" : "Import Facebook leads"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-10 sm:h-8 text-xs"
            disabled={loadingInstallersCsv || importing}
            onClick={() => loadHardcodedInstallersCsv()}
          >
            {loadingInstallersCsv ? "Syncing…" : "Sync phones"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-10 sm:h-8 text-xs"
            disabled={importing}
            onClick={() => setShowCsvImportModal(true)}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Import CSV
          </Button>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`}
            download="leads-sample.csv"
            className="inline-flex items-center justify-center h-10 sm:h-8 text-xs text-[hsl(var(--primary))] underline underline-offset-2"
          >
            Sample CSV
          </a>
          <Button
            size="sm"
            variant="outline"
            className="h-10 sm:h-8 text-xs"
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
          <Button size="sm" className="h-10 sm:h-8 text-xs cursor-pointer col-span-2 sm:col-span-1" onClick={() => setShowAddLead(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add lead
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
        </div>
      ) : filteredAll.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <MessageSquare className="h-10 w-10 opacity-30 mb-2" />
          {leads.length === 0
            ? "No leads yet. Import a CSV or add a lead manually."
            : isLeadFiltersActive(statusFilter, contactFilter, contactFrom, contactTo) || search.trim()
              ? "No leads match your filters."
              : "No leads match your search."}
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
                      <div className="flex flex-col sm:flex-row sm:items-stretch">
                        <button
                          type="button"
                          onClick={() => toggleBatch(group.importBatchId)}
                          className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 text-left hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer"
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-sm text-[hsl(var(--foreground))] block truncate">
                              {group.importUploaderName}
                            </span>
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">{when}</span>
                          </div>
                          <span className="shrink-0 text-[11px] rounded-full bg-[hsl(var(--muted))]/50 px-2 py-0.5 tabular-nums">
                            {group.leads.length} lead{group.leads.length === 1 ? "" : "s"}
                          </span>
                        </button>
                        <div className="flex border-t sm:border-t-0 sm:border-l border-[hsl(var(--border))]">
                          <button
                            type="button"
                            className="flex-1 sm:flex-initial shrink-0 px-3 py-2.5 sm:py-3 flex items-center justify-center text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]/40 cursor-pointer text-[11px] font-medium disabled:opacity-50 min-h-[44px]"
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
                            className="shrink-0 px-3 py-2.5 sm:py-3 flex items-center justify-center text-red-500 hover:bg-red-500/10 border-l border-[hsl(var(--border))] cursor-pointer min-h-[44px] min-w-[44px]"
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
                      </div>
                      {open && (
                        <div className="border-t border-[hsl(var(--border))]">
                          <LeadsListView
                            leads={group.leads}
                            onOpenDetail={openLeadDetail}
                            onStatusChange={onStatusChange}
                            onLog={setLogForLead}
                            onDelete={requestDeleteLead}
                          />
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
              <div className="rounded-lg border overflow-hidden">
                <LeadsListView
                  leads={importBatchGroups.length === 0 ? filteredAll : tableLeads}
                  onOpenDetail={openLeadDetail}
                  onStatusChange={onStatusChange}
                  onLog={setLogForLead}
                  onDelete={requestDeleteLead}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {showFacebookImportModal && (
        <FacebookLeadImportModal
          importing={importing}
          onClose={() => setShowFacebookImportModal(false)}
          onPickFile={(uploaderName) => {
            pendingCsvImportRef.current = {
              importBatchId:
                typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `fb-${Date.now()}`,
              importUploaderName: uploaderName,
            }
            setShowFacebookImportModal(false)
            queueMicrotask(() => facebookCsvInputRef.current?.click())
          }}
        />
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
          onSaved={async (savedContact) => {
            const leadId = logForLead.id
            setLeads((prev) =>
              prev.map((l) =>
                l.id === leadId
                  ? {
                      ...l,
                      contactCount: l.contactCount + 1,
                      lastContactedAt: savedContact.contactedAt,
                      lastResponseSnippet: savedContact.leadResponse
                        ? savedContact.leadResponse.slice(0, 160)
                        : l.lastResponseSnippet,
                      status:
                        l.status === "closed"
                          ? l.status
                          : savedContact.leadResponse.trim()
                            ? "responded"
                            : l.status === "new"
                              ? "contacted"
                              : l.status,
                    }
                  : l,
              ),
            )
            if (detailId === leadId) {
              setDetail((d) =>
                d
                  ? {
                      ...d,
                      contacts: [savedContact, ...d.contacts],
                      contactCount: d.contactCount + 1,
                      lastContactedAt: savedContact.contactedAt,
                    }
                  : d,
              )
              await reloadLeadDetail(leadId)
            }
            await refresh()
            await refreshStats()
            setLogForLead(null)
          }}
        />
      )}

      {detailId && (
        <LeadDetailDrawer
          loading={detailLoading}
          lead={detail}
          onClose={closeLeadDetail}
          onRefreshHistory={() => detailId && reloadLeadDetail(detailId)}
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
            if (detailId === deleteId) closeLeadDetail()
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
              closeLeadDetail()
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

function FacebookLeadImportModal({
  importing,
  onClose,
  onPickFile,
}: {
  importing: boolean
  onClose: () => void
  onPickFile: (uploaderName: string) => void
}) {
  const [name, setName] = useState("Facebook Lead Ads")

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[hsl(var(--background))] rounded-lg border shadow-lg max-w-lg w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Import Facebook Lead Ads</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Upload Meta export with FULL_NAME, PHONE, COMPANY_NAME, City, Address.
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono break-all">
          {FACEBOOK_LEAD_ADS_HEADERS.join(", ")}
        </p>
        <div>
          <label className="text-xs font-medium">Import label *</label>
          <input
            className="mt-1 w-full h-9 rounded border px-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            disabled={!name.trim() || importing}
            onClick={() => onPickFile(name.trim())}
          >
            {importing ? "Importing…" : "Choose CSV file"}
          </Button>
        </div>
      </div>
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
          Who is importing these leads? This name and the import date are shown on the import record.
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
  onSaved: (contact: CrmLeadContactRow) => Promise<void>
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
        try {
          screenshotUrls = await uploadFiles(files, "crm-leads")
        } catch {
          toast({
            type: "warning",
            title: "Screenshots not uploaded",
            message: "Saving outreach log without images.",
          })
        }
      }
      const savedContact = await logLeadContact({
        leadId: lead.id,
        contactedBy: currentUser,
        contactedById: currentUserId ?? null,
        contactedAt: new Date(when).toISOString(),
        screenshotUrls,
        leadResponse: response,
        notes,
      })
      toast({ type: "success", title: "Outreach logged" })
      await onSaved(savedContact)
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
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[hsl(var(--background))] rounded-t-xl sm:rounded-lg border shadow-lg max-w-lg w-full p-4 space-y-3 max-h-[92vh] overflow-y-auto"
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
  onRefreshHistory,
}: {
  loading: boolean
  lead: (CrmLeadRow & { contacts: CrmLeadContactRow[] }) | null
  onClose: () => void
  onLog: () => void
  onRefreshHistory: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full sm:max-w-md bg-[hsl(var(--background))] sm:border-l shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 sm:p-4 border-b flex justify-between items-center gap-2">
          <h3 className="text-sm font-semibold">Lead detail</h3>
          <button type="button" onClick={onClose} className="p-2 -mr-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {loading || !lead ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-lg font-semibold">{lead.name}</p>
                {lead.company && <p className="text-sm text-[hsl(var(--muted-foreground))]">{lead.company}</p>}
                <div className="mt-3 space-y-2">
                  {lead.city?.trim() && <p className="text-xs">City: {lead.city}</p>}
                  {lead.address?.trim() && <p className="text-xs">Address: {lead.address}</p>}
                  {lead.phone?.trim() && (
                    <LeadPhoneLinks phone={lead.phone} leadName={lead.name} layout="card" />
                  )}
                  {lead.email && <p className="text-xs break-all">Email: {lead.email}</p>}
                  {lead.notes && (
                    <div className="text-[hsl(var(--muted-foreground))] pt-1 whitespace-pre-line text-xs space-y-1">
                      <p className="font-medium text-[hsl(var(--foreground))]">CSV fields</p>
                      <p>{lead.notes}</p>
                    </div>
                  )}
                  {lead.importUploaderName && (
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] pt-2 border-t border-[hsl(var(--border))] mt-2">
                      CSV import: <span className="font-medium text-[hsl(var(--foreground))]">{lead.importUploaderName}</span>
                      {" · "}
                      {new Date(lead.importedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  )}
                </div>
                <Button size="sm" className="mt-3 h-10 sm:h-8 w-full sm:w-auto text-xs cursor-pointer" onClick={onLog}>
                  Log outreach
                </Button>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                    Outreach history ({lead.contactCount})
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[10px] text-[hsl(var(--primary))] hover:underline cursor-pointer"
                    onClick={onRefreshHistory}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </button>
                </div>
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
