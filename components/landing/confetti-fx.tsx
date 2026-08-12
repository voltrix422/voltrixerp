"use client"

import { useEffect, useRef, useState } from "react"

const COLORS = [
  "#ef4444",
  "#3b82f6",
  "#eab308",
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#ec4899",
  "#ffffff",
  "#01411C",
  "#86efac",
]

const BURST_SESSION_KEY = "voltrix-confetti-burst-done"

type Phase = "burst" | "flat"

type Piece = {
  x: number
  y: number
  w: number
  h: number
  color: string
  rot: number
  spin: number
  vx: number
  vy: number
  opacity: number
}

function isIndependenceSeason(d = new Date()) {
  return d.getMonth() === 7 && d.getDate() >= 1 && d.getDate() <= 20
}

function spawnBurstPiece(originX: number, originY: number): Piece {
  const angle = Math.random() * Math.PI * 2
  const speed = 7 + Math.random() * 16
  return {
    x: originX + (Math.random() - 0.5) * 24,
    y: originY + (Math.random() - 0.5) * 16,
    w: 4 + Math.random() * 6,
    h: 10 + Math.random() * 18,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.28,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 3,
    opacity: 1,
  }
}

function spawnFlatPiece(w: number, h: number): Piece {
  return {
    x: Math.random() * w,
    y: -16 - Math.random() * h * 0.15,
    w: 9 + Math.random() * 12,
    h: 3 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: (Math.random() - 0.5) * 0.35,
    spin: (Math.random() - 0.5) * 0.018,
    vx: (Math.random() - 0.5) * 0.7,
    vy: 0.7 + Math.random() * 1.1,
    opacity: 0.65 + Math.random() * 0.25,
  }
}

function createBurst(w: number, h: number): Piece[] {
  const origins = [
    { x: w * 0.5, y: Math.min(h * 0.14, 96) },
    { x: w * 0.18, y: Math.min(h * 0.1, 72) },
    { x: w * 0.82, y: Math.min(h * 0.1, 72) },
  ]
  const perOrigin = w < 640 ? 45 : w < 1024 ? 60 : 75
  const pieces: Piece[] = []
  for (const o of origins) {
    for (let i = 0; i < perOrigin; i++) {
      pieces.push(spawnBurstPiece(o.x, o.y))
    }
  }
  return pieces
}

function createFlatField(w: number, h: number): Piece[] {
  const count = w < 640 ? 45 : w < 1024 ? 65 : 85
  return Array.from({ length: count }, () => {
    const p = spawnFlatPiece(w, h)
    p.y = Math.random() * h
    return p
  })
}

export default function ConfettiFx() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const piecesRef = useRef<Piece[]>([])
  const rafRef = useRef(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  const tickRef = useRef(0)
  const phaseRef = useRef<Phase>("burst")
  const burstUntilRef = useRef(0)
  const pointerRef = useRef({ x: -9999, y: -9999, prevX: -9999, prevY: -9999 })
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (!isIndependenceSeason()) return
    setActive(true)
  }, [])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const alreadyBurst =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(BURST_SESSION_KEY) === "1"

    const setSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      sizeRef.current = { w, h }
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (piecesRef.current.length === 0) {
        if (alreadyBurst) {
          phaseRef.current = "flat"
          piecesRef.current = createFlatField(w, h)
        } else {
          phaseRef.current = "burst"
          piecesRef.current = createBurst(w, h)
          burstUntilRef.current = performance.now() + 2200
          sessionStorage.setItem(BURST_SESSION_KEY, "1")
        }
      }
    }

    setSize()
    window.addEventListener("resize", setSize)

    const onMove = (e: PointerEvent) => {
      const ptr = pointerRef.current
      ptr.prevX = ptr.x
      ptr.prevY = ptr.y
      ptr.x = e.clientX
      ptr.y = e.clientY
    }
    window.addEventListener("pointermove", onMove, { passive: true })

    const tick = () => {
      const { w, h } = sizeRef.current
      const ptr = pointerRef.current
      const mx = ptr.x - ptr.prevX
      const my = ptr.y - ptr.prevY
      const pointerSpeed = Math.hypot(mx, my)
      tickRef.current += 1
      ctx.clearRect(0, 0, w, h)

      if (phaseRef.current === "burst" && performance.now() >= burstUntilRef.current) {
        phaseRef.current = "flat"
        piecesRef.current = createFlatField(w, h)
      }

      const flat = phaseRef.current === "flat"

      for (const p of piecesRef.current) {
        if (flat) {
          p.vy = Math.min(p.vy + 0.018, 2.4)
          p.vx += Math.sin(tickRef.current * 0.012 + p.x * 0.008) * 0.004
          p.vx *= 0.996
          p.spin *= 0.998
        } else {
          p.vy = Math.min(p.vy + 0.22, 9)
          p.vx *= 0.985
          p.spin *= 0.992
        }

        const hitR = Math.max(p.w, p.h) * 0.75 + (flat ? 26 : 34)
        const dx = p.x - ptr.x
        const dy = p.y - ptr.y
        const dist = Math.hypot(dx, dy)
        if (dist < hitR && dist > 0.1) {
          const base = flat ? 0.55 : 0.95
          const force = ((hitR - dist) / hitR) * (base + Math.min(pointerSpeed, 40) * (flat ? 0.05 : 0.08))
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
          p.spin += (mx + my) * (flat ? 0.012 : 0.022)
        }

        p.x += p.vx
        p.y += p.vy
        p.rot += p.spin

        if (p.y > h + 24 || p.x < -40 || p.x > w + 40) {
          if (flat) {
            Object.assign(p, spawnFlatPiece(w, h))
          } else {
            Object.assign(p, spawnBurstPiece(w * 0.5, Math.min(h * 0.12, 90)))
            p.vy = 2 + Math.random() * 3
            p.opacity = 0.4
          }
        }

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("resize", setSize)
      window.removeEventListener("pointermove", onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  if (!active) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[52] overflow-hidden" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 block" />
    </div>
  )
}
