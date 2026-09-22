"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { LayoutDashboard, Users2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ErpWriteProtection } from "@/components/layout/erp-write-protection"
import { PwaProvider } from "@/components/pwa/pwa-provider"

const NAV = [
  { href: "/investor", label: "Dashboard", icon: LayoutDashboard },
  { href: "/investor/crm", label: "CRM 2", icon: Users2 },
]

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/investor/login") return <>{children}</>

  return (
    <PwaProvider>
      <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
        <aside className="hidden md:flex w-52 shrink-0 flex-col border-r bg-[hsl(var(--card))]">
          <div className="h-14 flex items-center px-4 border-b">
            <Image src="/logo.png" alt="Voltrix" width={90} height={28} className="h-6 w-auto object-contain" />
          </div>
          <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">
            Investor portal
          </p>
          <nav className="flex-1 px-2 py-2 space-y-0.5">
            {NAV.map((item) => {
              const active = item.href === "/investor" ? pathname === "/investor" : pathname?.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="md:hidden h-12 border-b flex items-center gap-1 px-2 bg-[hsl(var(--card))]">
            {NAV.map((item) => {
              const active = item.href === "/investor" ? pathname === "/investor" : pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex-1 text-center py-2 text-xs font-semibold rounded-md",
                    active ? "bg-[hsl(var(--accent))]" : "text-[hsl(var(--muted-foreground))]",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
          <ErpWriteProtection>{children}</ErpWriteProtection>
        </div>
      </div>
    </PwaProvider>
  )
}
