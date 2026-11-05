"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

/** Compact macOS-style label that appears under a navbar icon on hover. */
export function NavTooltip({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[60] -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-[#1d1d1f] px-2.5 py-1 text-[10px] font-medium text-white shadow-lg">
          {label}
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#1d1d1f]" />
        </div>
      )}
    </div>
  )
}
