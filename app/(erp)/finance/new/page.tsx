"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Legacy URL — redirect to unified finance overview tab */
export default function FinanceNewRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/finance?tab=overview")
  }, [router])
  return (
    <div className="flex items-center justify-center p-12 text-sm text-[hsl(var(--muted-foreground))]">
      Opening finance overview…
    </div>
  )
}
