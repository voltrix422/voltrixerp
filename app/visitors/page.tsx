"use client"

import { useEffect, useRef, useState } from "react"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import { dmSans } from "@/lib/fonts/dm-sans"

const ACCENT = "#1a9f9a"

export default function VisitorsPage() {
  const [count, setCount] = useState<number | null>(null)
  const [live, setLive] = useState(false)
  const [error, setError] = useState("")
  const startedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    async function load() {
      if (startedRef.current) return
      startedRef.current = true

      try {
        // Display only — unique count is recorded site-wide by the analytics beacon.
        const res = await fetch("/api/site/visitors", { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Failed")
        if (!cancelled) {
          setCount(Number(data.count) || 0)
          setLive(true)
          setError("")
        }

        pollTimer = setInterval(async () => {
          try {
            const pollRes = await fetch("/api/site/visitors", { cache: "no-store" })
            const pollData = await pollRes.json()
            if (!pollRes.ok) return
            if (!cancelled) {
              setCount(Number(pollData.count) || 0)
              setLive(true)
            }
          } catch {
            /* keep last good count */
          }
        }, 3000)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load counter")
          setLive(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [])

  return (
    <main
      className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`}
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-xl mx-auto text-center space-y-8">
          <div className="space-y-3">
            <p
              className="text-xs font-semibold uppercase tracking-widest inline-flex items-center gap-2"
              style={{ color: ACCENT }}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${live ? "animate-pulse" : ""}`}
                style={{ backgroundColor: live ? ACCENT : "#a3a3a3" }}
              />
              Live visitor counter
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-neutral-900">
              Visitors
            </h1>
            <p className="text-neutral-500 text-base leading-relaxed max-w-md mx-auto">
              Counts real website visitors — each browser once across the site (home, products, and
              more). Refresh won’t add again; a new browser will.
            </p>
          </div>

          <div className="rounded-[28px] border border-neutral-100 bg-neutral-50 px-8 py-12 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : count === null ? (
              <p className="text-neutral-400 text-sm">Counting…</p>
            ) : (
              <>
                <p
                  className="text-6xl sm:text-7xl font-bold tabular-nums tracking-tight"
                  style={{ color: ACCENT }}
                >
                  {count.toLocaleString()}
                </p>
                <p className="mt-3 text-sm text-neutral-500">
                  unique visitor{count === 1 ? "" : "s"}
                </p>
              </>
            )}
          </div>

          <p className="text-xs text-neutral-400">
            Live updates every few seconds as real users visit voltrixbatteries.com.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  )
}
