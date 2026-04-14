// @ts-nocheck
"use client"

import { useEffect, useRef } from "react"
import ScrollFloat from "./scroll-float"

const reviews = [
  { name: "Ali Khan",    role: "Business Owner",      date: "September 2025", text: "Voltrix provide long-lasting power and excellent customer support. Truly a game-changer for our facility.", initials: "AK", color: "#1a9f9a" },
  { name: "Sara Ahmed",  role: "Operations Manager",  date: "September 2025", text: "Reliable and efficient! Our operations have never been smoother since switching to Voltrix energy systems.", initials: "SA", color: "#6366f1" },
  { name: "Bilal Shah",  role: "Factory Director",    date: "September 2025", text: "Highly recommend Voltrix for their performance and durability. The ROI has been exceptional.", initials: "BS", color: "#f59e0b" },
  { name: "Usman Malik", role: "Solar Consultant",    date: "September 2025", text: "The BMS technology is outstanding. Real-time Bluetooth monitoring gives us complete peace of mind.", initials: "UM", color: "#ec4899" },
  { name: "Hina Raza",   role: "Homeowner",           date: "September 2025", text: "Switched from lead-acid to Voltrix LiFePO₄ — the difference is night and day. Zero maintenance headaches.", initials: "HR", color: "#14b8a6" },
  { name: "Tariq Butt",  role: "EV Fleet Manager",    date: "September 2025", text: "Our electric rickshaw fleet runs on Voltrix EV packs. Range improved by 40% and downtime is near zero.", initials: "TB", color: "#8b5cf6" },
]

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className="w-3.5 h-3.5 fill-amber-400" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function Card({ r, dark }: { r: typeof reviews[0]; dark?: boolean }) {
  return (
    <div className={`w-80 shrink-0 p-6 rounded-2xl space-y-4 relative ${dark ? "bg-white/5 border border-white/10" : "bg-white border border-neutral-100 shadow-sm"}`}>
      {/* Big quote mark */}
      <span className="absolute top-4 right-5 text-5xl font-serif leading-none select-none" style={{ color: r.color, opacity: 0.18 }}>"</span>
      <StarRating />
      <p className={`text-sm leading-relaxed ${dark ? "text-white/70" : "text-neutral-600"}`}>"{r.text}"</p>
      <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "#f5f5f5" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: r.color }}>
          {r.initials}
        </div>
        <div>
          <p className={`text-sm font-semibold ${dark ? "text-white" : "text-neutral-900"}`}>{r.name}</p>
          <p className={`text-xs ${dark ? "text-white/40" : "text-neutral-400"}`}>{r.role} · {r.date}</p>
        </div>
      </div>
    </div>
  )
}

function Track({ items, reverse, dark }: { items: typeof reviews; reverse?: boolean; dark?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const posRef = useRef(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const speed = reverse ? -0.4 : 0.4

    const animate = () => {
      posRef.current += speed
      const half = track.scrollWidth / 2
      if (posRef.current >= half) posRef.current = 0
      if (posRef.current < 0) posRef.current = half
      track.style.transform = `translateX(-${posRef.current}px)`
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)

    const pause = () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
    const resume = () => { animRef.current = requestAnimationFrame(animate) }
    track.addEventListener("mouseenter", pause)
    track.addEventListener("mouseleave", resume)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      track.removeEventListener("mouseenter", pause)
      track.removeEventListener("mouseleave", resume)
    }
  }, [reverse])

  const doubled = [...items, ...items]

  return (
    <div className="overflow-hidden">
      <div ref={trackRef} className="flex gap-4 w-max">
        {doubled.map((r, i) => <Card key={i} r={r} dark={dark} />)}
      </div>
    </div>
  )
}

export default function Testimonials() {
  const row1 = reviews
  const row2 = [...reviews].reverse()

  return (
    <section className="py-24 overflow-hidden" style={{ backgroundColor: "#E8E2D8" }}>
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 text-center space-y-2 mb-14">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Client's Testimonial</p>
        <ScrollFloat
          animationDuration={1}
          ease="back.inOut(2)"
          scrollStart="center bottom+=50%"
          scrollEnd="bottom bottom-=40%"
          stagger={0.03}
          containerClassName="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900"
        >
          What our clients say
        </ScrollFloat>
        <p className="text-neutral-500 text-sm">Trusted by homeowners, businesses, and fleet operators across Pakistan.</p>
      </div>

      {/* Row 1 — left to right */}
      <div className="relative mb-4">
        <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, #E8E2D8, transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, #E8E2D8, transparent)" }} />
        <Track items={row1} />
      </div>

      {/* Row 2 — right to left */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, #E8E2D8, transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, #E8E2D8, transparent)" }} />
        <Track items={row2} reverse />
      </div>
    </section>
  )
}
