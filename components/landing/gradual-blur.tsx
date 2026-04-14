// @ts-nocheck
"use client"

import React, { useEffect, useRef, useState, useMemo } from "react"
import { pow, round } from "mathjs"

type Position = "top" | "bottom" | "left" | "right"
type Curve = "linear" | "bezier" | "ease-in" | "ease-out" | "ease-in-out"

interface GradualBlurProps {
  position?: Position
  strength?: number
  height?: string
  divCount?: number
  exponential?: boolean
  zIndex?: number
  opacity?: number
  curve?: Curve
  target?: "parent" | "page"
  className?: string
  style?: React.CSSProperties
}

const CURVE_FUNCTIONS: Record<Curve, (p: number) => number> = {
  linear:       p => p,
  bezier:       p => p * p * (3 - 2 * p),
  "ease-in":    p => p * p,
  "ease-out":   p => 1 - Math.pow(1 - p, 2),
  "ease-in-out":p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2,
}

const getGradientDirection = (pos: Position) =>
  ({ top: "to top", bottom: "to bottom", left: "to left", right: "to right" })[pos]

function GradualBlur({
  position = "bottom",
  strength = 2,
  height = "6rem",
  divCount = 5,
  exponential = false,
  zIndex = 10,
  opacity = 1,
  curve = "linear",
  target = "parent",
  className = "",
  style = {},
}: GradualBlurProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const blurDivs = useMemo(() => {
    const increment = 100 / divCount
    const curveFunc = CURVE_FUNCTIONS[curve] ?? CURVE_FUNCTIONS.linear
    const divs = []

    for (let i = 1; i <= divCount; i++) {
      const progress = curveFunc(i / divCount)
      const blurValue = exponential
        ? (pow(2, progress * 4) as number) * 0.0625 * strength
        : 0.0625 * (progress * divCount + 1) * strength

      const p1 = (round((increment * i - increment) * 10) as number) / 10
      const p2 = (round(increment * i * 10) as number) / 10
      const p3 = (round((increment * i + increment) * 10) as number) / 10
      const p4 = (round((increment * i + increment * 2) * 10) as number) / 10

      let gradient = `transparent ${p1}%, black ${p2}%`
      if (p3 <= 100) gradient += `, black ${p3}%`
      if (p4 <= 100) gradient += `, transparent ${p4}%`

      const direction = getGradientDirection(position)
      divs.push(
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            maskImage: `linear-gradient(${direction}, ${gradient})`,
            WebkitMaskImage: `linear-gradient(${direction}, ${gradient})`,
            backdropFilter: `blur(${blurValue.toFixed(3)}rem)`,
            WebkitBackdropFilter: `blur(${blurValue.toFixed(3)}rem)`,
            opacity,
          }}
        />
      )
    }
    return divs
  }, [position, strength, divCount, exponential, curve, opacity])

  const isVertical = position === "top" || position === "bottom"

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    zIndex,
    ...(isVertical
      ? { height, width: "100%", [position]: 0, left: 0, right: 0 }
      : { width: height, height: "100%", [position]: 0, top: 0, bottom: 0 }),
    ...style,
  }

  return (
    <div ref={containerRef} className={`gradual-blur ${className}`} style={containerStyle}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {blurDivs}
      </div>
    </div>
  )
}

const GradualBlurMemo = React.memo(GradualBlur)
GradualBlurMemo.displayName = "GradualBlur"
export default GradualBlurMemo
