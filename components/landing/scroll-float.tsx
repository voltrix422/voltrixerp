"use client"

import { useEffect, useMemo, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface ScrollFloatProps {
  children: string
  containerClassName?: string
  textClassName?: string
  animationDuration?: number
  ease?: string
  scrollStart?: string
  scrollEnd?: string
  stagger?: number
}

export default function ScrollFloat({
  children,
  containerClassName = "",
  textClassName = "",
  animationDuration = 1,
  ease = "back.inOut(2)",
  scrollStart = "center bottom+=50%",
  scrollEnd = "bottom bottom-=40%",
  stagger = 0.03,
}: ScrollFloatProps) {
  const containerRef = useRef<HTMLHeadingElement>(null)

  const splitText = useMemo(() => {
    return children.split("").map((char, i) => (
      <span className="char" key={i} style={{ display: "inline-block" }}>
        {char === " " ? "\u00A0" : char}
      </span>
    ))
  }, [children])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chars = el.querySelectorAll(".char")
    const ctx = gsap.context(() => {
      gsap.fromTo(
        chars,
        { willChange: "opacity, transform", opacity: 0, yPercent: 120, scaleY: 2.3, scaleX: 0.7, transformOrigin: "50% 0%" },
        {
          duration: animationDuration,
          ease,
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          stagger,
          scrollTrigger: { trigger: el, start: scrollStart, end: scrollEnd, scrub: true },
        }
      )
    }, el)
    return () => ctx.revert()
  }, [animationDuration, ease, scrollStart, scrollEnd, stagger])

  return (
    <h2
      ref={containerRef}
      className={containerClassName}
      style={{ overflow: "hidden" }}
      aria-label={children}
    >
      <span className={textClassName} style={{ display: "inline-block" }} aria-hidden="true">
        {splitText}
      </span>
    </h2>
  )
}
