"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import WebsiteAnalyticsDetail from "@/components/website/website-analytics-detail"

export default function WebsiteAnalyticsDetailPage() {
  return (
    <ModuleGuard module="website">
      <Topbar title="Page Analytics" description="Detailed stats for one website page" />
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        }
      >
        <WebsiteAnalyticsDetail />
      </Suspense>
    </ModuleGuard>
  )
}
