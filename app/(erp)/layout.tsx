"use client"
import { Suspense } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { ErpWriteProtection } from "@/components/layout/erp-write-protection"
import { MessageToastListener } from "@/components/layout/message-toast"
import { NotificationAlertSetup } from "@/components/layout/notification-alert-setup"
import { PostLoginSplash } from "@/components/layout/post-login-splash"
import { PwaProvider } from "@/components/pwa/pwa-provider"

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  return (
    <PwaProvider>
      <div className="flex h-screen overflow-hidden bg-[#f5f5f7] dark:bg-[hsl(var(--background))]">
        <Suspense fallback={<aside className="hidden md:flex w-[220px] shrink-0 min-h-screen border-r border-black/[0.06] bg-[#f5f5f7]" />}>
          <Sidebar />
        </Suspense>
        <div className="relative flex flex-1 flex-col overflow-hidden bg-[#f5f5f7] dark:bg-[hsl(var(--background))]">
          <ErpWriteProtection>
            <Suspense
              fallback={
                <div className="flex h-full flex-1 flex-col gap-3 p-4 md:p-6">
                  <div className="h-7 w-40 animate-pulse rounded-lg bg-black/[0.06]" />
                  <div className="h-4 w-64 animate-pulse rounded bg-black/[0.04]" />
                  <div className="mt-2 min-h-[200px] flex-1 animate-pulse rounded-2xl bg-white/80 ring-1 ring-black/[0.04]" />
                </div>
              }
            >
              {children}
            </Suspense>
          </ErpWriteProtection>
        </div>
        <MessageToastListener />
        <NotificationAlertSetup />
        <PostLoginSplash onErpEntry />
      </div>
    </PwaProvider>
  )
}
