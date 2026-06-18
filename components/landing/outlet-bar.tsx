"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { MapPin, X, ChevronRight } from "lucide-react"

const DISMISS_KEY = "voltrix-outlet-bar-dismissed"

type PublicOutlet = { id: string; name: string; city: string }

export function OutletBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [outlets, setOutlets] = useState<PublicOutlet[]>([])

  useEffect(() => {
    if (pathname === "/outlets") return
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return
    } catch {
      /* ignore */
    }
    setVisible(true)

    fetch("/api/db/outlets?public=true")
      .then(res => (res.ok ? res.json() : []))
      .then((data: PublicOutlet[]) => setOutlets(Array.isArray(data) ? data : []))
      .catch(() => setOutlets([]))
  }, [pathname])

  if (!visible || pathname === "/outlets") return null

  const cities = [...new Set(outlets.map(o => o.city).filter(Boolean))]
  const subtitle =
    cities.length > 0
      ? `Branches in ${cities.slice(0, 3).join(", ")}${cities.length > 3 ? " & more" : ""}`
      : "Find a Voltrix branch near you for products & support"

  function goToOutlets() {
    router.push("/outlets")
  }

  function dismiss(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  return (
    <button
      type="button"
      onClick={goToOutlets}
      className="w-full max-w-6xl mx-4 flex items-center justify-between gap-3 px-4 py-2 rounded-lg border cursor-pointer transition-all duration-300 hover:brightness-105 active:scale-[0.995] text-left group"
      style={{
        background: "linear-gradient(90deg, rgba(26,159,154,0.92) 0%, rgba(21,138,133,0.88) 100%)",
        borderColor: "rgba(255,255,255,0.25)",
        boxShadow: "0 4px 20px rgba(26,159,154,0.25)",
      }}
      aria-label="View Voltrix outlets and branches"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15">
          <MapPin className="h-3.5 w-3.5 text-white" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">
            Visit our outlets
          </p>
          <p className="text-[11px] text-white/85 leading-tight truncate hidden sm:block">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs font-medium text-white/95 hidden sm:inline-flex items-center gap-0.5">
          View locations
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={dismiss}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              dismiss(e as unknown as React.MouseEvent)
            }
          }}
          className="ml-1 p-1 rounded-md text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          aria-label="Dismiss outlet notice"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  )
}
