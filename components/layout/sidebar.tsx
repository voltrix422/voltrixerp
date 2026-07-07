"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { useState } from "react"
import {
  LayoutDashboard, ShoppingCart, DollarSign, Users2,
  BookOpen, Globe, Package, Settings, HelpCircle, Menu, X, UserCog, Truck, Ticket, Wallet, ChevronDown, Target, MessageSquare,
} from "lucide-react"
import { canAccessCrmMain, canAccessSalesAgentsArea } from "@/lib/crm-workspace"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import type { Module } from "@/lib/auth"
import { isSuperadmin, roleHasAllModules } from "@/lib/auth"

const NAV_ORDER: Array<{
  key: string
  href?: string
  label: string
  icon: typeof LayoutDashboard
  module?: Module
  kind: "link" | "crm" | "finance"
}> = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard", kind: "link" },
  { key: "kpi", href: "/kpi-dashboard", label: "KPI Dashboard", icon: Target, kind: "link" },
  { key: "finance", label: "Finance", icon: DollarSign, module: "finance", kind: "finance" },
  { key: "crm", label: "CRM", icon: Users2, module: "crm", kind: "crm" },
  { key: "inventory", href: "/inventory", label: "Inventory", icon: Package, module: "inventory", kind: "link" },
  { key: "purchase", href: "/purchase", label: "Purchase", icon: ShoppingCart, module: "purchase", kind: "link" },
  { key: "dispatches", href: "/dispatches", label: "Dispatches", icon: Truck, module: "dispatches", kind: "link" },
  { key: "website", href: "/website", label: "Website", icon: Globe, module: "website", kind: "link" },
  { key: "docs", href: "/docs", label: "Documentation", icon: BookOpen, module: "docs", kind: "link" },
  { key: "hrm", href: "/hrm", label: "HRM", icon: UserCog, module: "hrm", kind: "link" },
  { key: "tickets", href: "/tickets", label: "Tickets", icon: Ticket, module: "tickets", kind: "link" },
  { key: "messages", href: "/messages", label: "Messages", icon: MessageSquare, kind: "link" },
  { key: "petty-cash", href: "/petty-cash", label: "Petty Cash", icon: Wallet, kind: "link" },
]

const ADMIN_ONLY_NAV: Array<{ href: string; label: string; icon: any }> = [
  { href: "/dashboard?manageUsers=1", label: "Manage Users", icon: Users2 },
]

const navSecondary = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Get Help", icon: HelpCircle },
]

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
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
    if (item.kind === "finance") {
      return hasModule("finance")
    }
    if (!item.module) return true
    return hasModule(item.module)
  }

  const visibleAdminNav = isSuperadminUser ? ADMIN_ONLY_NAV : []

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
    )

  return (
    <>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ORDER.filter(canShowNavItem).map((item) => {
          if (item.kind === "crm") {
            return (
              <div key={item.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setCrmOpen((open) => !open)}
                  className={cn(linkClass(pathname?.startsWith("/crm") || false), "w-full cursor-pointer")}
                >
                  <Users2 className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", crmOpen && "rotate-180")} />
                </button>
                {crmOpen && (
                  <div className="ml-6 space-y-1">
                    {showCrmMain && (
                      <Link
                        href="/crm"
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                          pathname === "/crm"
                            ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                            : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
                        )}
                      >
                        Main
                      </Link>
                    )}
                    {showSalesAgents && (
                      <Link
                        href="/crm/sales-agents"
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                          pathname?.startsWith("/crm/sales-agents")
                            ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                            : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
                        )}
                      >
                        Sales agents
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )
          }

          if (item.kind === "finance") {
            return (
              <Link
                key={item.key}
                href="/finance"
                onClick={onNavigate}
                className={linkClass(pathname?.startsWith("/finance") || false)}
              >
                <DollarSign className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            )
          }

          const Icon = item.icon
          const active = pathname?.startsWith(item.href!) || false
          return (
            <Link key={item.key} href={item.href!} onClick={onNavigate} className={linkClass(active)}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          )
        })}
        {visibleAdminNav.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href.split("?")[0]) || false
          return (
            <Link key={href} href={href} onClick={onNavigate} className={linkClass(active)}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-3 border-t space-y-0.5">
        {navSecondary.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-colors"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const logoBlock = (
    <div className="flex h-14 items-center justify-center px-4 border-b shrink-0">
      <Image src="/logo.png" alt="VoltrixERP" width={64} height={20} style={{ height: 'auto' }} className="object-contain" priority />
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 min-h-screen border-r bg-[hsl(var(--background))]">
        {logoBlock}
        <NavContent />
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
          <aside className="relative flex flex-col w-[220px] h-full bg-[hsl(var(--background))] border-r shadow-xl z-10">
            <div className="flex h-14 items-center justify-between px-4 border-b shrink-0">
              <Image src="/logo.png" alt="VoltrixERP" width={64} height={20} style={{ height: 'auto' }} className="object-contain" priority />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <NavContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
