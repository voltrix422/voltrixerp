// @ts-nocheck
"use client"

import { useEffect, useRef } from "react"
import { Quote, Star } from "lucide-react"

const reviews = [
  { name: "Ali Khan",    role: "Business Owner",      text: "Voltrix provide long-lasting power and excellent customer support. Truly a game-changer for our facility.", initials: "AK" },
  { name: "Sara Ahmed",  role: "Operations Manager",  text: "Reliable and efficient! Our operations have never been smoother since switching to Voltrix energy systems.", initials: "SA" },
  { name: "Bilal Shah",  role: "Factory Director",    text: "Highly recommend Voltrix for their performance and durability. The ROI has been exceptional.", initials: "BS" },
  { name: "Usman Malik", role: "Solar Consultant",    text: "The BMS technology is outstanding. Real-time Bluetooth monitoring gives us complete peace of mind.", initials: "UM" },
  { name: "Hina Raza",   role: "Homeowner",           text: "Switched from lead-acid to Voltrix LiFePO₄ — the difference is night and day. Zero maintenance headaches.", initials: "HR" },
  { name: "Tariq Butt",  role: "EV Fleet Manager",    text: "Our electric rickshaw fleet runs on Voltrix EV packs. Range improved by 40% and downtime is near zero.", initials: "TB" },
]

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-[#1a9f9a] text-[#1a9f9a]" />
      ))}
    </div>
  )
}

function Card({ r }: { r: typeof reviews[0] }) {
  return (
    <div className="w-80 shrink-0 p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col h-full">
        <Quote className="w-8 h-8 text-[#1a9f9a] mb-4 opacity-50" />
        <StarRating />
        <p className="text-sm text-neutral-600 leading-relaxed mt-3 flex-grow">"{r.text}"</p>
        <div className="flex items-center gap-3 pt-4 mt-4 border-t border-neutral-100">
          <div className="w-10 h-10 rounded-full bg-[#1a9f9a]/10 flex items-center justify-center text-sm font-bold text-[#1a9f9a]">
            {r.initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">{r.name}</p>
            <p className="text-xs text-neutral-500">{r.role}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Track({ items, reverse }: { items: typeof reviews; reverse?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const posRef = useRef(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const speed = reverse ? -0.3 : 0.3

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
      <div ref={trackRef} className="flex gap-5 w-max">
        {doubled.map((r, i) => <Card key={i} r={r} />)}
      </div>
    </div>
  )
}

export default function Testimonials() {
  const row1 = reviews
  const row2 = [...reviews].reverse()

  return (
    <section className="py-24 px-4 bg-neutral-50 overflow-hidden">
      {/* Header */}
      <div className="max-w-5xl mx-auto text-center space-y-2 mb-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#1a9f9a]">Client Testimonials</p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">
          What our clients say
        </h2>
        <p className="text-neutral-500 text-sm max-w-2xl mx-auto">
          Trusted by homeowners, businesses, and fleet operators across Pakistan.
        </p>
      </div>

      {/* Row 1 — left to right */}
      <div className="relative mb-5">
        <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-r from-neutral-50 to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-l from-neutral-50 to-transparent" />
        <Track items={row1} />
      </div>

      {/* Row 2 — right to left */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-r from-neutral-50 to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-l from-neutral-50 to-transparent" />
        <Track items={row2} reverse />
      </div>
    </section>
  )
}
