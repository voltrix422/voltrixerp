"use client"

import { useAuthWithRole } from "@/components/auth-provider"

export function WriteGuard({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canWrite } = useAuthWithRole()
  if (!canWrite) return <>{fallback}</>
  return <>{children}</>
}
