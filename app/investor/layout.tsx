"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { LayoutDashboard, Users2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ErpWriteProtection } from "@/components/layout/erp-write-protection"

const NAV = [
  { href: "/investor", label: "Dashboard", icon: LayoutDashboard },
  { href: "/investor/crm", label: "CRM", icon: Users2 },
]

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/investor/login") return <>{children}</>

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex h-14 items-center gap-2 border-b border-[hsl(var(--border))] px-4">
          <Image src="/logo.png" alt="Voltrix" width={90} height={28} className="h-6 w-auto object-contain dark:brightness-0 dark:invert" />
        </div>
        <p className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1a9f9a]">
          Investor portal
        </p>
        <nav className="flex-1 space-y-1 px-2.5 py-1">
          {NAV.map((item) => {
            const active = item.href === "/investor" ? pathname === "/investor" : pathname?.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-[#1a9f9a] text-white shadow-sm shadow-[#1a9f9a]/30"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[#1a9f9a]/10 hover:text-[#1a9f9a]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 items-center gap-1 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 md:hidden">
          {NAV.map((item) => {
            const active = item.href === "/investor" ? pathname === "/investor" : pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 rounded-md py-2 text-center text-xs font-semibold",
                  active
                    ? "bg-[#1a9f9a] text-white"
                    : "text-[hsl(var(--muted-foreground))]",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
        <ErpWriteProtection hideBanner>{children}</ErpWriteProtection>
      </div>
    </div>
  )
}
