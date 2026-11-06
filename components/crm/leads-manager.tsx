"use client"

import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { uploadFiles } from "@/lib/upload"
import { enrichLeadRowsWithPhonesFromCsv, parseLeadImportCsv } from "@/lib/csv-leads"
import {
  facebookLeadAdsImportSummary,
  isFacebookLeadAdsCsv,
  FACEBOOK_LEAD_ADS_SAMPLE_CSV,
  LEAD_IMPORT_HEADERS,
} from "@/lib/facebook-lead-ads-csv"
import { downloadLeadsExcel } from "@/lib/crm-excel-export"
import { isErpAdmin, getUsers, ROLE_LABELS, type User as ErpUser } from "@/lib/auth"
import { LEAD_STATUS_OPTIONS, leadStatusLabel } from "@/lib/crm-lead-status"
import { isLocalIndustrialLead } from "@/lib/crm-local-leads"
import {
  fetchLeads,
  fetchLeadDetail,
  fetchLeadContacts,
  importLeadsJson,
  importFacebookLeadAdsCsv,
  syncInstallersPhonesFromBrowser,
  syncPhonesFromCsvText,
  patchLeadStatus,
  patchLeadAssignment,
  patchLeadFollowUp,
  patchLeadFavorite,
  deleteLead,
  deleteLeadsByImportBatch,
  renameLeadImportBatch,
  mergeLeadImportBatches,
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
  Pencil,
  GitMerge,
  CalendarClock,
  Link2,
  Star,
  MapPin,
} from "lucide-react"

type LeadSection = "all" | "favorites" | "local"

const STATUS_OPTIONS = LEAD_STATUS_OPTIONS

type LeadStatusFilter = "all" | (typeof STATUS_OPTIONS)[number]["value"]

const LEAD_STATUS_FILTER_OPTIONS: { value: LeadStatusFilter; label: string; hint?: string }[] = [
  { value: "all", label: "All leads" },
  { value: "new", label: "New / not contacted", hint: "No outreach logged" },
  { value: "contacted", label: "Contacted", hint: "Marked as contacted" },
  { value: "interested", label: "Interested", hint: "Lead showed interest" },
  { value: "not_interested", label: "Not interested", hint: "Lead declined or not interested" },
  { value: "price_negotiable", label: "Price negotiable", hint: "Discussing price or terms" },
  { value: "not_closed", label: "Not closed", hint: "Lead still open — not closed yet" },
  { value: "pending", label: "Pending", hint: "Waiting on lead or next step" },
  { value: "not_responded", label: "Not responded", hint: "Outreach logged, no reply" },
  { value: "responded", label: "Qualified (responded)", hint: "Leads who replied" },
  { value: "closed", label: "Closed" },
]

type BatchLeadFilters = {
  statusFilter: LeadStatusFilter
  contactFilter: ContactDateFilter
  contactFrom: string
  contactTo: string
}

const DEFAULT_BATCH_FILTERS: BatchLeadFilters = {
  statusFilter: "all",
  contactFilter: "all",
  contactFrom: "",
  contactTo: "",
}

function isBatchFiltersActive(filters: BatchLeadFilters) {
  return isLeadFiltersActive(
    filters.statusFilter,
    filters.contactFilter,
    filters.contactFrom,
    filters.contactTo,
    "all",
  )
}

function filterBatchLeads(leads: CrmLeadRow[], filters: BatchLeadFilters) {
  return applyLeadFilters(leads, {
    search: "",
    statusFilter: filters.statusFilter,
    contactFilter: filters.contactFilter,
    contactFrom: filters.contactFrom,
    contactTo: filters.contactTo,
    assignedFilter: "all",
  })
}

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
    assignedFilter,
  }: {
    search: string
    statusFilter: LeadStatusFilter
    contactFilter: ContactDateFilter
    contactFrom: string
    contactTo: string
    assignedFilter: string
  },
) {
  const q = search.toLowerCase().trim()

  return leads.filter((l) => {
    if (statusFilter !== "all") {
      if (statusFilter === "not_closed") {
        if (l.status !== "not_closed" && l.status !== "on_hold") return false
      } else if (l.status !== statusFilter) {
        return false
      }
    }
    if (!matchesContactDateFilter(l, contactFilter, contactFrom, contactTo)) return false
    if (assignedFilter === "unassigned") {
      if (l.assignedToUserId) return false
    } else if (assignedFilter !== "all" && l.assignedToUserId !== assignedFilter) {
      return false
    }
    if (!q) return true
    return (
      l.name.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q) ||
      (l.city ?? "").toLowerCase().includes(q) ||
      (l.address ?? "").toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.phone.toLowerCase().includes(q) ||
      (l.assignedToName ?? "").toLowerCase().includes(q)
    )
  })
}

function isLeadFiltersActive(
  statusFilter: LeadStatusFilter,
  contactFilter: ContactDateFilter,
  contactFrom: string,
  contactTo: string,
  assignedFilter: string,
) {
  if (statusFilter !== "all") return true
  if (assignedFilter !== "all") return true
  if (contactFilter === "today" || contactFilter === "never") return true
  if (contactFilter === "range" && (contactFrom || contactTo)) return true
  return false
}

function summarizeAssignees(leads: CrmLeadRow[]) {
  const assignees = new Map<string, { name: string; count: number }>()
  let unassigned = 0
  for (const l of leads) {
    if (!l.assignedToUserId) {
      unassigned++
      continue
    }
    const existing = assignees.get(l.assignedToUserId)
    if (existing) existing.count++
    else assignees.set(l.assignedToUserId, { name: l.assignedToName || "Unknown", count: 1 })
  }
  return {
    unassigned,
    assignees: [...assignees.entries()]
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

const leadFilterControlClass =
  "mt-1 w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"

function LeadFiltersActiveChips({
  statusFilter,
  contactFilter,
  contactFrom,
  contactTo,
  assignedFilter,
  assigneeSummary,
  showAssignedFilter,
}: {
  statusFilter: LeadStatusFilter
  contactFilter: ContactDateFilter
  contactFrom: string
  contactTo: string
  assignedFilter: string
  assigneeSummary: ReturnType<typeof summarizeAssignees>
  showAssignedFilter: boolean
}) {
  const filtersActive = isLeadFiltersActive(
    statusFilter,
    contactFilter,
    contactFrom,
    contactTo,
    assignedFilter,
  )
  if (!filtersActive) return null

  const statusLabel =
    LEAD_STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "All leads"
  const contactLabel =
    CONTACT_DATE_FILTER_OPTIONS.find((o) => o.value === contactFilter)?.label ?? "Any outreach date"
  const assignedLabel =
    assignedFilter === "all"
      ? "All assignees"
      : assignedFilter === "unassigned"
        ? "Unassigned"
        : assigneeSummary.assignees.find((a) => a.id === assignedFilter)?.name ?? "Assigned member"

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      {statusFilter !== "all" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] dark:bg-white/10 px-2 py-0.5 text-[10px] text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
          <Filter className="h-3 w-3 opacity-60 shrink-0" />
          {statusLabel}
        </span>
      )}
      {contactFilter !== "all" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] dark:bg-white/10 px-2 py-0.5 text-[10px] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] max-w-full">
          <Calendar className="h-3 w-3 opacity-60 shrink-0" />
          <span className="truncate">{contactLabel}</span>
          {contactFilter === "range" && (contactFrom || contactTo) && (
            <span className="text-[#86868b] dark:text-[hsl(var(--muted-foreground))] shrink-0">
              ({contactFrom || "…"} → {contactTo || "…"})
            </span>
          )}
        </span>
      )}
      {assignedFilter !== "all" && showAssignedFilter && (
        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] dark:bg-white/10 px-2 py-0.5 text-[10px] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] max-w-[12rem]">
          <Link2 className="h-3 w-3 opacity-60 shrink-0" />
          <span className="truncate">{assignedLabel}</span>
        </span>
      )}
    </div>
  )
}

function LeadFiltersPopoverContent({
  activeSection,
  setActiveSection,
  allSectionCount,
  favoriteCount,
  localCount,
  statsDate,
  setStatsDate,
  myTodayCount,
  stats,
  showOutreachByMember,
  statusFilter,
  contactFilter,
  contactFrom,
  contactTo,
  assignedFilter,
  assigneeSummary,
  showAssignedFilter,
  totalCount,
  filteredCount,
  onStatusFilter,
  onContactFilter,
  onContactFrom,
  onContactTo,
  onAssignedFilter,
}: {
  activeSection: LeadSection
  setActiveSection: (v: LeadSection) => void
  allSectionCount: number
  favoriteCount: number
  localCount: number
  statsDate: string
  setStatsDate: (v: string) => void
  myTodayCount: number
  stats: { total: number; byMember: { name: string; userId: string | null; count: number }[] }
  showOutreachByMember: boolean
  statusFilter: LeadStatusFilter
  contactFilter: ContactDateFilter
  contactFrom: string
  contactTo: string
  assignedFilter: string
  assigneeSummary: ReturnType<typeof summarizeAssignees>
  showAssignedFilter: boolean
  totalCount: number
  filteredCount: number
  onStatusFilter: (v: LeadStatusFilter) => void
  onContactFilter: (v: ContactDateFilter) => void
  onContactFrom: (v: string) => void
  onContactTo: (v: string) => void
  onAssignedFilter: (v: string) => void
}) {
  const sectionTabs: { id: LeadSection; label: string; count: number | null; icon?: ReactNode }[] = [
    { id: "all", label: "All", count: allSectionCount },
    {
      id: "favorites",
      label: "Favorites",
      count: favoriteCount,
      icon: <Star className="h-3 w-3 shrink-0 opacity-80" />,
    },
    { id: "local", label: "Local", count: localCount, icon: <MapPin className="h-3 w-3 shrink-0 opacity-80" /> },
  ]

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))] mb-1.5">
          View
        </p>
        <div
          className="flex rounded-[11px] bg-[#f2f2f7] dark:bg-[hsl(var(--muted))]/35 p-0.5 gap-0.5"
          role="tablist"
          aria-label="Lead list view"
        >
          {sectionTabs.map((tab) => {
            const selected = activeSection === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveSection(tab.id)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[9px] px-2 py-1.5 text-[11px] font-semibold tracking-tight transition-all cursor-pointer ${
                  selected
                    ? "bg-white text-[#1d1d1f] shadow-sm dark:bg-[hsl(var(--card))] dark:text-[hsl(var(--foreground))]"
                    : "text-[#86868b] hover:text-[#1d1d1f] dark:text-[hsl(var(--muted-foreground))] dark:hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
                {tab.count != null && tab.count > 0 && (
                  <span
                    className={`tabular-nums rounded-full px-1.5 py-px text-[10px] font-semibold ${
                      selected ? "bg-black/[0.06] dark:bg-white/10" : "bg-black/[0.04] dark:bg-white/5"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-[12px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-[#fafafa] dark:bg-[hsl(var(--muted))]/15 p-2.5 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
          Outreach stats (UTC day)
        </p>
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-[#86868b]" />
          <input
            type="date"
            value={statsDate}
            onChange={(e) => setStatsDate(e.target.value)}
            className={`${leadFilterControlClass} min-w-0 flex-1`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
              Your contacts
            </p>
            <p className="text-lg font-semibold tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              {myTodayCount}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
              Team total
            </p>
            <p className="text-lg font-semibold tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              {stats.total}
            </p>
          </div>
        </div>
        {showOutreachByMember && (
          <div className="pt-2 border-t border-black/[0.06] dark:border-[hsl(var(--border))]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))] mb-1.5">
              By team member
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stats.byMember.map((m) => (
                <span
                  key={`${m.name}-${m.userId ?? "x"}`}
                  className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] px-2 py-0.5 text-[10px] text-[#1d1d1f] dark:text-[hsl(var(--foreground))]"
                >
                  <User className="h-3 w-3 opacity-60 shrink-0" />
                  {m.name}: <strong className="tabular-nums">{m.count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 ${showAssignedFilter ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3`}>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
            Lead status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilter(e.target.value as LeadStatusFilter)}
            className={leadFilterControlClass}
          >
            {LEAD_STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {LEAD_STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.hint && (
            <p className="mt-1 text-[10px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
              {LEAD_STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.hint}
            </p>
          )}
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
            Outreach date
          </label>
          <select
            value={contactFilter}
            onChange={(e) => onContactFilter(e.target.value as ContactDateFilter)}
            className={leadFilterControlClass}
          >
            {CONTACT_DATE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {showAssignedFilter && (
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
              Assigned to
            </label>
            <select
              value={assignedFilter}
              onChange={(e) => onAssignedFilter(e.target.value)}
              className={leadFilterControlClass}
            >
              <option value="all">All assignees</option>
              <option value="unassigned">Unassigned ({assigneeSummary.unassigned})</option>
              {assigneeSummary.assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.count})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
              Filter leads linked to a team member via the Link button.
            </p>
          </div>
        )}
      </div>

      {showAssignedFilter && assigneeSummary.assignees.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))] mb-2">
            Quick filter by assignee
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onAssignedFilter("all")}
              className={`inline-flex items-center gap-1 rounded-full border border-black/[0.08] dark:border-[hsl(var(--border))] px-2.5 py-1 text-[11px] cursor-pointer transition-colors ${
                assignedFilter === "all"
                  ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                  : "bg-[#f2f2f7] dark:bg-[hsl(var(--background))] hover:bg-black/[0.06]"
              }`}
            >
              All
            </button>
            {assigneeSummary.unassigned > 0 && (
              <button
                type="button"
                onClick={() => onAssignedFilter("unassigned")}
                className={`inline-flex items-center gap-1 rounded-full border border-black/[0.08] dark:border-[hsl(var(--border))] px-2.5 py-1 text-[11px] cursor-pointer transition-colors ${
                  assignedFilter === "unassigned"
                    ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                    : "bg-[#f2f2f7] dark:bg-[hsl(var(--background))] hover:bg-black/[0.06]"
                }`}
              >
                Unassigned: <strong>{assigneeSummary.unassigned}</strong>
              </button>
            )}
            {assigneeSummary.assignees.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onAssignedFilter(a.id)}
                className={`inline-flex items-center gap-1 rounded-full border border-black/[0.08] dark:border-[hsl(var(--border))] px-2.5 py-1 text-[11px] cursor-pointer transition-colors ${
                  assignedFilter === a.id
                    ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                    : "bg-[#f2f2f7] dark:bg-[hsl(var(--background))] hover:bg-black/[0.06]"
                }`}
              >
                <User className="h-3 w-3 opacity-60" />
                {a.name}: <strong>{a.count}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      {contactFilter === "range" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
              From
            </label>
            <input
              type="date"
              value={contactFrom}
              onChange={(e) => onContactFrom(e.target.value)}
              className={leadFilterControlClass}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
              To
            </label>
            <input
              type="date"
              value={contactTo}
              onChange={(e) => onContactTo(e.target.value)}
              className={leadFilterControlClass}
            />
          </div>
        </div>
      )}

      <div className="pt-1 border-t border-black/[0.06] dark:border-[hsl(var(--border))]">
        <p className="text-[11px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
          Showing <strong className="text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{filteredCount}</strong> of{" "}
          {totalCount} lead{totalCount === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  )
}

function ImportBatchFiltersPanel({
  filters,
  totalCount,
  filteredCount,
  onStatusFilter,
  onContactFilter,
  onContactFrom,
  onContactTo,
  onClear,
}: {
  filters: BatchLeadFilters
  totalCount: number
  filteredCount: number
  onStatusFilter: (v: LeadStatusFilter) => void
  onContactFilter: (v: ContactDateFilter) => void
  onContactFrom: (v: string) => void
  onContactTo: (v: string) => void
  onClear: () => void
}) {
  const filtersActive = isBatchFiltersActive(filters)
  const statusLabel =
    LEAD_STATUS_FILTER_OPTIONS.find((o) => o.value === filters.statusFilter)?.label ?? "All leads"
  const contactLabel =
    CONTACT_DATE_FILTER_OPTIONS.find((o) => o.value === filters.contactFilter)?.label ?? "Any outreach date"

  return (
    <div className="border-b border-black/[0.06] dark:border-[hsl(var(--border))] bg-[#fafafa] dark:bg-[hsl(var(--muted))]/20 px-3 sm:px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
          Filter this import
        </p>
        {filtersActive && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold text-[#0071e3] cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
            Lead status
          </label>
          <select
            value={filters.statusFilter}
            onChange={(e) => onStatusFilter(e.target.value as LeadStatusFilter)}
            className={leadFilterControlClass}
          >
            {LEAD_STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
            Outreach date
          </label>
          <select
            value={filters.contactFilter}
            onChange={(e) => {
              const v = e.target.value as ContactDateFilter
              onContactFilter(v)
              if (v === "today") {
                const today = todayIsoDate()
                onContactFrom(today)
                onContactTo(today)
              } else if (v !== "range") {
                onContactFrom("")
                onContactTo("")
              }
            }}
            className={leadFilterControlClass}
          >
            {CONTACT_DATE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {filters.contactFilter === "range" && (
          <>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
                From
              </label>
              <input
                type="date"
                value={filters.contactFrom}
                onChange={(e) => onContactFrom(e.target.value)}
                className={leadFilterControlClass}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
                To
              </label>
              <input
                type="date"
                value={filters.contactTo}
                onChange={(e) => onContactTo(e.target.value)}
                className={leadFilterControlClass}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
        <span>
          Showing <strong className="text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{filteredCount}</strong> of{" "}
          {totalCount}
        </span>
        {filters.statusFilter !== "all" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-[hsl(var(--card))] border border-black/[0.06] px-2 py-0.5 text-[10px]">
            <Filter className="h-3 w-3 opacity-60" />
            {statusLabel}
          </span>
        )}
        {filters.contactFilter !== "all" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-[hsl(var(--card))] border border-black/[0.06] px-2 py-0.5 text-[10px]">
            <Calendar className="h-3 w-3 opacity-60" />
            {contactLabel}
            {filters.contactFilter === "range" && (filters.contactFrom || filters.contactTo) && (
              <span>
                ({filters.contactFrom || "…"} → {filters.contactTo || "…"})
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

type ContactDateFilter = "all" | "today" | "never" | "range"

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function followUpDisplay(lead: Pick<CrmLeadRow, "followUpAt" | "followUpNotes">) {
  if (!lead.followUpAt) return null
  const d = new Date(lead.followUpAt)
  if (Number.isNaN(d.getTime())) return null
  return {
    text: d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }),
    overdue: d.getTime() < Date.now(),
    notes: lead.followUpNotes?.trim() || "",
  }
}

function FollowUpCell({ lead }: { lead: CrmLeadRow }) {
  const fu = followUpDisplay(lead)
  if (!fu) return <span className="text-[hsl(var(--muted-foreground))]">—</span>
  return (
    <div className="min-w-0">
      <p className={`text-[11px] tabular-nums ${fu.overdue ? "text-red-600 font-medium" : ""}`}>{fu.text}</p>
      {fu.notes && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] line-clamp-2 mt-0.5" title={fu.notes}>
          {fu.notes}
        </p>
      )}
    </div>
  )
}

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
  readOnly = false,
}: {
  lead: CrmLeadRow
  onStatusChange: (lead: CrmLeadRow, status: string) => void
  className?: string
  readOnly?: boolean
}) {
  if (readOnly) {
    return (
      <span className={`inline-flex items-center h-8 sm:h-7 px-2 rounded border bg-[hsl(var(--muted))]/30 text-[11px] ${className}`}>
        {leadStatusLabel(lead.status)}
      </span>
    )
  }
  return (
    <select
      value={lead.status === "on_hold" ? "not_closed" : lead.status}
      onChange={(e) => onStatusChange(lead, e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`h-8 sm:h-7 rounded border bg-[hsl(var(--background))] text-[11px] px-1.5 ${className}`}
      title={leadStatusLabel(lead.status)}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function AssignedToCell({ lead }: { lead: CrmLeadRow }) {
  if (!lead.assignedToUserId) {
    return <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Unassigned</span>
  }
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium truncate">{lead.assignedToName || "ERP user"}</p>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono truncate" title={lead.assignedToUserId}>
        {lead.assignedToUserId}
      </p>
    </div>
  )
}

function FavoriteStarButton({
  isFavorite,
  onToggle,
  size = "sm",
}: {
  isFavorite: boolean
  onToggle: () => void
  size?: "sm" | "md"
}) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5"
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={
        isFavorite
          ? "shrink-0 rounded-full p-1.5 transition-all cursor-pointer text-amber-400 hover:text-amber-300 bg-gradient-to-br from-amber-400/25 to-orange-400/20 hover:from-amber-400/35 hover:to-orange-400/30 shadow-sm shadow-amber-400/20"
          : "shrink-0 rounded-full p-1.5 transition-all cursor-pointer text-[hsl(var(--muted-foreground))] hover:text-amber-400 hover:bg-amber-400/10"
      }
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Star className={`${iconSize}${isFavorite ? " fill-current" : ""}`} />
    </button>
  )
}

function LeadCard({
  lead,
  onOpenDetail,
  onStatusChange,
  onLog,
  onFollowUp,
  onLinkUser,
  onDelete,
  onToggleFavorite,
  canAssign,
  readOnly = false,
  highlightFavorite = false,
}: {
  lead: CrmLeadRow
  onOpenDetail: (id: string) => void
  onStatusChange: (lead: CrmLeadRow, status: string) => void
  onLog: (lead: CrmLeadRow) => void
  onFollowUp: (lead: CrmLeadRow) => void
  onLinkUser: (lead: CrmLeadRow) => void
  onDelete: (id: string) => void
  onToggleFavorite: (lead: CrmLeadRow) => void
  canAssign: boolean
  readOnly?: boolean
  highlightFavorite?: boolean
}) {
  const fu = followUpDisplay(lead)
  return (
    <div
      className={`rounded-lg border p-3 space-y-2.5 active:bg-[hsl(var(--muted))]/20 ${
        highlightFavorite || lead.isFavorite
          ? "border-amber-300/60 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20"
          : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
      }`}
      onClick={() => onOpenDetail(lead.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {!readOnly && (
              <FavoriteStarButton
                isFavorite={lead.isFavorite}
                onToggle={() => onToggleFavorite(lead)}
              />
            )}
            {lead.isFavorite && readOnly && (
              <Star className="h-4 w-4 shrink-0 text-amber-400 fill-amber-400" />
            )}
            <p className="font-semibold text-sm leading-snug">{lead.name}</p>
          </div>
          {lead.company?.trim() && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">{lead.company}</p>
          )}
          {lead.city?.trim() && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">{lead.city}</p>
          )}
        </div>
        <LeadStatusSelect lead={lead} onStatusChange={onStatusChange} className="shrink-0 max-w-[110px]" readOnly={readOnly} />
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

      {fu && (
        <p className={`text-[11px] ${fu.overdue ? "text-red-600 font-medium" : "text-[hsl(var(--muted-foreground))]"}`}>
          Follow up: {fu.text}
        </p>
      )}

      <div className="text-[11px]" onClick={(e) => e.stopPropagation()}>
        <AssignedToCell lead={lead} />
      </div>

      {!readOnly && (
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
          className="shrink-0 flex items-center justify-center w-10 h-10 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]/50 rounded-lg border border-[hsl(var(--border))] cursor-pointer"
          title="Set follow-up"
          onClick={() => onFollowUp(lead)}
        >
          <CalendarClock className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="shrink-0 flex items-center justify-center w-10 h-10 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]/50 rounded-lg border border-[hsl(var(--border))] cursor-pointer"
          title={canAssign ? "Link ERP user" : "View assignment"}
          onClick={() => onLinkUser(lead)}
        >
          <Link2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="shrink-0 flex items-center justify-center w-10 h-10 text-red-500 hover:bg-red-500/10 rounded-lg border border-[hsl(var(--border))] cursor-pointer"
          title="Delete lead"
          onClick={() => onDelete(lead.id)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      )}
    </div>
  )
}

const LEADS_PAGE_SIZE = 60

function LeadsListView({
  leads,
  onOpenDetail,
  onStatusChange,
  onLog,
  onFollowUp,
  onLinkUser,
  onDelete,
  onToggleFavorite,
  canAssign,
  readOnly = false,
  highlightFavorite = false,
}: {
  leads: CrmLeadRow[]
  onOpenDetail: (id: string) => void
  onStatusChange: (lead: CrmLeadRow, status: string) => void
  onLog: (lead: CrmLeadRow) => void
  onFollowUp: (lead: CrmLeadRow) => void
  onLinkUser: (lead: CrmLeadRow) => void
  onDelete: (id: string) => void
  onToggleFavorite: (lead: CrmLeadRow) => void
  canAssign: boolean
  readOnly?: boolean
  highlightFavorite?: boolean
}) {
  const [visibleCount, setVisibleCount] = useState(LEADS_PAGE_SIZE)
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    setVisibleCount(LEADS_PAGE_SIZE)
  }, [leads])

  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(min-width: 768px)")
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const visible = leads.length <= visibleCount ? leads : leads.slice(0, visibleCount)
  const hasMore = leads.length > visibleCount

  return (
    <>
      {!isDesktop ? (
        <div className="space-y-2 p-2">
          {visible.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onOpenDetail={onOpenDetail}
              onStatusChange={onStatusChange}
              onLog={onLog}
              onFollowUp={onFollowUp}
              onLinkUser={onLinkUser}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              canAssign={canAssign}
              readOnly={readOnly}
              highlightFavorite={highlightFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full min-w-[1240px] text-[13px]">
            <thead>
              <tr className="border-b border-black/[0.04] dark:border-[hsl(var(--border))] bg-[#fafafa] dark:bg-[hsl(var(--muted))]/30">
                <th className="h-9 px-2 text-center text-[11px] font-medium text-[#86868b] w-10">★</th>
                <th className="h-9 px-3 text-left text-[11px] font-medium text-[#86868b]">Lead</th>
                <th className="h-9 px-3 text-left text-[11px] font-medium text-[#86868b]">Company</th>
                <th className="h-9 px-3 text-left text-[11px] font-medium text-[#86868b]">City</th>
                <th className="h-9 px-3 text-left text-[11px] font-medium text-[#86868b]">Phone</th>
                <th className="h-9 px-3 text-left text-[11px] font-medium text-[#86868b]">Assigned to</th>
                <th className="h-9 px-3 text-left text-[11px] font-medium text-[#86868b]">Status</th>
                <th className="h-9 px-3 text-center text-[11px] font-medium text-[#86868b]">Logs</th>
                <th className="h-9 px-3 text-left text-[11px] font-medium text-[#86868b]">Last outreach</th>
                <th className="h-9 px-3 text-left text-[11px] font-medium text-[#86868b]">Follow up</th>
                {!readOnly && (
                  <th className="h-9 px-3 text-center text-[11px] font-medium text-[#86868b]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-[hsl(var(--border))]">
              {visible.map((lead) => (
                <LeadTableRow
                  key={lead.id}
                  lead={lead}
                  onOpenDetail={onOpenDetail}
                  onStatusChange={onStatusChange}
                  onLog={onLog}
                  onFollowUp={onFollowUp}
                  onLinkUser={onLinkUser}
                  onDelete={onDelete}
                  onToggleFavorite={onToggleFavorite}
                  canAssign={canAssign}
                  readOnly={readOnly}
                  highlightFavorite={highlightFavorite}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && (
        <div className="flex items-center justify-center gap-3 py-3 border-t border-black/[0.04] dark:border-[hsl(var(--border))]">
          <p className="text-[11px] text-[#86868b]">
            Showing {visible.length} of {leads.length}
          </p>
          <button
            type="button"
            className="h-8 rounded-full px-3.5 text-[11px] font-semibold bg-[#f2f2f7] dark:bg-[hsl(var(--muted))]/40 text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.06] cursor-pointer"
            onClick={() => setVisibleCount((n) => n + LEADS_PAGE_SIZE)}
          >
            Show more
          </button>
          <button
            type="button"
            className="h-8 rounded-full px-3.5 text-[11px] font-semibold text-[#0071e3] hover:bg-[#0071e3]/08 cursor-pointer"
            onClick={() => setVisibleCount(leads.length)}
          >
            Show all
          </button>
        </div>
      )}
    </>
  )
}

function LeadTableRow({
  lead,
  onOpenDetail,
  onStatusChange,
  onLog,
  onFollowUp,
  onLinkUser,
  onDelete,
  onToggleFavorite,
  canAssign,
  readOnly = false,
  highlightFavorite = false,
}: {
  lead: CrmLeadRow
  onOpenDetail: (id: string) => void
  onStatusChange: (lead: CrmLeadRow, status: string) => void
  onLog: (lead: CrmLeadRow) => void
  onFollowUp: (lead: CrmLeadRow) => void
  onLinkUser: (lead: CrmLeadRow) => void
  onDelete: (id: string) => void
  onToggleFavorite: (lead: CrmLeadRow) => void
  canAssign: boolean
  readOnly?: boolean
  highlightFavorite?: boolean
}) {
  return (
    <tr
      className={`hover:bg-[hsl(var(--muted))]/30 cursor-pointer ${
        highlightFavorite || lead.isFavorite
          ? "bg-gradient-to-r from-amber-50/60 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10"
          : ""
      }`}
      onClick={() => onOpenDetail(lead.id)}
    >
      <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        {!readOnly ? (
          <FavoriteStarButton
            isFavorite={lead.isFavorite}
            onToggle={() => onToggleFavorite(lead)}
          />
        ) : lead.isFavorite ? (
          <Star className="h-4 w-4 mx-auto text-amber-400 fill-amber-400" />
        ) : (
          <span className="text-[hsl(var(--muted-foreground))]/30">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs font-medium">{lead.name}</td>
      <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{lead.company || "—"}</td>
      <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{lead.city || "—"}</td>
      <td className="px-3 py-2 text-xs tabular-nums" onClick={(e) => e.stopPropagation()}>
        <LeadPhoneLinks phone={lead.phone} leadName={lead.name} />
      </td>
      <td className="px-3 py-2 max-w-[140px]" onClick={(e) => e.stopPropagation()}>
        <AssignedToCell lead={lead} />
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <LeadStatusSelect lead={lead} onStatusChange={onStatusChange} className="max-w-[120px]" readOnly={readOnly} />
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
      <td className="px-3 py-2 text-[11px]" onClick={(e) => e.stopPropagation()}>
        {readOnly ? (
          <FollowUpCell lead={lead} />
        ) : (
        <button
          type="button"
          className="text-left w-full rounded px-1 py-0.5 hover:bg-[hsl(var(--muted))]/50 cursor-pointer"
          title="Set follow-up"
          onClick={() => onFollowUp(lead)}
        >
          <FollowUpCell lead={lead} />
        </button>
        )}
      </td>
      {!readOnly && (
      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-2"
            title={canAssign ? "Link ERP user" : "View assignment"}
            onClick={() => onLinkUser(lead)}
          >
            <Link2 className="h-3 w-3 mr-1" />
            Link
          </Button>
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
            className="p-1.5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]/50 rounded cursor-pointer"
            title="Set follow-up"
            onClick={() => onFollowUp(lead)}
          >
            <CalendarClock className="h-3.5 w-3.5" />
          </button>
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
      )}
    </tr>
  )
}

export function LeadsManager({
  currentUser,
  currentUserId,
  userRole,
  readOnly = false,
}: {
  currentUser: string
  currentUserId?: string | null
  userRole?: string
  readOnly?: boolean
}) {
  const { toast } = useToast()
  const canAssignLeads = true
  const [erpUsers, setErpUsers] = useState<ErpUser[]>([])
  const [leads, setLeads] = useState<CrmLeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>("all")
  const [contactFilter, setContactFilter] = useState<ContactDateFilter>("all")
  const [contactFrom, setContactFrom] = useState("")
  const [contactTo, setContactTo] = useState("")
  const [assignedFilter, setAssignedFilter] = useState("all")
  const [showLeadFiltersPopover, setShowLeadFiltersPopover] = useState(false)
  const [leadFilterPos, setLeadFilterPos] = useState<{ top: number; left: number } | null>(null)
  const leadFilterBtnRef = useRef<HTMLButtonElement | null>(null)
  const leadFiltersRef = useRef<HTMLDivElement | null>(null)
  const [statsDate, setStatsDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [stats, setStats] = useState<{ total: number; byMember: { name: string; userId: string | null; count: number }[] }>({
    total: 0,
    byMember: [],
  })
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<(CrmLeadRow & { contacts: CrmLeadContactRow[] }) | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [logForLead, setLogForLead] = useState<CrmLeadRow | null>(null)
  const [followUpForLead, setFollowUpForLead] = useState<CrmLeadRow | null>(null)
  const [linkForLead, setLinkForLead] = useState<CrmLeadRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteImportBatch, setDeleteImportBatch] = useState<{
    importBatchId: string
    importUploaderName: string
    count: number
  } | null>(null)
  const [renameImportBatch, setRenameImportBatch] = useState<{
    importBatchId: string
    importUploaderName: string
  } | null>(null)
  const [mergeImportBatch, setMergeImportBatch] = useState<{
    importBatchId: string
    importUploaderName: string
    count: number
  } | null>(null)
  const [importing, setImporting] = useState(false)
  const [repairingPhonesBatchId, setRepairingPhonesBatchId] = useState<string | null>(null)
  const [loadingInstallersCsv, setLoadingInstallersCsv] = useState(false)
  const [showAddLead, setShowAddLead] = useState(false)
  const [addLeadAsFavorite, setAddLeadAsFavorite] = useState(false)
  const [activeSection, setActiveSection] = useState<LeadSection>("all")
  const [showCsvImportModal, setShowCsvImportModal] = useState(false)
  const [showFacebookImportModal, setShowFacebookImportModal] = useState(false)
  const [openBatchIds, setOpenBatchIds] = useState<Set<string>>(() => new Set())
  const [batchFilters, setBatchFilters] = useState<Record<string, BatchLeadFilters>>({})
  const csvInputRef = useRef<HTMLInputElement>(null)
  const facebookCsvInputRef = useRef<HTMLInputElement>(null)
  const pendingCsvImportRef = useRef<{ importBatchId: string; importUploaderName: string } | null>(null)
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

  const openLeadDetail = useCallback(
    (id: string) => {
      const row = leads.find((l) => l.id === id)
      setDetailId(id)
      if (row) {
        setDetail({ ...row, contacts: [] })
        setDetailLoading(false)
      } else {
        setDetail(null)
        setDetailLoading(true)
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(CRM_LEAD_DETAIL_KEY, id)
      }
    },
    [leads],
  )

  const closeLeadDetail = useCallback(() => {
    setDetailId(null)
    setDetail(null)
    setDetailLoading(false)
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
    getUsers().then(setErpUsers).catch(() => setErpUsers([]))
  }, [])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  useEffect(() => {
    if (!showLeadFiltersPopover) {
      setLeadFilterPos(null)
      return
    }
    function place() {
      const btn = leadFilterBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const panelW = Math.min(400, window.innerWidth - 24)
      const left = Math.min(Math.max(12, r.right - panelW), window.innerWidth - panelW - 12)
      const top = Math.min(r.bottom + 8, window.innerHeight - 24)
      setLeadFilterPos({ top, left })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [showLeadFiltersPopover])

  useEffect(() => {
    if (!showLeadFiltersPopover) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (leadFiltersRef.current?.contains(t) || leadFilterBtnRef.current?.contains(t)) return
      setShowLeadFiltersPopover(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [showLeadFiltersPopover])

  useEffect(() => {
    if (!detailId) return
    let cancelled = false
    ;(async () => {
      setDetailLoading(true)
      try {
        const [detailRes, contacts] = await Promise.all([
          fetchLeadDetail(detailId),
          fetchLeadContacts(detailId),
        ])
        if (cancelled) return
        if (detailRes?.lead) {
          const lead = detailRes.lead as CrmLeadRow & { contacts: CrmLeadContactRow[] }
          setDetail({
            ...lead,
            contacts: contacts.length > 0 ? contacts : lead.contacts || [],
            contactCount: contacts.length > 0 ? contacts.length : lead.contactCount,
          })
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailId])

  const localLeads = useMemo(() => leads.filter((l) => isLocalIndustrialLead(l)), [leads])

  const filteredAll = useMemo(
    () =>
      applyLeadFilters(
        leads.filter((l) => !isLocalIndustrialLead(l)),
        {
          search,
          statusFilter,
          contactFilter,
          contactFrom,
          contactTo,
          assignedFilter,
        },
      ),
    [leads, search, statusFilter, contactFilter, contactFrom, contactTo, assignedFilter],
  )

  const filteredLocal = useMemo(
    () =>
      applyLeadFilters(localLeads, {
        search,
        statusFilter,
        contactFilter,
        contactFrom,
        contactTo,
        assignedFilter,
      }),
    [localLeads, search, statusFilter, contactFilter, contactFrom, contactTo, assignedFilter],
  )

  const localCount = localLeads.length

  const favoriteCount = useMemo(
    () => leads.filter((l) => l.isFavorite && !isLocalIndustrialLead(l)).length,
    [leads],
  )

  const filteredFavorites = useMemo(
    () => filteredAll.filter((l) => l.isFavorite),
    [filteredAll],
  )

  const sectionLeads =
    activeSection === "favorites"
      ? filteredFavorites
      : activeSection === "local"
        ? filteredLocal
        : filteredAll

  const sectionTotalCount =
    activeSection === "favorites"
      ? favoriteCount
      : activeSection === "local"
        ? localCount
        : leads.length - localCount

  const assigneeSummary = useMemo(() => summarizeAssignees(leads), [leads])
  const showAssignedFilter = canAssignLeads || assigneeSummary.assignees.length > 0
  const hasLeadFiltersActive = isLeadFiltersActive(
    statusFilter,
    contactFilter,
    contactFrom,
    contactTo,
    assignedFilter,
  )

  function clearLeadFilters() {
    setStatusFilter("all")
    setContactFilter("all")
    setContactFrom("")
    setContactTo("")
    setAssignedFilter("all")
  }

  function getBatchFilters(batchId: string): BatchLeadFilters {
    return batchFilters[batchId] ?? DEFAULT_BATCH_FILTERS
  }

  function updateBatchFilters(batchId: string, patch: Partial<BatchLeadFilters>) {
    setBatchFilters((prev) => ({
      ...prev,
      [batchId]: { ...(prev[batchId] ?? DEFAULT_BATCH_FILTERS), ...patch },
    }))
  }

  function clearBatchFilters(batchId: string) {
    setBatchFilters((prev) => {
      const next = { ...prev }
      delete next[batchId]
      return next
    })
  }

  const importBatchGroups = useMemo(() => {
    const map = new Map<
      string,
      { importUploaderName: string; importedAt: string; importedAtMs: number; leads: CrmLeadRow[] }
    >()
    for (const l of sectionLeads) {
      if (!l.importBatchId) continue
      const existing = map.get(l.importBatchId)
      const importedAtMs = Date.parse(l.importedAt) || 0
      if (!existing) {
        map.set(l.importBatchId, {
          importUploaderName: l.importUploaderName?.trim() || "Unknown",
          importedAt: l.importedAt,
          importedAtMs,
          leads: [l],
        })
        continue
      }
      existing.leads.push(l)
      if (importedAtMs >= existing.importedAtMs) {
        existing.importedAtMs = importedAtMs
        existing.importedAt = l.importedAt
        existing.importUploaderName = l.importUploaderName?.trim() || existing.importUploaderName
      }
    }
    return [...map.entries()]
      .map(([importBatchId, g]) => ({
        importBatchId,
        importUploaderName: g.importUploaderName,
        importedAt: g.importedAt,
        leads: g.leads,
      }))
      .sort((a, b) => (Date.parse(b.importedAt) || 0) - (Date.parse(a.importedAt) || 0))
  }, [sectionLeads])

  const tableLeads = useMemo(() => sectionLeads.filter((l) => !l.importBatchId), [sectionLeads])

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

  const allSectionCount = leads.length - localCount

  const requestDeleteLead = useCallback((id: string) => {
    setDeleteImportBatch(null)
    setDeleteId(id)
  }, [])

  const toggleFavorite = useCallback(
    async (lead: CrmLeadRow) => {
      const next = !lead.isFavorite
      try {
        await patchLeadFavorite(lead.id, next)
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, isFavorite: next } : l)),
        )
        if (detail?.id === lead.id) {
          setDetail((d) => (d ? { ...d, isFavorite: next } : d))
        }
        toast({
          type: "success",
          title: next ? "Added to favorites" : "Removed from favorites",
          message: lead.name,
        })
      } catch (err) {
        toast({
          type: "error",
          title: "Could not update favorite",
          message: err instanceof Error ? err.message : undefined,
        })
      }
    },
    [detail?.id, toast],
  )

  function openAddLead(asFavorite = false) {
    setAddLeadAsFavorite(asFavorite)
    setShowAddLead(true)
  }

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
    if (status === lead.status || (status === "not_closed" && lead.status === "on_hold")) return
    try {
      const updated = await patchLeadStatus(lead.id, status, {
        updatedBy: currentUser,
        updatedById: currentUserId ?? null,
      })
      const patch = {
        status,
        ...(updated.contactCount != null && { contactCount: updated.contactCount }),
        ...(updated.lastContactedAt != null && { lastContactedAt: updated.lastContactedAt }),
      }
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...patch } : l)))
      if (detail?.id === lead.id) setDetail((d) => (d ? { ...d, ...patch } : d))
      void refreshStats()
    } catch {
      toast({ type: "error", title: "Could not update status" })
    }
  }

  async function onAssignLead(lead: CrmLeadRow, user: ErpUser | null) {
    try {
      const updated = await patchLeadAssignment(lead.id, {
        assignedToUserId: user?.id ?? null,
        assignedToName: user?.name ?? "",
      })
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? { ...l, assignedToUserId: updated.assignedToUserId, assignedToName: updated.assignedToName }
            : l,
        ),
      )
      if (detail?.id === lead.id) {
        setDetail((d) =>
          d
            ? {
                ...d,
                assignedToUserId: updated.assignedToUserId,
                assignedToName: updated.assignedToName,
              }
            : d,
        )
      }
      toast({
        type: "success",
        title: user ? "Lead linked" : "Lead unlinked",
        message: user ? `${lead.name} → ${user.name}` : undefined,
      })
      setLinkForLead(null)
    } catch (err) {
      toast({
        type: "error",
        title: "Could not update assignment",
        message: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4 rounded-[18px] bg-[#f5f5f7] dark:bg-transparent p-3 sm:p-4 -m-3 sm:-m-4">
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="h-9 w-full sm:flex-1 sm:min-w-0 px-3 rounded-full border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] text-[13px] tracking-tight shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
          />
          <div className="flex items-center gap-2 shrink-0 justify-between sm:justify-end">
            <button
              ref={leadFilterBtnRef}
              type="button"
              onClick={() => setShowLeadFiltersPopover((v) => !v)}
              className={`relative h-9 w-9 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                showLeadFiltersPopover
                  ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                  : "text-[#86868b] hover:bg-black/[0.05] dark:hover:bg-white/10 hover:text-[#1d1d1f]"
              }`}
              aria-label="Filter leads"
              aria-expanded={showLeadFiltersPopover}
              title="Filter leads"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
              {(hasLeadFiltersActive || activeSection !== "all") && !showLeadFiltersPopover && (
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#007aff]" />
              )}
            </button>
            <div className="hidden lg:flex flex-1 min-w-0 justify-end items-center overflow-hidden sm:max-w-[min(28rem,50vw)]">
              <LeadFiltersActiveChips
                statusFilter={statusFilter}
                contactFilter={contactFilter}
                contactFrom={contactFrom}
                contactTo={contactTo}
                assignedFilter={assignedFilter}
                assigneeSummary={assigneeSummary}
                showAssignedFilter={showAssignedFilter}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          {!readOnly && (
            <>
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
                className="h-8 rounded-full text-[11px] px-3.5"
                disabled={importing}
                onClick={() => setShowFacebookImportModal(true)}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                {importing ? "Importing…" : "Import Facebook"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-[11px] px-3.5 border-black/[0.08] bg-white dark:bg-[hsl(var(--card))]"
                disabled={loadingInstallersCsv || importing}
                onClick={() => loadHardcodedInstallersCsv()}
              >
                {loadingInstallersCsv ? "Syncing…" : "Sync phones"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-[11px] px-3.5 border-black/[0.08] bg-white dark:bg-[hsl(var(--card))]"
                disabled={importing}
                onClick={() => setShowCsvImportModal(true)}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                Import CSV
              </Button>
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(FACEBOOK_LEAD_ADS_SAMPLE_CSV)}`}
                download="facebook-leads-sample.csv"
                className="inline-flex items-center justify-center h-8 rounded-full px-3 text-[11px] text-[#0071e3] hover:bg-black/[0.04] dark:hover:bg-white/10"
              >
                Sample CSV
              </a>
              <Button
                size="sm"
                className="h-8 rounded-full text-[11px] px-3.5 cursor-pointer bg-[#1d1d1f] hover:bg-black text-white dark:bg-white dark:text-[#1d1d1f]"
                onClick={() => openAddLead(activeSection === "favorites")}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {activeSection === "favorites" ? "Add favorite" : "Add lead"}
              </Button>
              {activeSection === "all" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full text-[11px] px-3.5 border-amber-200/80 text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                  onClick={() => openAddLead(true)}
                >
                  <Star className="h-3.5 w-3.5 mr-1 fill-amber-400 text-amber-400" />
                  Add to favorites
                </Button>
              )}
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full text-[11px] px-3.5 border-black/[0.08] bg-white dark:bg-[hsl(var(--card))]"
            disabled={sectionLeads.length === 0}
            onClick={() => {
              downloadLeadsExcel(sectionLeads, { exportedBy: currentUser })
              toast({
                type: "success",
                title: "Download started",
                message: `${sectionLeads.length} lead(s) exported for Excel.`,
              })
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export Excel
          </Button>
        </div>
      </div>

      {showLeadFiltersPopover &&
        leadFilterPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={leadFiltersRef}
              className="fixed z-[95] w-[min(25rem,calc(100vw-1.5rem))] max-h-[min(72vh,36rem)] overflow-y-auto scrollbar-none overscroll-contain rounded-[18px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white/92 dark:bg-[hsl(var(--card))]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-3 space-y-2.5"
            style={{ top: leadFilterPos.top, left: leadFilterPos.left }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                Filters & stats
              </p>
              <div className="flex items-center gap-2">
                {hasLeadFiltersActive && (
                  <button
                    type="button"
                    onClick={() => clearLeadFilters()}
                    className="text-[11px] font-semibold text-[#0071e3] cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowLeadFiltersPopover(false)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] cursor-pointer"
                  aria-label="Close filters"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>
            </div>
            <LeadFiltersPopoverContent
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              allSectionCount={allSectionCount}
              favoriteCount={favoriteCount}
              localCount={localCount}
              statsDate={statsDate}
              setStatsDate={setStatsDate}
              myTodayCount={myTodayCount}
              stats={stats}
              showOutreachByMember={isErpAdmin(userRole) && stats.byMember.length > 0}
              statusFilter={statusFilter}
              contactFilter={contactFilter}
              contactFrom={contactFrom}
              contactTo={contactTo}
              assignedFilter={assignedFilter}
              assigneeSummary={assigneeSummary}
              showAssignedFilter={showAssignedFilter}
              totalCount={sectionTotalCount}
              filteredCount={sectionLeads.length}
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
              onAssignedFilter={setAssignedFilter}
            />
          </div>,
          document.body,
        )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
        </div>
      ) : sectionLeads.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center text-sm text-[hsl(var(--muted-foreground))]">
          {activeSection === "favorites" ? (
            <>
              <Star className="h-12 w-12 text-amber-300 mb-3" />
              <p className="font-medium text-amber-700 dark:text-amber-400">No favorite leads yet</p>
              <p className="text-xs mt-1 max-w-xs">
                Star any lead from All leads or Local data, or add a new favorite lead directly.
              </p>
              {!readOnly && (
                <Button
                  size="sm"
                  className="mt-4 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white border-0"
                  onClick={() => openAddLead(true)}
                >
                  <Star className="h-3.5 w-3.5 mr-1 fill-current" />
                  Add favorite lead
                </Button>
              )}
            </>
          ) : activeSection === "local" ? (
            <>
              <MapPin className="h-12 w-12 text-teal-300 mb-3" />
              <p className="font-medium text-teal-700 dark:text-teal-400">No local industrial data yet</p>
              <p className="text-xs mt-1 max-w-xs">
                Import Rawalpindi / Islamabad company lists to populate this tab.
              </p>
            </>
          ) : (
            <>
              <MessageSquare className="h-10 w-10 opacity-30 mb-2" />
              {leads.length === 0
                ? "No leads yet. Import a CSV or add a lead manually."
                : isLeadFiltersActive(statusFilter, contactFilter, contactFrom, contactTo, assignedFilter) || search.trim()
                  ? "No leads match your filters."
                  : "No leads match your search."}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {importBatchGroups.length > 0 && activeSection === "all" && (
            <div className="space-y-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))] px-0.5">
                CSV imports
              </p>
              <div className="space-y-2.5">
                {importBatchGroups.map((group) => {
                  const open = openBatchIds.has(group.importBatchId)
                  const bf = getBatchFilters(group.importBatchId)
                  const batchLeads = filterBatchLeads(group.leads, bf)
                  const batchFiltersActive = isBatchFiltersActive(bf)
                  const when = new Date(group.importedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                  return (
                    <div
                      key={group.importBatchId}
                      className="rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] overflow-hidden bg-white dark:bg-[hsl(var(--card))] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-stretch">
                        <button
                          type="button"
                          onClick={() => toggleBatch(group.importBatchId)}
                          className="flex-1 min-w-0 flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[#86868b]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-[#86868b]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-[13px] tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] block truncate">
                              {group.importUploaderName}
                            </span>
                            <span className="text-[11px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
                              {when}
                            </span>
                          </div>
                          <span className="shrink-0 text-[11px] font-medium rounded-full bg-[#f2f2f7] dark:bg-[hsl(var(--muted))]/40 px-2.5 py-0.5 tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                            {batchFiltersActive ? `${batchLeads.length} of ` : ""}
                            {group.leads.length} lead{group.leads.length === 1 ? "" : "s"}
                          </span>
                        </button>
                        {!readOnly && (
                        <div className="flex border-t sm:border-t-0 sm:border-l border-black/[0.06] dark:border-[hsl(var(--border))]">
                          <button
                            type="button"
                            className="shrink-0 px-3 py-2.5 sm:py-3 flex items-center justify-center text-[#86868b] hover:bg-black/[0.04] hover:text-[#1d1d1f] border-r border-black/[0.06] dark:border-[hsl(var(--border))] cursor-pointer min-h-[44px] min-w-[44px]"
                            title="Rename this import"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRenameImportBatch({
                                importBatchId: group.importBatchId,
                                importUploaderName: group.importUploaderName,
                              })
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="shrink-0 px-3 py-2.5 sm:py-3 flex items-center justify-center text-[#86868b] hover:bg-black/[0.04] hover:text-[#1d1d1f] border-r border-black/[0.06] dark:border-[hsl(var(--border))] cursor-pointer min-h-[44px] min-w-[44px]"
                            title="Merge into another import"
                            disabled={importBatchGroups.length < 2}
                            onClick={(e) => {
                              e.stopPropagation()
                              setMergeImportBatch({
                                importBatchId: group.importBatchId,
                                importUploaderName: group.importUploaderName,
                                count: group.leads.length,
                              })
                            }}
                          >
                            <GitMerge className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="flex-1 sm:flex-initial shrink-0 px-3.5 py-2.5 sm:py-3 flex items-center justify-center text-[#0071e3] hover:bg-[#0071e3]/08 cursor-pointer text-[11px] font-semibold disabled:opacity-50 min-h-[44px]"
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
                            className="shrink-0 px-3 py-2.5 sm:py-3 flex items-center justify-center text-red-500 hover:bg-red-500/10 border-l border-black/[0.06] dark:border-[hsl(var(--border))] cursor-pointer min-h-[44px] min-w-[44px]"
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
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        )}
                      </div>
                      {open && (
                        <div className="border-t border-black/[0.06] dark:border-[hsl(var(--border))]">
                          <ImportBatchFiltersPanel
                            filters={bf}
                            totalCount={group.leads.length}
                            filteredCount={batchLeads.length}
                            onStatusFilter={(v) => updateBatchFilters(group.importBatchId, { statusFilter: v })}
                            onContactFilter={(v) => updateBatchFilters(group.importBatchId, { contactFilter: v })}
                            onContactFrom={(v) => updateBatchFilters(group.importBatchId, { contactFrom: v })}
                            onContactTo={(v) => updateBatchFilters(group.importBatchId, { contactTo: v })}
                            onClear={() => clearBatchFilters(group.importBatchId)}
                          />
                          {batchLeads.length === 0 ? (
                            <p className="px-4 py-8 text-center text-[13px] text-[#86868b]">
                              No leads in this import match the filters.
                            </p>
                          ) : (
                          <LeadsListView
                            leads={batchLeads}
                            onOpenDetail={openLeadDetail}
                            onStatusChange={onStatusChange}
                            onLog={setLogForLead}
                            onFollowUp={setFollowUpForLead}
                            onLinkUser={setLinkForLead}
                            onDelete={requestDeleteLead}
                            onToggleFavorite={toggleFavorite}
                            canAssign={canAssignLeads}
                            readOnly={readOnly}
                            highlightFavorite={false}
                          />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(activeSection === "favorites" || activeSection === "local"
            ? sectionLeads.length > 0
            : (importBatchGroups.length === 0 ? sectionLeads : tableLeads).length > 0) && (
            <div>
              {importBatchGroups.length > 0 && activeSection === "all" && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] dark:text-[hsl(var(--muted-foreground))] mb-2 px-0.5">
                  Other leads
                </p>
              )}
              {activeSection === "favorites" && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600/90 mb-2 px-0.5">
                  Favorites
                </p>
              )}
              {activeSection === "local" && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-600/90 mb-2 px-0.5">
                  Local industrial
                </p>
              )}
              <div
                className={`rounded-[16px] border overflow-hidden bg-white dark:bg-[hsl(var(--card))] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
                  activeSection === "favorites"
                    ? "border-amber-200/50"
                    : activeSection === "local"
                      ? "border-teal-200/50"
                      : "border-black/[0.06] dark:border-[hsl(var(--border))]"
                }`}
              >
                <LeadsListView
                  leads={
                    activeSection === "favorites" || activeSection === "local"
                      ? sectionLeads
                      : importBatchGroups.length === 0
                        ? sectionLeads
                        : tableLeads
                  }
                  onOpenDetail={openLeadDetail}
                  onStatusChange={onStatusChange}
                  onLog={setLogForLead}
                  onFollowUp={setFollowUpForLead}
                  onLinkUser={setLinkForLead}
                  onDelete={requestDeleteLead}
                  onToggleFavorite={toggleFavorite}
                  canAssign={canAssignLeads}
                  readOnly={readOnly}
                  highlightFavorite={activeSection === "favorites"}
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
          asFavorite={addLeadAsFavorite}
          onClose={() => {
            setShowAddLead(false)
            setAddLeadAsFavorite(false)
          }}
          onCreated={async () => {
            await refresh()
            setShowAddLead(false)
            setAddLeadAsFavorite(false)
            if (addLeadAsFavorite) setActiveSection("favorites")
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
                      followUpAt: savedContact.followUpAt,
                      followUpNotes: savedContact.followUpNotes,
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

      {linkForLead && (
        <LinkLeadUserModal
          lead={linkForLead}
          users={erpUsers}
          canAssign={canAssignLeads}
          onClose={() => setLinkForLead(null)}
          onAssign={(user) => onAssignLead(linkForLead, user)}
        />
      )}

      {followUpForLead && (
        <FollowUpModal
          lead={followUpForLead}
          onClose={() => setFollowUpForLead(null)}
          onSaved={async (followUpAt, followUpNotes) => {
            const leadId = followUpForLead.id
            try {
              const updated = await patchLeadFollowUp(leadId, { followUpAt, followUpNotes })
              setLeads((prev) =>
                prev.map((l) =>
                  l.id === leadId
                    ? { ...l, followUpAt: updated.followUpAt, followUpNotes: updated.followUpNotes }
                    : l,
                ),
              )
              if (detailId === leadId) {
                setDetail((d) =>
                  d ? { ...d, followUpAt: updated.followUpAt, followUpNotes: updated.followUpNotes } : d,
                )
              }
              toast({ type: "success", title: "Follow-up saved" })
              setFollowUpForLead(null)
            } catch (err) {
              toast({
                type: "error",
                title: "Could not save follow-up",
                message: err instanceof Error ? err.message : undefined,
              })
            }
          }}
        />
      )}

      {detailId && (
        <LeadDetailDrawer
          loading={detailLoading}
          lead={detail}
          onClose={closeLeadDetail}
          onRefreshHistory={() => detailId && reloadLeadDetail(detailId)}
          onToggleFavorite={() => detail && toggleFavorite(detail)}
          onLink={() => {
            if (detail) setLinkForLead(detail)
          }}
          canAssign={canAssignLeads}
          readOnly={readOnly}
          onLog={() => {
            if (detail) setLogForLead(detail)
          }}
          onFollowUp={() => {
            if (detail) setFollowUpForLead(detail)
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

      {renameImportBatch && (
        <RenameImportBatchModal
          initialName={renameImportBatch.importUploaderName}
          onClose={() => setRenameImportBatch(null)}
          onSave={async (name) => {
            const { importBatchId } = renameImportBatch
            try {
              await renameLeadImportBatch(importBatchId, name)
              setLeads((prev) =>
                prev.map((l) =>
                  l.importBatchId === importBatchId ? { ...l, importUploaderName: name } : l,
                ),
              )
              setDetail((prev) =>
                prev?.importBatchId === importBatchId ? { ...prev, importUploaderName: name } : prev,
              )
              toast({ type: "success", title: "Import renamed" })
              setRenameImportBatch(null)
            } catch (err) {
              toast({
                type: "error",
                title: "Rename failed",
                message: err instanceof Error ? err.message : undefined,
              })
            }
          }}
        />
      )}

      {mergeImportBatch && (
        <MergeImportBatchModal
          source={mergeImportBatch}
          targets={importBatchGroups.filter((g) => g.importBatchId !== mergeImportBatch.importBatchId)}
          onClose={() => setMergeImportBatch(null)}
          onMerge={async (targetImportBatchId) => {
            const { importBatchId, importUploaderName, count } = mergeImportBatch
            const target = importBatchGroups.find((g) => g.importBatchId === targetImportBatchId)
            if (!target) return
            try {
              const { merged, importUploaderName: targetName } = await mergeLeadImportBatches(
                importBatchId,
                targetImportBatchId,
              )
              setLeads((prev) =>
                prev.map((l) =>
                  l.importBatchId === importBatchId
                    ? {
                        ...l,
                        importBatchId: targetImportBatchId,
                        importUploaderName: targetName ?? target.importUploaderName,
                      }
                    : l,
                ),
              )
              setOpenBatchIds((prev) => {
                const next = new Set(prev)
                next.delete(importBatchId)
                next.add(targetImportBatchId)
                return next
              })
              if (detail?.importBatchId === importBatchId) {
                setDetail((prev) =>
                  prev
                    ? {
                        ...prev,
                        importBatchId: targetImportBatchId,
                        importUploaderName: targetName ?? target.importUploaderName,
                      }
                    : prev,
                )
              }
              toast({
                type: "success",
                title: "Imports merged",
                message: `Moved ${merged} lead(s) from “${importUploaderName}” into “${target.importUploaderName}”.`,
              })
              setMergeImportBatch(null)
            } catch (err) {
              toast({
                type: "error",
                title: "Merge failed",
                message: err instanceof Error ? err.message : undefined,
              })
            }
          }}
        />
      )}
    </div>
  )
}

function RenameImportBatchModal({
  initialName,
  onClose,
  onSave,
}: {
  initialName: string
  onClose: () => void
  onSave: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[hsl(var(--background))] rounded-lg border shadow-lg max-w-md w-full p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Rename import</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          This label is shown on the import list and on each lead from this CSV.
        </p>
        <input
          className="w-full h-9 rounded border px-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || saving}
            onClick={async () => {
              setSaving(true)
              try {
                await onSave(name.trim())
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MergeImportBatchModal({
  source,
  targets,
  onClose,
  onMerge,
}: {
  source: { importBatchId: string; importUploaderName: string; count: number }
  targets: { importBatchId: string; importUploaderName: string; leads: CrmLeadRow[] }[]
  onClose: () => void
  onMerge: (targetImportBatchId: string) => Promise<void>
}) {
  const [targetId, setTargetId] = useState(targets[0]?.importBatchId ?? "")
  const [merging, setMerging] = useState(false)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[hsl(var(--background))] rounded-lg border shadow-lg max-w-md w-full p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Merge import</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Move all <strong>{source.count}</strong> lead(s) from{" "}
          <strong>{source.importUploaderName}</strong> into another import. Outreach logs are kept. The empty source
          import disappears from the list.
        </p>
        <div>
          <label className="text-xs font-medium">Merge into</label>
          <select
            className="mt-1 w-full h-9 rounded border px-2 text-sm bg-[hsl(var(--background))]"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            {targets.map((t) => (
              <option key={t.importBatchId} value={t.importBatchId}>
                {t.importUploaderName} ({t.leads.length} leads)
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!targetId || merging}
            onClick={async () => {
              setMerging(true)
              try {
                await onMerge(targetId)
              } finally {
                setMerging(false)
              }
            }}
          >
            {merging ? "Merging…" : "Merge"}
          </Button>
        </div>
      </div>
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
          Upload CSV with columns: FULL_NAME, PHONE, COMPANY_NAME, City, Address.
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono break-all">
          {LEAD_IMPORT_HEADERS.join(", ")}
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
  asFavorite = false,
  onClose,
  onCreated,
}: {
  currentUser: string
  currentUserId?: string | null
  asFavorite?: boolean
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [saveAsFavorite, setSaveAsFavorite] = useState(asFavorite)
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
          isFavorite: saveAsFavorite,
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
        className={`rounded-lg border shadow-lg max-w-md w-full p-4 space-y-3 ${
          asFavorite || saveAsFavorite
            ? "bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/20 border-amber-300/60"
            : "bg-[hsl(var(--background))]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            {saveAsFavorite && <Star className="h-4 w-4 text-amber-500 fill-amber-400" />}
            {saveAsFavorite ? "Add favorite lead" : "Add lead"}
          </h3>
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
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={saveAsFavorite}
            onChange={(e) => setSaveAsFavorite(e.target.checked)}
            className="rounded border-amber-300 text-amber-500 focus:ring-amber-400"
          />
          <Star className={`h-3.5 w-3.5 ${saveAsFavorite ? "text-amber-500 fill-amber-400" : "text-[hsl(var(--muted-foreground))]"}`} />
          Save as favorite
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className={`cursor-pointer ${saveAsFavorite ? "bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white border-0" : ""}`}
            disabled={saving || !name.trim()}
            onClick={submit}
          >
            {saving ? "Saving…" : saveAsFavorite ? "Save favorite" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function FollowUpModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: CrmLeadRow
  onClose: () => void
  onSaved: (followUpAt: string | null, followUpNotes: string) => Promise<void>
}) {
  const [followUpAt, setFollowUpAt] = useState(() =>
    lead.followUpAt ? toDatetimeLocalValue(new Date(lead.followUpAt)) : "",
  )
  const [followUpNotes, setFollowUpNotes] = useState(lead.followUpNotes ?? "")
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[hsl(var(--background))] rounded-lg border shadow-lg max-w-md w-full p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" />
              Set follow-up
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{lead.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium">When</label>
          <input
            type="datetime-local"
            className="mt-1 w-full h-9 rounded border px-2 text-sm"
            value={followUpAt}
            onChange={(e) => setFollowUpAt(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium">Follow-up note</label>
          <textarea
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm min-h-[72px]"
            placeholder="What to discuss or do on the next call…"
            value={followUpNotes}
            onChange={(e) => setFollowUpNotes(e.target.value)}
          />
        </div>
        <div className="flex justify-between items-center gap-2 pt-1">
          <button
            type="button"
            className="text-xs text-[hsl(var(--muted-foreground))] hover:underline cursor-pointer"
            disabled={!followUpAt && !followUpNotes.trim()}
            onClick={async () => {
              setSaving(true)
              try {
                await onSaved(null, "")
              } finally {
                setSaving(false)
              }
            }}
          >
            Clear follow-up
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="cursor-pointer"
              disabled={saving || !followUpAt.trim()}
              onClick={async () => {
                setSaving(true)
                try {
                  await onSaved(new Date(followUpAt).toISOString(), followUpNotes.trim())
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
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
  onSaved: (contact: CrmLeadContactRow & { followUpAt: string | null; followUpNotes: string }) => Promise<void>
}) {
  const { toast } = useToast()
  const [when, setWhen] = useState(() => toDatetimeLocalValue(new Date()))
  const [followUpAt, setFollowUpAt] = useState(() =>
    lead.followUpAt ? toDatetimeLocalValue(new Date(lead.followUpAt)) : "",
  )
  const [followUpNotes, setFollowUpNotes] = useState(lead.followUpNotes ?? "")
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
        followUpAt: followUpAt.trim() ? new Date(followUpAt).toISOString() : null,
        followUpNotes,
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
        <div className="rounded border border-[hsl(var(--border))] p-3 space-y-2 bg-[hsl(var(--muted))]/20">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Next follow-up
          </p>
          <div>
            <label className="text-xs font-medium">When</label>
            <input
              type="datetime-local"
              className="mt-1 w-full h-9 rounded border px-2 text-sm bg-[hsl(var(--background))]"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Follow-up note</label>
            <textarea
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm min-h-[56px] bg-[hsl(var(--background))]"
              placeholder="What to discuss or do on the next call…"
              value={followUpNotes}
              onChange={(e) => setFollowUpNotes(e.target.value)}
            />
          </div>
          {followUpAt && (
            <button
              type="button"
              className="text-[10px] text-[hsl(var(--muted-foreground))] hover:underline cursor-pointer"
              onClick={() => {
                setFollowUpAt("")
                setFollowUpNotes("")
              }}
            >
              Clear follow-up
            </button>
          )}
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

function LinkLeadUserModal({
  lead,
  users,
  canAssign,
  onClose,
  onAssign,
}: {
  lead: CrmLeadRow
  users: ErpUser[]
  canAssign: boolean
  onClose: () => void
  onAssign: (user: ErpUser | null) => void | Promise<void>
}) {
  const [selectedId, setSelectedId] = useState(lead.assignedToUserId ?? "")
  const [saving, setSaving] = useState(false)

  const linkableUsers = users
    .filter((u) => u.role !== "superadmin")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[hsl(var(--background))] rounded-lg border shadow-lg max-w-lg w-full p-4 space-y-3 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center gap-2">
          <div>
            <h3 className="text-sm font-semibold">Link ERP user</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {lead.name} — link an ERP user to track ownership and filter leads by assignee
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {lead.assignedToUserId && (
          <div className="rounded border bg-[hsl(var(--muted))]/20 px-3 py-2 text-xs">
            <p className="font-medium">{lead.assignedToName || "Assigned user"}</p>
            <p className="font-mono text-[10px] text-[hsl(var(--muted-foreground))] mt-1 break-all">
              User ID: {lead.assignedToUserId}
            </p>
          </div>
        )}

        {canAssign ? (
          <>
            <div>
              <label className="text-xs font-medium">Assign to</label>
              <select
                className="mt-1 w-full h-9 rounded border px-2 text-sm bg-[hsl(var(--background))]"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {linkableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.email} ({ROLE_LABELS[u.role] ?? u.role})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              All team accounts from User Accounts appear here. Pick who owns this lead, then use &quot;Filter by assigned member&quot; to view their linked leads.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              {lead.assignedToUserId && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await onAssign(null)
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  Unlink
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={async () => {
                  setSaving(true)
                  try {
                    const user = selectedId ? linkableUsers.find((u) => u.id === selectedId) ?? null : null
                    await onAssign(user)
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {saving ? "Saving…" : "Save link"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Only admins can change lead assignments. Contact an admin if this lead should be linked to someone else.
          </p>
        )}
      </div>
    </div>
  )
}

function LeadDetailDrawer({
  loading,
  lead,
  onClose,
  onLog,
  onFollowUp,
  onLink,
  onToggleFavorite,
  canAssign,
  readOnly = false,
  onRefreshHistory,
}: {
  loading: boolean
  lead: (CrmLeadRow & { contacts: CrmLeadContactRow[] }) | null
  onClose: () => void
  onLog: () => void
  onFollowUp: () => void
  onLink: () => void
  onToggleFavorite: () => void
  canAssign: boolean
  readOnly?: boolean
  onRefreshHistory: () => void
}) {
  const fu = lead ? followUpDisplay(lead) : null
  const sheet = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xl p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] rounded-t-[20px] sm:rounded-[20px] border border-black/[0.06] dark:border-[hsl(var(--border))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] flex flex-col overflow-hidden ${
          lead?.isFavorite
            ? "bg-gradient-to-b from-amber-50/95 to-white dark:from-amber-950/40 dark:to-[hsl(var(--card))]"
            : "bg-white/95 dark:bg-[hsl(var(--card))]/95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 pt-3.5 pb-3 border-b border-black/[0.06] dark:border-[hsl(var(--border))] shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#86868b]">Lead</p>
            <h3 className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate flex items-center gap-1.5">
              {lead?.isFavorite && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />}
              {lead?.name || "Loading…"}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!readOnly && lead && (
              <FavoriteStarButton isFavorite={lead.isFavorite} onToggle={onToggleFavorite} size="md" />
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] hover:bg-black/[0.1] cursor-pointer"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-4 sm:px-5 py-4 space-y-4">
          {!lead ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 rounded-full border-2 border-[#0071e3] border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {lead.company && (
                  <p className="text-[13px] text-[#86868b]">{lead.company}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                  {lead.city?.trim() && (
                    <p>
                      <span className="text-[#86868b]">City · </span>
                      {lead.city}
                    </p>
                  )}
                  {lead.address?.trim() && (
                    <p className="sm:col-span-2">
                      <span className="text-[#86868b]">Address · </span>
                      {lead.address}
                    </p>
                  )}
                  {lead.email && (
                    <p className="sm:col-span-2 break-all">
                      <span className="text-[#86868b]">Email · </span>
                      {lead.email}
                    </p>
                  )}
                </div>
                {lead.phone?.trim() && (
                  <LeadPhoneLinks phone={lead.phone} leadName={lead.name} layout="card" />
                )}
                {lead.notes && (
                  <div className="rounded-[12px] bg-[#f5f5f7] dark:bg-[hsl(var(--muted))]/25 px-3 py-2.5 text-[12px] whitespace-pre-line text-[#6e6e73]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] mb-1">
                      CSV fields
                    </p>
                    {lead.notes}
                  </div>
                )}
                {lead.importUploaderName && (
                  <p className="text-[11px] text-[#86868b]">
                    Import ·{" "}
                    <span className="font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                      {lead.importUploaderName}
                    </span>
                    {" · "}
                    {new Date(lead.importedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
                <div className="rounded-[12px] border border-black/[0.06] dark:border-[hsl(var(--border))] px-3 py-2.5 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Assigned
                  </p>
                  {lead.assignedToUserId ? (
                    <p className="text-[13px] font-medium">{lead.assignedToName || "Assigned user"}</p>
                  ) : (
                    <p className="text-[12px] text-[#86868b]">Unassigned</p>
                  )}
                </div>
                <div className="rounded-[12px] border border-black/[0.06] dark:border-[hsl(var(--border))] px-3 py-2.5 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" /> Follow up
                  </p>
                  {fu ? (
                    <>
                      <p className={`text-[13px] ${fu.overdue ? "text-red-600 font-semibold" : "font-medium"}`}>
                        {fu.text}
                        {fu.overdue ? " · overdue" : ""}
                      </p>
                      {fu.notes && <p className="text-[12px] text-[#86868b]">{fu.notes}</p>}
                    </>
                  ) : (
                    <p className="text-[12px] text-[#86868b]">None scheduled</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">
                    Outreach ({lead.contactCount})
                    {loading ? " · updating…" : ""}
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0071e3] cursor-pointer"
                    onClick={onRefreshHistory}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </button>
                </div>
                {lead.contacts.length === 0 ? (
                  <p className="text-[12px] text-[#86868b]">
                    {loading ? "Loading history…" : "No logs yet."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {lead.contacts.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-[12px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-[#fafafa] dark:bg-[hsl(var(--muted))]/15 p-3 text-[12px] space-y-2"
                      >
                        <div className="flex justify-between text-[#86868b]">
                          <span>{c.contactedBy}</span>
                          <span>{new Date(c.contactedAt).toLocaleString()}</span>
                        </div>
                        {c.screenshotUrls.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {c.screenshotUrls.map((url) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                                <img src={url} alt="" className="h-14 w-14 object-cover rounded-[8px] border border-black/[0.06]" />
                              </a>
                            ))}
                          </div>
                        )}
                        {c.leadResponse && (
                          <p>
                            <span className="font-medium">Response · </span>
                            {c.leadResponse}
                          </p>
                        )}
                        {c.notes && <p className="text-[#86868b]">Internal · {c.notes}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
        {!readOnly && lead && (
          <div className="shrink-0 flex flex-wrap gap-2 px-4 sm:px-5 py-3 border-t border-black/[0.06] dark:border-[hsl(var(--border))] bg-[#f5f5f7]/90 dark:bg-[hsl(var(--background))]/90 backdrop-blur-xl pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button size="sm" className="h-9 rounded-full text-[12px] px-4 cursor-pointer bg-[#1d1d1f] hover:bg-black text-white" onClick={onLog}>
              Log outreach
            </Button>
            <Button size="sm" variant="outline" className="h-9 rounded-full text-[12px] px-3.5 cursor-pointer" onClick={onFollowUp}>
              Follow-up
            </Button>
            <Button size="sm" variant="outline" className="h-9 rounded-full text-[12px] px-3.5 cursor-pointer" onClick={onLink}>
              <Link2 className="h-3.5 w-3.5 mr-1" />
              {canAssign ? "Link" : "Assignment"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== "undefined" ? createPortal(sheet, document.body) : null
}
