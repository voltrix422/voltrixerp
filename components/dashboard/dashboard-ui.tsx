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
    <div className="flex-1 overflow-auto bg-[#f5f5f7] dark:bg-[hsl(var(--background))]">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-6 space-y-5">{children}</div>
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
    <section className={cn("space-y-3", className)}>
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
    <div className="inline-flex items-center rounded-[9px] bg-black/[0.06] dark:bg-white/10 p-[2px]">
      {options.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(days)}
          className={cn(
            "px-3 py-1 text-[11px] font-medium rounded-[7px] transition-colors cursor-pointer tabular-nums",
            value === days
              ? "bg-white dark:bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
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
    <div className="rounded-[18px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.04] dark:border-[hsl(var(--border))] overflow-hidden">
      <div className="flex items-center justify-end px-3 pt-2.5">
        {hasMoney && (
          <button
            type="button"
            onClick={onToggleMoney}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={showMoney ? "Hide amounts" : "Show amounts"}
            aria-label={showMoney ? "Hide amounts" : "Show amounts"}
          >
            {showMoney ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y lg:divide-y-0 divide-black/[0.06] dark:divide-[hsl(var(--border))]">
        {items.map((item) => {
          const displayValue =
            loading
              ? "—"
              : item.isMoney && !showMoney
                ? "••••"
                : item.value

          const inner = (
            <div className="px-2.5 sm:px-3 pb-3.5 pt-0.5 min-h-[72px] flex flex-col justify-end gap-1">
              <p className="text-[11px] font-medium text-[#86868b] dark:text-[hsl(var(--muted-foreground))] truncate">
                {item.label}
              </p>
              <p
                className="text-[17px] sm:text-[18px] font-bold tracking-tight leading-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums break-words"
                title={String(displayValue)}
              >
                {displayValue}
              </p>
            </div>
          )

          return (
            <div key={item.label} className="min-w-0">
              {item.href ? (
                <Link href={item.href} className="block hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                  {inner}
                </Link>
              ) : (
                inner
              )}
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
    <div className="rounded-[18px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.04] dark:border-[hsl(var(--border))] overflow-hidden flex flex-col min-w-0">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-1">
        <div className="min-w-0">
          <p className="text-[15px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
            {title}
          </p>
          {subtitle && (
            <p className="text-[11px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
              {subtitle}
            </p>
          )}
          {footer && (
            <div className="mt-2 text-[12px] text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))]">
              {footer}
            </div>
          )}
        </div>
        {action}
      </div>
      <div className={cn("px-2 pb-3 pt-1", tall ? "h-[190px]" : "h-[170px]")}>{children}</div>
    </div>
  )
}

export function ChartLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="h-5 w-5 rounded-full border-2 border-black/10 border-t-[#1d1d1f] dark:border-white/20 dark:border-t-white animate-spin" />
    </div>
  )
}

export const CHART_TOOLTIP_STYLE = {
  borderRadius: "12px",
  border: "none",
  background: "rgba(29,29,31,0.92)",
  color: "#fff",
  fontSize: "11px",
  padding: "8px 10px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
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
    <div className="inline-flex items-center rounded-[10px] bg-black/[0.06] dark:bg-white/10 p-[3px]">
      {tabs.map((tab) => {
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-3.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-colors cursor-pointer inline-flex items-center gap-1.5",
              selected
                ? "bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shadow-sm"
                : "text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] hover:text-[#1d1d1f] dark:hover:text-[hsl(var(--foreground))]",
            )}
          >
            {tab.label}
            {tab.id === "approvals" && approvalsPending > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-semibold text-white tabular-nums">
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
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-3 py-1.5 text-[12px] font-medium rounded-full transition-colors cursor-pointer inline-flex items-center gap-1.5",
              selected
                ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                : "bg-black/[0.04] dark:bg-white/10 text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] hover:text-[#1d1d1f]",
            )}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={cn("tabular-nums text-[10px] font-semibold", selected ? "text-white/80" : "text-[#ff3b30]")}>
                {tab.count}
              </span>
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
      <p className="text-[12px] text-[#86868b]">All caught up.</p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] dark:bg-white/10 px-2.5 py-1 text-[11px] text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))]"
        >
          <span className="font-semibold tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{item.count}</span>
          {item.label}
        </span>
      ))}
    </div>
  )
}
