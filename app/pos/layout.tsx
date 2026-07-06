"use client"

import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/components/auth-provider"
import { clearSession } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const router = useRouter()
  const isLogin = pathname === "/pos/login"

  function handleLogout() {
    clearSession()
    router.replace("/pos/login")
  }

  if (isLogin) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))]">
      <header className="h-14 border-b flex items-center justify-between px-4 shrink-0 bg-[hsl(var(--card))]">
        <div className="flex items-center gap-3 min-w-0">
          <Image src="/logo.png" alt="Voltrix" width={80} height={24} className="h-6 w-auto object-contain" />
          <div className="min-w-0 border-l pl-3">
            <p className="text-sm font-semibold truncate">{user?.location || "Branch POS"}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Point of Sale</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <span className="hidden sm:inline text-xs text-[hsl(var(--muted-foreground))]">{user.name}</span>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5 mr-1" />
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
