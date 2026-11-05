"use client"

import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

export type MetricStripItem = {
  label: string
  value: string | number
  href?: string
  /** Currency fields — masked when showMoney is false */
  isMoney?: boolean
}

export function formatRsAxis(value: number) {
  const n = Number(value)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

export function formatRsFull(value: number) {
  return `Rs. ${value.toLocaleString("en-PK")}`
}

/** Recharts Y-axis domain when series max is 0 (avoids misleading 0–4 ticks). */
export function chartAmountDomain(values: number[]): [number, number] {
  const max = values.reduce((m, v) => Math.max(m, Number(v) || 0), 0)
  if (max <= 0) return [0, 1]
  return [0, Math.ceil(max * 1.15)]
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-auto bg-[hsl(var(--background))]">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-4 sm:py-4 space-y-3.5">{children}</div>
    </div>
  )
}

export function DashboardBlock({
  children,
  action,
  className,
}: {
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-2.5", className)}>
      {action && <div className="flex justify-end">{action}</div>}
      {children}
    </section>
  )
}

export function RangeToggle({
  value,
  onChange,
  options = [7, 14, 30],
}: {
  value: 7 | 14 | 30
  onChange: (v: 7 | 14 | 30) => void
  options?: readonly (7 | 14 | 30)[]
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-0.5 shadow-sm">
      {options.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(days)}
          className={cn(
            "px-2.5 py-1 text-[10px] font-bold rounded-full transition-all cursor-pointer tabular-nums",
            value === days
              ? "bg-[#0f766e] text-white shadow-sm"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
          )}
        >
          {days}D
        </button>
      ))}
    </div>
  )
}

export function DashboardMetricsStrip({
  items,
  loading,
  showMoney,
  onToggleMoney,
}: {
  items: MetricStripItem[]
  loading: boolean
  showMoney: boolean
  onToggleMoney: () => void
}) {
  const hasMoney = items.some((i) => i.isMoney)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
          Snapshot
        </p>
        {hasMoney && (
          <button
            type="button"
            onClick={onToggleMoney}
            className="inline-flex h-6 items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2 text-[10px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer"
            title={showMoney ? "Hide amounts" : "Show amounts"}
            aria-label={showMoney ? "Hide amounts" : "Show amounts"}
          >
            {showMoney ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {showMoney ? "Hide" : "Show"}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2">
        {items.map((item) => {
          const displayValue =
            loading
              ? "—"
              : item.isMoney && !showMoney
                ? "••••"
                : item.value

          const card = (
            <div
              className={cn(
                "group relative h-full rounded-xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] px-3 py-2.5 transition-all",
                item.href && "hover:border-[#1a9f9a]/45 hover:shadow-[0_8px_20px_-16px_rgba(15,118,110,0.55)]",
              )}
            >
              <div className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full bg-[#1a9f9a]/70 opacity-70 group-hover:opacity-100" />
              <p className="pl-2 text-[9px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] truncate">
                {item.label}
              </p>
              <p
                className={cn(
                  "pl-2 mt-1 text-[15px] font-bold tabular-nums tracking-tight text-[hsl(var(--foreground))] leading-none truncate",
                  item.isMoney && "text-[13px] sm:text-[14px]",
                )}
              >
                {displayValue}
              </p>
            </div>
          )

          return item.href ? (
            <Link key={item.label} href={item.href} className="min-w-0">
              {card}
            </Link>
          ) : (
            <div key={item.label} className="min-w-0">
              {card}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ChartCard({
  title,
  subtitle,
  footer,
  action,
  children,
  tall,
}: {
  title: string
  subtitle?: string
  footer?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  tall?: boolean
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] overflow-hidden flex flex-col min-w-0 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.45)]">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[hsl(var(--foreground))] truncate">{title}</p>
          {subtitle && (
            <p className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className={cn("px-1.5 pb-1", tall ? "h-[168px]" : "h-[148px]")}>{children}</div>
      {footer && (
        <div className="mx-3 mb-2.5 rounded-lg bg-[hsl(var(--muted))]/25 px-2.5 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
          {footer}
        </div>
      )}
    </div>
  )
}

export function ChartLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="h-5 w-5 rounded-full border-2 border-[#1a9f9a]/25 border-t-[#1a9f9a] animate-spin" />
    </div>
  )
}

export const CHART_TOOLTIP_STYLE = {
  borderRadius: "10px",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  fontSize: "10px",
  padding: "8px 10px",
  boxShadow: "0 12px 28px -18px rgba(15,23,42,0.45)",
}

export type DashboardMainTab = "overview" | "approvals" | "backup"

export function DashboardMainTabs({
  active,
  onChange,
  approvalsPending,
}: {
  active: DashboardMainTab
  onChange: (tab: DashboardMainTab) => void
  approvalsPending: number
}) {
  const tabs: { id: DashboardMainTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "approvals", label: "Approvals" },
    { id: "backup", label: "Backup" },
  ]

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 shadow-sm">
      {tabs.map((tab) => {
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-3.5 py-1.5 text-[11px] font-semibold rounded-full transition-all cursor-pointer inline-flex items-center gap-1.5",
              selected
                ? "bg-[#0f766e] text-white shadow-sm"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/35",
            )}
          >
            {tab.label}
            {tab.id === "approvals" && approvalsPending > 0 && (
              <span
                className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums",
                  selected ? "bg-white/20 text-white" : "bg-[#1a9f9a] text-white",
                )}
              >
                {approvalsPending > 99 ? "99+" : approvalsPending}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ApprovalTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: string; label: string; count?: number }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors cursor-pointer inline-flex items-center gap-1",
              selected
                ? "border-[#1a9f9a]/40 bg-[#1a9f9a]/10 text-[#0f766e]"
                : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/25",
            )}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="tabular-nums text-[9px] font-bold text-[#1a9f9a]">{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ApprovalsSummaryChips({
  items,
}: {
  items: { label: string; count: number }[]
}) {
  const visible = items.filter((i) => i.count > 0)
  if (visible.length === 0) {
    return (
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">All caught up — nothing pending.</p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))]/80 bg-[hsl(var(--muted))]/15 px-2.5 py-1 text-[10px] text-[hsl(var(--muted-foreground))]"
        >
          <span className="font-bold tabular-nums text-[#0d6b67]">{item.count}</span>
          {item.label}
        </span>
      ))}
    </div>
  )
}
