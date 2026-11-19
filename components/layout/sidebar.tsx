"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { Suspense, useEffect, useState, useTransition } from "react"
import {
  Grid2X2,
  Wallet,
  UsersRound,
  Archive,
  Monitor,
  ShoppingBag,
  Compass,
  NotebookText,
  IdCard,
  LifeBuoy,
  MessageCircle,
  WalletCards,
  Gauge,
  CircleCheck,
  UserRoundCog,
  Menu,
  X,
  ChevronDown,
  type LucideIcon,
} from "lucide-react"
import { canAccessCrmMain, canAccessSalesAgentsArea } from "@/lib/crm-workspace"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { NavTooltip } from "@/components/ui/nav-tooltip"
import { useAuth } from "@/components/auth-provider"
import { UnreadMessagesBadge } from "@/components/layout/messages-icon"
import { ErpNavProgress } from "@/components/layout/erp-nav-progress"
import type { Module } from "@/lib/auth"
import { hasModuleAccess, isSuperadmin, roleHasAllModules } from "@/lib/auth"

function CollapsedTip({
  label,
  enabled,
  children,
}: {
  label: string
  enabled: boolean
  children: React.ReactNode
}) {
  if (!enabled) return <>{children}</>
  return (
    <NavTooltip label={label} side="right" className="flex w-full justify-center">
      {children}
    </NavTooltip>
  )
}

const SIDEBAR_COLLAPSED_KEY = "voltrix-sidebar-collapsed"

/** SF Symbols–like weight: slightly heavier for readability. */
const NAV_ICON_CLASS = "h-[19px] w-[19px] shrink-0"
const NAV_ICON_STROKE = 2

const NAV_ORDER: Array<{
  key: string
  href?: string
  label: string
  icon: LucideIcon
  module?: Module
  kind: "link" | "crm" | "finance"
}> = [
  { key: "dashboard", href: "/todos", label: "Dashboard", icon: Grid2X2, module: "dashboard", kind: "link" },
  { key: "finance", href: "/finance", label: "Finance", icon: Wallet, module: "finance", kind: "link" },
  { key: "crm", label: "CRM", icon: UsersRound, module: "crm", kind: "crm" },
  { key: "inventory", href: "/inventory", label: "Inventory", icon: Archive, module: "inventory", kind: "link" },
  { key: "pos-admin", href: "/pos-admin", label: "POS Admin", icon: Monitor, module: "pos_admin", kind: "link" },
  { key: "purchase", href: "/purchase", label: "Purchase", icon: ShoppingBag, module: "purchase", kind: "link" },
  { key: "website", href: "/website", label: "Website", icon: Compass, module: "website", kind: "link" },
  { key: "docs", href: "/docs", label: "Documentation", icon: NotebookText, module: "docs", kind: "link" },
  { key: "hrm", href: "/hrm", label: "HRM", icon: IdCard, module: "hrm", kind: "link" },
  { key: "tickets", href: "/tickets", label: "After Sale", icon: LifeBuoy, module: "tickets", kind: "link" },
  { key: "messages", href: "/messages", label: "Messages", icon: MessageCircle, kind: "link" },
  { key: "petty-cash", href: "/petty-cash", label: "Petty Cash", icon: WalletCards, kind: "link" },
  { key: "petrol", href: "/petrol", label: "Petrol", icon: Gauge, kind: "link" },
  { key: "todos", href: "/todos", label: "To-do", icon: CircleCheck, kind: "link" },
]

const ADMIN_ONLY_NAV: Array<{ href: string; label: string; icon: LucideIcon; module?: Module }> = [
  { href: "/manage-users", label: "Manage Users", icon: UserRoundCog, module: "users" },
]

function NavContent({
  onNavigate,
  collapsed = false,
  pendingHref,
  setPendingHref,
}: {
  onNavigate?: () => void
  collapsed?: boolean
  pendingHref: string | null
  setPendingHref: (href: string | null) => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const { user } = useAuth()
  const [crmOpen, setCrmOpen] = useState(pathname?.startsWith("/crm") || false)

  const isSuperadminUser = isSuperadmin(user?.role)
  const showCrmMain = canAccessCrmMain(user)
  const showSalesAgents = canAccessSalesAgentsArea(user)

  function hasModule(module: Module): boolean {
    return roleHasAllModules(user?.role) || (user?.modules.includes(module) ?? false)
  }

  function canShowNavItem(item: (typeof NAV_ORDER)[number]): boolean {
    if (item.kind === "crm") {
      return hasModule("crm") && (showCrmMain || showSalesAgents)
    }
    if (!item.module) return true
    return hasModule(item.module)
  }

  const visibleAdminNav = ADMIN_ONLY_NAV.filter((item) => (
    item.module ? hasModuleAccess(user, item.module) : isSuperadminUser
  ))

  // Prefetch visible ERP routes so clicks don't wait on first download.
  useEffect(() => {
    const hrefs = new Set<string>()
    for (const item of NAV_ORDER) {
      if (!canShowNavItem(item)) continue
      if (item.href) hrefs.add(item.href.split("?")[0])
      if (item.kind === "crm") {
        if (showCrmMain) hrefs.add("/crm")
        if (showSalesAgents) hrefs.add("/crm/sales-agents")
      }
    }
    for (const item of visibleAdminNav) hrefs.add(item.href.split("?")[0])
    const run = () => {
      for (const href of hrefs) {
        try {
          router.prefetch(href)
        } catch {
          /* ignore */
        }
      }
    }
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 })
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(run, 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefetch when auth modules settle
  }, [user?.id, user?.role, showCrmMain, showSalesAgents, router])

  useEffect(() => {
    if (!pendingHref) return
    const target = pendingHref.split("?")[0]
    if (pathname === target || pathname?.startsWith(`${target}/`)) {
      setPendingHref(null)
    }
  }, [pathname, pendingHref, setPendingHref])

  function go(href: string) {
    const target = href.split("?")[0]
    if (pathname === target || pathname?.startsWith(`${target}/`)) {
      onNavigate?.()
      return
    }
    setPendingHref(href)
    onNavigate?.()
    startTransition(() => {
      router.push(href)
    })
  }

  const isActivePath = (href: string) => {
    const target = href.split("?")[0]
    const current = (pendingHref || pathname || "").split("?")[0]
    // Exact match for CRM main so Sales agents does not light up Main.
    if (target === "/crm") return current === "/crm"
    return current === target || current.startsWith(`${target}/`)
  }

  const crmSectionActive = (() => {
    const current = (pendingHref || pathname || "").split("?")[0]
    return current === "/crm" || current.startsWith("/crm/")
  })()

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center rounded-md text-[14px] font-bold tracking-[-0.01em] transition-colors",
      collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-2 py-2",
      active
        ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
    )

  const subLinkClass = (active: boolean) =>
    cn(
      "flex items-center rounded-md px-2 py-1.5 text-[13px] font-bold tracking-[-0.01em] transition-colors",
      active
        ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
    )

  return (
    <>
      <nav className={cn("flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-none", collapsed ? "px-1.5" : "px-2")}>
        {NAV_ORDER.filter(canShowNavItem).map((item) => {
          if (item.kind === "crm") {
            if (collapsed) {
              const crmHref = showCrmMain ? "/crm" : "/crm/sales-agents"
              return (
                <CollapsedTip key={item.key} label={item.label} enabled>
                  <Link
                    href={crmHref}
                    prefetch
                    onClick={(e) => {
                      e.preventDefault()
                      go(crmHref)
                    }}
                    onMouseEnter={() => router.prefetch(crmHref)}
                    aria-label={item.label}
                    className={linkClass(crmSectionActive)}
                  >
                    <UsersRound className={NAV_ICON_CLASS} strokeWidth={NAV_ICON_STROKE} />
                  </Link>
                </CollapsedTip>
              )
            }
            return (
              <div key={item.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setCrmOpen((open) => !open)}
                  className={cn(linkClass(crmSectionActive), "w-full cursor-pointer")}
                >
                  <UsersRound className={NAV_ICON_CLASS} strokeWidth={NAV_ICON_STROKE} />
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 shrink-0 transition-transform", crmOpen && "rotate-180")}
                    strokeWidth={NAV_ICON_STROKE}
                  />
                </button>
                {crmOpen && (
                  <div className="ml-6 space-y-1">
                    {showCrmMain && (
                      <Link
                        href="/crm"
                        prefetch
                        onClick={(e) => {
                          e.preventDefault()
                          go("/crm")
                        }}
                        onMouseEnter={() => router.prefetch("/crm")}
                        className={subLinkClass(isActivePath("/crm"))}
                      >
                        Main
                      </Link>
                    )}
                    {showSalesAgents && (
                      <Link
                        href="/crm/sales-agents"
                        prefetch
                        onClick={(e) => {
                          e.preventDefault()
                          go("/crm/sales-agents")
                        }}
                        onMouseEnter={() => router.prefetch("/crm/sales-agents")}
                        className={subLinkClass(isActivePath("/crm/sales-agents"))}
                      >
                        Sales agents
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )
          }

          const Icon = item.icon
          const href = item.href!
          return (
            <CollapsedTip key={item.key} label={item.label} enabled={collapsed}>
              <Link
                href={href}
                prefetch
                onClick={(e) => {
                  e.preventDefault()
                  go(href)
                }}
                onMouseEnter={() => router.prefetch(href)}
                aria-label={item.label}
                className={cn(linkClass(isActivePath(href)), collapsed && item.key === "messages" && "relative")}
              >
                <Icon className={NAV_ICON_CLASS} strokeWidth={NAV_ICON_STROKE} />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.key === "messages" && <UnreadMessagesBadge />}
                  </>
                )}
              </Link>
            </CollapsedTip>
          )
        })}
        {visibleAdminNav.map(({ href, label, icon: Icon }) => {
          return (
            <CollapsedTip key={href} label={label} enabled={collapsed}>
              <Link
                href={href}
                prefetch
                onClick={(e) => {
                  e.preventDefault()
                  go(href)
                }}
                onMouseEnter={() => router.prefetch(href)}
                aria-label={label}
                className={linkClass(isActivePath(href))}
              >
                <Icon className={NAV_ICON_CLASS} strokeWidth={NAV_ICON_STROKE} />
                {!collapsed && <span className="flex-1 truncate">{label}</span>}
              </Link>
            </CollapsedTip>
          )
        })}
      </nav>
    </>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1")
    } catch {
      // ignore
    }
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0")
      } catch {
        // ignore
      }
      return next
    })
  }

  const logoButton = (opts?: { mobile?: boolean }) => (
    <button
      type="button"
      onClick={() => {
        if (opts?.mobile) setMobileOpen(false)
        else toggleCollapsed()
      }}
      className={cn(
        "flex h-[58px] w-full items-center justify-center shrink-0 cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/5 transition-colors pt-2.5",
        collapsed && !opts?.mobile ? "px-1" : "px-4",
      )}
      title={opts?.mobile ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={opts?.mobile ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <Image
        src="/logo.png"
        alt="VoltrixERP"
        width={collapsed && !opts?.mobile ? 36 : 64}
        height={collapsed && !opts?.mobile ? 28 : 20}
        style={{ height: "auto" }}
        className="object-contain"
        priority
      />
    </button>
  )

  return (
    <>
      <ErpNavProgress pendingHref={pendingHref} />
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 min-h-screen border-r border-black/[0.06] dark:border-[hsl(var(--border))] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] transition-[width] duration-200 ease-out",
          collapsed ? "w-[64px]" : "w-[220px]",
        )}
      >
        {logoButton()}
        <Suspense fallback={null}>
          <NavContent
            collapsed={collapsed}
            pendingHref={pendingHref}
            setPendingHref={setPendingHref}
          />
        </Suspense>
      </aside>

      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-0 left-0 z-50 flex h-14 items-center px-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-[220px] h-full bg-[#f5f5f7] dark:bg-[hsl(var(--background))] border-r border-black/[0.06] shadow-xl z-10">
            <div className="relative">
              {logoButton({ mobile: true })}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Suspense fallback={null}>
              <NavContent
                onNavigate={() => setMobileOpen(false)}
                pendingHref={pendingHref}
                setPendingHref={setPendingHref}
              />
            </Suspense>
          </aside>
        </div>
      )}
    </>
  )
}
