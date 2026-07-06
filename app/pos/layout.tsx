"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/components/auth-provider"
import { clearSession } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()

  function handleLogout() {
    clearSession()
    router.replace("/pos/login")
  }

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))]">
      <header className="h-14 border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Image src="/logo.png" alt="Voltrix" width={80} height={24} className="h-6 w-auto" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Branch POS</p>
            {user?.location && (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{user.location}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user && <span className="hidden sm:inline text-xs text-[hsl(var(--muted-foreground))]">{user.name}</span>}
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
