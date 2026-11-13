"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { canManageChinaMoney, isChinaMoneyUser } from "@/lib/auth"

export default function MoneyToChinaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  if (pathname === "/money-to-china/login") return <>{children}</>

  const roleLabel = canManageChinaMoney(user?.role)
    ? isChinaMoneyUser(user?.role)
      ? "Admin"
      : "ERP Admin"
    : "View only"

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/money-to-china" className="inline-flex items-center gap-2.5 min-w-0">
            <Image src="/logo.png" alt="Voltrix" width={90} height={28} className="h-6 w-auto object-contain" />
            <span className="text-[12px] font-semibold tracking-tight text-[#1d1d1f] truncate hidden sm:inline">
              Money to China
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <span className="text-[11px] text-[#86868b] truncate max-w-[10rem] sm:max-w-[14rem]">
                {user.name} · {roleLabel}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => logout("/money-to-china/login")}
              className="h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.04] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 sm:py-7">{children}</main>
    </div>
  )
}
