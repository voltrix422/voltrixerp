"use client"

import { useEffect, useRef, useState } from "react"
import { Users, Package, Star, Truck } from "lucide-react"
import ShinyText from "./shiny-text"

const stats = [
  { icon: Users,   value: 500,  suffix: "+",  label: "Clients",               desc: "Across Pakistan" },
  { icon: Package, value: 1200, suffix: "+",  label: "Units Sold",            desc: "And counting"    },
  { icon: Star,    value: 99,   suffix: "%",  label: "Customer Satisfaction", desc: "5-star rated"    },
  { icon: Truck,   value: 2000, suffix: "+",  label: "Units Delivered",       desc: "Nationwide"      },
]

function useCountUp(target: number, duration = 1800, started: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!started) return
    let startTime: number | null = null
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const p = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 4)
      setCount(Math.floor(eased * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, target, duration])
  return count
}

function StatCard({
  icon: Icon, value, suffix, label, desc, started, index,
}: typeof stats[0] & { started: boolean; index: number }) {
  const count = useCountUp(value, 1800, started)
  const display = count >= 1000 ? count.toLocaleString() : count

  return (
    <div
      className="flex flex-col gap-4 p-6 rounded-2xl bg-white border border-neutral-100"
      style={{
        opacity: started ? 1 : 0,
        transform: started ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s cubic-bezier(0.22,1,0.36,1) ${index * 100}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${index * 100}ms`,
      }}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a9f9a10" }}>
        <Icon className="w-3.5 h-3.5" style={{ color: "#1a9f9a" }} />
      </div>

      <div>
        <p className="text-4xl font-bold text-neutral-900 tabular-nums leading-none tracking-tight">
          {display}
          <span className="text-2xl" style={{ color: "#1a9f9a" }}>{suffix}</span>
        </p>
      </div>

      <div className="space-y-0.5 border-t border-neutral-50 pt-3">
        <p className="text-sm font-semibold text-neutral-800">{label}</p>
        <p className="text-xs text-neutral-400">{desc}</p>
      </div>
    </div>
  )
}

export default function Stats() {
  const ref = useRef<HTMLElement>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); observer.disconnect() } },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-20 px-4 bg-neutral-50/60">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Heading */}
        <h2
          className="text-3xl font-bold tracking-tight text-center"
          style={{
            opacity: started ? 1 : 0,
            transform: started ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <ShinyText
            text="Trusted across Pakistan."
            speed={3}
            color="#171717"
            shineColor="#1a9f9a"
            spread={90}
            direction="left"
          />
        </h2>

        {/* Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <StatCard key={s.label} {...s} started={started} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
