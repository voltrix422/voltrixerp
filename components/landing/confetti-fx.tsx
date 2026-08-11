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

function spawnPiece(w: number, h: number, navbarBias = false): Piece {
  const x = navbarBias ? w * (0.08 + Math.random() * 0.84) : Math.random() * w
  const y = navbarBias ? -20 - Math.random() * 80 : -20 - Math.random() * h * 0.4
  return {
    x,
    y,
    w: 4 + Math.random() * 7,
    h: 10 + Math.random() * 16,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.14,
    vx: (Math.random() - 0.5) * 1.4,
    vy: 1.2 + Math.random() * 2.2,
    opacity: 0.75 + Math.random() * 0.25,
  }
}

function initPieces(w: number, h: number, count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const p = spawnPiece(w, h, i % 3 === 0)
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

      const count = w < 640 ? 70 : w < 1024 ? 100 : 130
      if (piecesRef.current.length === 0) {
        piecesRef.current = initPieces(w, h, count)
      }
    }

    setSize()
    window.addEventListener("resize", setSize)

    const tick = () => {
      const { w, h } = sizeRef.current
      tickRef.current += 1
      ctx.clearRect(0, 0, w, h)

      for (const p of piecesRef.current) {
        p.vy = Math.min(p.vy + 0.045, 5.5)
        p.vx += Math.sin(tickRef.current * 0.02 + p.x * 0.01) * 0.015
        p.vx *= 0.992
        p.x += p.vx
        p.y += p.vy
        p.rot += p.spin

        if (p.y > h + 30 || p.x < -30 || p.x > w + 30) {
          const navbarZone = Math.random() < 0.45
          Object.assign(p, spawnPiece(w, h, navbarZone))
        }

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      // Extra navbar shower every few frames
      if (tickRef.current % 18 === 0) {
        const extra = piecesRef.current[Math.floor(Math.random() * piecesRef.current.length)]
        if (extra) Object.assign(extra, spawnPiece(w, h, true))
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("resize", setSize)
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
