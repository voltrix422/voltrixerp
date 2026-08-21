import { Suspense } from "react"
import { Topbar } from "@/components/layout/topbar"
import { MessagesManager } from "@/components/messages/messages-manager"

export default function MessagesPage() {
  return (
    <>
      <Topbar title="Messages" description="Chat with other ERP users" />
      <div className="flex-1 overflow-hidden">
        <div className="p-4 sm:p-6 h-full">
          <Suspense fallback={<div className="text-sm text-[hsl(var(--muted-foreground))] p-4">Loading messages…</div>}>
            <MessagesManager />
          </Suspense>
        </div>
      </div>
    </>
  )
}
