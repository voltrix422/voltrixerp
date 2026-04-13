"use client"
import { useAuth } from "@/components/auth-provider"
import type { Module } from "@/lib/auth"
import { ShieldOff } from "lucide-react"

export function ModuleGuard({ module, children }: { module: Module; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return null

  const hasAccess = user.role === "superadmin" || user.modules.includes(module)

  if (!hasAccess) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
          <ShieldOff className="h-7 w-7 text-[hsl(var(--muted-foreground))]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            You don&apos;t have permission to view this module. Contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
