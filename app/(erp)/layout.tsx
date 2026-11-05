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
        <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-[hsl(var(--background))]">
          <ErpWriteProtection>{children}</ErpWriteProtection>
        </div>
        <MessageToastListener />
        <NotificationAlertSetup />
        <PostLoginSplash onErpEntry />
      </div>
    </PwaProvider>
  )
}
