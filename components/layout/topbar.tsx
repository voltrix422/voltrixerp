"use client"
import { LogOut } from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { DBStatusIndicator } from "@/components/db-status-indicator"
import { ActiveUsersCounter } from "@/components/ui/active-users-counter"
import { NotificationBell } from "@/components/layout/notification-bell"
import { InstallErpButton } from "@/components/pwa/pwa-provider"
import { MessagesIcon } from "@/components/layout/messages-icon"
import { useAuth } from "@/components/auth-provider"
import { isInvestorUser } from "@/lib/auth"
import { useState, useRef, useEffect } from "react"

interface TopbarProps {
  title: string
  description?: string
  action?: React.ReactNode
  pendingCount?: number
  onPendingClick?: () => void
}

export function Topbar({ title, description, action, pendingCount, onPendingClick }: TopbarProps) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
  const investor = isInvestorUser(user?.role)

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-black/[0.06] dark:border-[hsl(var(--border))] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-4 md:px-5">
      <div className="flex flex-1 items-center pl-8 md:pl-0 min-w-0">
        <div className="flex flex-col justify-center min-w-0">
          <h1 className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] leading-none truncate">
            {title}
          </h1>
          {description && (
            <p className="text-[11px] text-[#86868b] mt-0.5 truncate">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        {action && <>{action}</>}
        {!investor && <ActiveUsersCounter showLabel={false} />}
        {!investor && <DBStatusIndicator />}
        <ThemeToggle />
        {!investor && (
          <>
            <InstallErpButton className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.06] dark:hover:bg-white/10 shrink-0" />
            <MessagesIcon />
            <NotificationBell />
          </>
        )}

        {!investor && pendingCount !== undefined && pendingCount > 0 && (
          <button
            onClick={onPendingClick}
            className="relative flex h-7 w-7 items-center justify-center rounded-full text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors"
            aria-label={`${pendingCount} pending approvals`}
          >
            <svg className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#ff3b30] px-0.5 text-[9px] font-semibold text-white tabular-nums">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          </button>
        )}

        <div className="relative ml-1" ref={ref}>
          <button
            onClick={() => setOpen(v => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d1d1f] text-white text-[10px] font-semibold cursor-pointer select-none hover:opacity-85 transition-opacity"
            aria-label="User menu"
          >
            {initials}
          </button>

          {open && (
            <div className="absolute right-0 top-9 z-50 w-52 rounded-[12px] border border-black/[0.06] bg-white dark:bg-[hsl(var(--card))] shadow-[0_12px_40px_rgba(0,0,0,0.14)] py-1 overflow-hidden">
              <div className="px-3 py-2 border-b border-black/[0.06] dark:border-[hsl(var(--border))]">
                <p className="text-[12px] font-semibold truncate text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{user?.name}</p>
                <p className="text-[10px] text-[#86868b] truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setOpen(false); logout("/login") }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#ff3b30] hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
