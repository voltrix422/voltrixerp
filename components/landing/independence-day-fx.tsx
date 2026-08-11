"use client"

/**
 * 14 August Independence Day celebration FX:
 * floating green/white balloons (cursor-interactive), side flags & flares.
 * Active during early–mid August.
 */
import { useEffect, useRef, useState } from "react"

const PK_FLAG =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Flag_of_Pakistan.svg/320px-Flag_of_Pakistan.svg.png"

type Balloon = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: "green" | "white"
  rot: number
  spin: number
  el: HTMLDivElement | null
}

function isIndependenceSeason(d = new Date()) {
  return d.getMonth() === 7 && d.getDate() >= 1 && d.getDate() <= 20
}

function BalloonSvg({ color, size }: { color: "green" | "white"; size: number }) {
  const fill = color === "green" ? "#01411C" : "#ffffff"
  const stroke = color === "green" ? "#0a5c2e" : "#e5e5e5"
  return (
    <svg width={size} height={size * 1.35} viewBox="0 0 40 54" aria-hidden>
      <ellipse cx="20" cy="18" rx="15" ry="17" fill={fill} stroke={stroke} strokeWidth="1.2" />
      <path d="M20 35 L17 39 L23 39 Z" fill={fill} stroke={stroke} strokeWidth="0.8" />
      <path
        d="M20 39 Q18 44 21 48 Q23 52 19 54"
        fill="none"
        stroke={color === "green" ? "#86efac" : "#a3a3a3"}
        strokeWidth="1"
      />
      <ellipse cx="14" cy="12" rx="4" ry="6" fill="white" opacity={color === "green" ? 0.22 : 0.45} />
    </svg>
  )
}

export default function IndependenceDayFx() {
  const [active, setActive] = useState(false)
  const [ready, setReady] = useState(false)
  const [seed, setSeed] = useState<Balloon[]>([])
  const balloonsRef = useRef<Balloon[]>([])
  const rafRef = useRef(0)
  const pointerRef = useRef({ x: -9999, y: -9999, prevX: -9999, prevY: -9999 })

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (!isIndependenceSeason()) return
    setActive(true)
  }, [])

  useEffect(() => {
    if (!active) return

    const w = window.innerWidth
    const h = window.innerHeight
    const count = w < 640 ? 8 : w < 1024 ? 12 : 16
    const list: Balloon[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * w,
      y: h + 40 + Math.random() * 180,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(0.35 + Math.random() * 0.55),
      r: 18 + Math.random() * 16,
      color: i % 2 === 0 ? ("green" as const) : ("white" as const),
      rot: (Math.random() - 0.5) * 20,
      spin: (Math.random() - 0.5) * 0.4,
      el: null,
    }))
    balloonsRef.current = list
    setSeed(list)

    const t = window.setTimeout(() => setReady(true), 60)

    const onMove = (e: PointerEvent) => {
      const p = pointerRef.current
      p.prevX = p.x
      p.prevY = p.y
      p.x = e.clientX
      p.y = e.clientY
    }
    window.addEventListener("pointermove", onMove, { passive: true })

    const tick = () => {
      const ww = window.innerWidth
      const hh = window.innerHeight
      const p = pointerRef.current
      const mx = p.x - p.prevX
      const my = p.y - p.prevY
      const speed = Math.hypot(mx, my)

      for (const b of balloonsRef.current) {
        b.vx += (Math.random() - 0.5) * 0.02
        b.vy += -0.002 + (Math.random() - 0.5) * 0.01
        b.vx *= 0.995
        b.vy *= 0.998

        const dx = b.x - p.x
        const dy = b.y - p.y
        const dist = Math.hypot(dx, dy)
        const hitR = b.r + 28
        if (dist < hitR && dist > 0.1) {
          const force = ((hitR - dist) / hitR) * (0.9 + Math.min(speed, 40) * 0.08)
          b.vx += (dx / dist) * force
          b.vy += (dy / dist) * force
          b.spin += (mx + my) * 0.02
        }

        b.x += b.vx
        b.y += b.vy
        b.rot += b.spin
        b.spin *= 0.98

        if (b.y < -60) {
          b.y = hh + 40
          b.x = Math.random() * ww
          b.vy = -(0.35 + Math.random() * 0.45)
        }
        if (b.x < -50) b.x = ww + 40
        if (b.x > ww + 50) b.x = -40
        if (b.x < b.r) b.vx = Math.abs(b.vx) * 0.8
        if (b.x > ww - b.r) b.vx = -Math.abs(b.vx) * 0.8

        if (b.el) {
          b.el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.rot}deg)`
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.clearTimeout(t)
      window.removeEventListener("pointermove", onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  if (!active) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[45] overflow-hidden" aria-hidden>
      {/* Side flares — left */}
      <div
        className={`absolute left-0 top-0 h-full w-16 sm:w-24 transition-all duration-1000 ease-out ${
          ready ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
        }`}
      >
        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#01411C]/25 via-[#01411C]/8 to-transparent" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PK_FLAG}
          alt=""
          className="absolute left-1 top-[18%] h-10 w-auto rounded-sm shadow-lg ring-1 ring-white/40 opacity-90 sm:h-12"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PK_FLAG}
          alt=""
          className="absolute left-1 bottom-[22%] h-9 w-auto rounded-sm shadow-lg ring-1 ring-white/40 opacity-80 sm:h-11"
        />
      </div>

      {/* Side flares — right */}
      <div
        className={`absolute right-0 top-0 h-full w-16 sm:w-24 transition-all duration-1000 ease-out delay-150 ${
          ready ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
        }`}
      >
        <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-[#01411C]/25 via-[#01411C]/8 to-transparent" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PK_FLAG}
          alt=""
          className="absolute right-1 top-[28%] h-10 w-auto rounded-sm shadow-lg ring-1 ring-white/40 opacity-90 sm:h-12"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PK_FLAG}
          alt=""
          className="absolute right-1 bottom-[18%] h-9 w-auto rounded-sm shadow-lg ring-1 ring-white/40 opacity-80 sm:h-11"
        />
      </div>

      {seed.map((b, i) => (
        <div
          key={b.id}
          ref={(el) => {
            const target = balloonsRef.current.find((x) => x.id === b.id)
            if (target) target.el = el
          }}
          className="absolute will-change-transform drop-shadow-lg"
          style={{
            left: 0,
            top: 0,
            width: b.r * 2,
            height: b.r * 2.7,
            transform: `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.rot}deg) scale(${ready ? 1 : 0.15})`,
            opacity: ready ? 0.92 : 0,
            transition: ready ? undefined : `opacity 0.7s ease ${i * 40}ms`,
            filter: b.color === "white" ? "drop-shadow(0 4px 8px rgba(0,0,0,0.18))" : undefined,
          }}
        >
          <BalloonSvg color={b.color} size={b.r * 2} />
        </div>
      ))}
    </div>
  )
}
