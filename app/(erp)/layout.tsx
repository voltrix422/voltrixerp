"use client"
import { Sidebar } from "@/components/layout/sidebar"
import { ErpWriteProtection } from "@/components/layout/erp-write-protection"

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ErpWriteProtection>{children}</ErpWriteProtection>
      </div>
    </div>
  )
}
