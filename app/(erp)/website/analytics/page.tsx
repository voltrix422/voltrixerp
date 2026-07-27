"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/** Old URL — send users to Website → Analytics tab */
export default function WebsiteAnalyticsRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/website?tab=analytics")
  }, [router])

  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Opening Website Analytics…
    </div>
  )
}
