"use client"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { DBStatusIndicator } from "@/components/db-status-indicator"
import { useAuth } from "@/components/auth-provider"
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

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-[hsl(var(--background))] px-4 md:px-6">
      <div className="flex flex-1 items-center pl-8 md:pl-0">
        <div className="flex flex-col justify-center">
          <h1 className="text-sm font-semibold leading-none">{title}</h1>
          {description && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {action && <>{action}</>}
        <DBStatusIndicator />
        <ThemeToggle />
        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Notification bell — only shown when pendingCount is passed (dashboard) */}
        {pendingCount !== undefined && pendingCount > 0 && (
          <button
            onClick={onPendingClick}
            className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] transition-colors"
            aria-label={`${pendingCount} pending approvals`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          </button>
        )}

        {/* Avatar + dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(v => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--foreground))] text-[hsl(var(--background))] text-xs font-semibold cursor-pointer select-none hover:opacity-80 transition-opacity"
            aria-label="User menu"
          >
            {initials}
          </button>

          {open && (
            <div className="absolute right-0 top-9 z-50 w-52 rounded-lg border bg-[hsl(var(--card))] shadow-md py-1">
              <div className="px-3 py-2 border-b">
                <p className="text-xs font-medium truncate">{user?.name}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setOpen(false); logout() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
