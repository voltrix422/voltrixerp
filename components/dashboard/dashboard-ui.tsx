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
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-5 sm:py-5 space-y-5">{children}</div>
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
    <div className="inline-flex items-center rounded-lg border border-[hsl(var(--border))] p-0.5 bg-[hsl(var(--muted))]/25">
      {options.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(days)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer",
            value === days
              ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"
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
    <div className="flex items-stretch rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-x-auto">
      <div className="flex items-center min-w-0 flex-1">
        {items.map((item, index) => {
          const displayValue =
            loading
              ? "—"
              : item.isMoney && !showMoney
                ? "••••"
                : item.value

          const inner = (
            <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap px-3 py-2">
              <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{item.label}</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]",
                  item.isMoney && "tracking-tight",
                )}
              >
                {displayValue}
              </span>
            </span>
          )

          return (
            <div key={item.label} className="flex items-center shrink-0">
              {index > 0 && <span className="w-px self-stretch my-2 bg-[hsl(var(--border))]" aria-hidden />}
              {item.href ? (
                <Link href={item.href} className="hover:bg-[hsl(var(--muted))]/25 transition-colors">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </div>
          )
        })}
      </div>
      {hasMoney && (
        <>
          <span className="w-px self-stretch my-2 bg-[hsl(var(--border))] shrink-0" aria-hidden />
          <button
            type="button"
            onClick={onToggleMoney}
            className="shrink-0 px-3 flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
            title={showMoney ? "Hide amounts" : "Show amounts"}
            aria-label={showMoney ? "Hide amounts" : "Show amounts"}
          >
            {showMoney ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </>
      )}
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
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[hsl(var(--border))]">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{title}</p>
          {subtitle && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className={cn("px-1.5 pb-1", tall ? "h-[176px]" : "h-[152px]")}>{children}</div>
      {footer && (
        <div className="px-3 py-2 border-t border-[hsl(var(--border))] text-[11px] text-[hsl(var(--muted-foreground))]">
          {footer}
        </div>
      )}
    </div>
  )
}

export function ChartLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-[hsl(var(--foreground))]/20 border-t-[hsl(var(--foreground))] animate-spin" />
    </div>
  )
}

export const CHART_TOOLTIP_STYLE = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  fontSize: "11px",
}

export type DashboardMainTab = "overview" | "approvals"

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
  ]

  return (
    <div className="inline-flex items-center rounded-lg border border-[hsl(var(--border))] p-0.5 bg-[hsl(var(--muted))]/20">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer inline-flex items-center gap-2",
            active === tab.id
              ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
          )}
        >
          {tab.label}
          {tab.id === "approvals" && approvalsPending > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1faca6] px-1.5 text-[10px] font-bold text-white tabular-nums">
              {approvalsPending > 99 ? "99+" : approvalsPending}
            </span>
          )}
        </button>
      ))}
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
    <div className="flex flex-wrap gap-1 border-b border-[hsl(var(--border))]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative px-3 py-2 text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5",
            active === tab.id
              ? "text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
          )}
        >
          {tab.label}
          {tab.count != null && tab.count > 0 && (
            <span className="tabular-nums text-[10px] font-semibold text-[#1faca6]">{tab.count}</span>
          )}
          {active === tab.id && (
            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#1faca6] rounded-full" />
          )}
        </button>
      ))}
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
      <p className="text-xs text-[hsl(var(--muted-foreground))]">All caught up — nothing pending approval.</p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]"
        >
          <span className="font-semibold tabular-nums text-[#0d6b67]">{item.count}</span>
          {item.label}
        </span>
      ))}
    </div>
  )
}
