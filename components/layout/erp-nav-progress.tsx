"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * Thin top bar while a soft navigation is in flight (pathname not yet updated).
 * Cleared as soon as the route changes.
 */
export function ErpNavProgress({ pendingHref }: { pendingHref: string | null }) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!pendingHref) {
      setVisible(false)
      return
    }
    const target = pendingHref.split("?")[0]
    if (pathname === target || pathname?.startsWith(`${target}/`)) {
      setVisible(false)
      return
    }
    setVisible(true)
  }, [pendingHref, pathname])

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-black/[0.06]"
      aria-hidden
    >
      <div className="h-full w-1/3 animate-pulse rounded-full bg-[#0071e3] shadow-[0_0_8px_#0071e3]" />
    </div>
  )
}
