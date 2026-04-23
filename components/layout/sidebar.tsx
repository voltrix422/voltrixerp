"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { useState } from "react"
import {
  LayoutDashboard, ShoppingCart, DollarSign, Users2,
  BookOpen, Globe, Package, Settings, HelpCircle, Menu, X, UserCog, Truck, GitBranch, Ticket,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import type { Module } from "@/lib/auth"

const ALL_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" as Module },
  { href: "/purchase", label: "Purchase", icon: ShoppingCart, module: "purchase" as Module },
  { href: "/finance", label: "Finance", icon: DollarSign, module: "finance" as Module },
  { href: "/crm", label: "CRM", icon: Users2, module: "crm" as Module },
  { href: "/inventory", label: "Inventory", icon: Package, module: "inventory" as Module },
  { href: "/dispatches", label: "Dispatches", icon: Truck, module: "dispatches" as Module },
  { href: "/website", label: "Website", icon: Globe, module: "website" as Module },
  { href: "/docs", label: "Documentation", icon: BookOpen, module: "docs" as Module },
  { href: "/hrm", label: "HRM", icon: UserCog, module: "hrm" as Module },
  { href: "/branches", label: "Branches", icon: GitBranch, module: "branches" as Module },
  { href: "/tickets", label: "Tickets", icon: Ticket, module: "tickets" as Module },
]

const ADMIN_ONLY_NAV = []

const navSecondary = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Get Help", icon: HelpCircle },
]

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const visibleNav = user?.role === "superadmin"
    ? ALL_NAV
    : ALL_NAV.filter(n => user?.modules.includes(n.module))

  const visibleAdminNav = user?.role === "superadmin" ? ADMIN_ONLY_NAV : []

  return (
    <>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
            </Link>
          )
        })}
        {visibleAdminNav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
              )}
            >
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
