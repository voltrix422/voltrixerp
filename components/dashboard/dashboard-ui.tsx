"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function formatRsAxis(value: number) {
  const n = Number(value)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

export function formatRsFull(value: number) {
  return `Rs. ${value.toLocaleString("en-PK")}`
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-auto bg-gradient-to-b from-[hsl(var(--background))] via-[hsl(var(--background))] to-[#1faca6]/[0.04]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 space-y-6">{children}</div>
    </div>
  )
}

export function DashboardSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || description || action) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[hsl(var(--foreground))]">{title}</h2>
            {description && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
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
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-[hsl(var(--muted))]/40 p-1 border border-[hsl(var(--border))]/60">
      {options.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(days)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer",
            value === days
              ? "bg-[#1faca6] text-white shadow-sm"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
          )}
        >
          {days}D
        </button>
      ))}
    </div>
  )
}

type StatCardConfig = {
  label: string
  value: string | number
  icon: LucideIcon
  href: string
  accent: string
  iconBg: string
}

export function StatCardGrid({
  cards,
  loading,
}: {
  cards: StatCardConfig[]
  loading: boolean
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.slice(0, 6).map((card) => (
        <StatCard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  accent,
  iconBg,
  loading,
}: StatCardConfig & { loading?: boolean }) {
  return (
    <Link href={href} className="group block">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] p-4",
          "shadow-sm transition-all duration-200",
          "hover:shadow-md hover:border-[#1faca6]/30 hover:-translate-y-0.5",
        )}
      >
        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", accent)} />
        <div className="flex items-start justify-between gap-2 pl-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] truncate">
              {label}
            </p>
            <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))] mt-1.5 tracking-tight">
              {loading ? (
                <span className="inline-block h-6 w-14 rounded bg-[hsl(var(--muted))]/60 animate-pulse" />
              ) : (
                value
              )}
            </p>
          </div>
          <div className={cn("shrink-0 rounded-lg p-2", iconBg)}>
            <Icon className="h-4 w-4 text-[hsl(var(--foreground))]/70" />
          </div>
        </div>
      </div>
    </Link>
  )
}

export function FinanceHighlightGrid({
  cards,
  loading,
}: {
  cards: StatCardConfig[]
  loading: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => (
        <Link key={card.label} href={card.href} className="group block">
          <div
            className={cn(
              "rounded-xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] p-4 sm:p-5",
              "shadow-sm transition-all hover:shadow-md hover:border-[#1faca6]/25",
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn("rounded-xl p-3", card.iconBg)}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{card.label}</p>
                <p className="text-lg sm:text-xl font-bold tabular-nums mt-0.5 truncate">
                  {loading ? "—" : card.value}
                </p>
              </div>
            </div>
          </div>
        </Link>
      ))}
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
  subtitle: string
  footer?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  tall?: boolean
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 border-b border-[hsl(var(--border))]/50 bg-[hsl(var(--muted))]/[0.15]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className={cn("px-2 pb-2", tall ? "h-[200px]" : "h-[168px]")}>{children}</div>
      {footer && (
        <div className="px-4 py-2.5 border-t border-[hsl(var(--border))]/50 bg-[hsl(var(--muted))]/10 text-xs text-[hsl(var(--muted-foreground))]">
          {footer}
        </div>
      )}
    </div>
  )
}

export function ChartLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-[#1faca6] border-t-transparent animate-spin" />
    </div>
  )
}

export const CHART_TOOLTIP_STYLE = {
  borderRadius: "12px",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  fontSize: "12px",
}
