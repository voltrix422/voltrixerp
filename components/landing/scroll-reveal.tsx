// @ts-nocheck
"use client"

import { useEffect, useRef, useMemo } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface ScrollRevealProps {
  children: string
  enableBlur?: boolean
  baseOpacity?: number
  baseRotation?: number
  blurStrength?: number
  containerClassName?: string
  textClassName?: string
  rotationEnd?: string
  wordAnimationEnd?: string
}

export default function ScrollReveal({
  children,
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  containerClassName = "",
  textClassName = "",
  rotationEnd = "bottom bottom",
  wordAnimationEnd = "bottom bottom",
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const splitText = useMemo(() => {
    return children.split(/(\s+)/).map((word, i) => {
      if (word.match(/^\s+$/)) return word
      return (
        <span className="word" key={i} style={{ display: "inline-block" }}>
          {word}
        </span>
      )
    })
  }, [children])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { transformOrigin: "0% 50%", rotate: baseRotation },
        { ease: "none", rotate: 0, scrollTrigger: { trigger: el, start: "top bottom", end: rotationEnd, scrub: true } }
      )
      const words = el.querySelectorAll(".word")
      gsap.fromTo(
        words,
        { opacity: baseOpacity, willChange: "opacity" },
        { ease: "none", opacity: 1, stagger: 0.05, scrollTrigger: { trigger: el, start: "top bottom-=20%", end: wordAnimationEnd, scrub: true } }
      )
      if (enableBlur) {
        gsap.fromTo(
          words,
          { filter: `blur(${blurStrength}px)` },
          { ease: "none", filter: "blur(0px)", stagger: 0.05, scrollTrigger: { trigger: el, start: "top bottom-=20%", end: wordAnimationEnd, scrub: true } }
        )
      }
    }, el)
    return () => ctx.revert()
  }, [enableBlur, baseRotation, baseOpacity, rotationEnd, wordAnimationEnd, blurStrength])

  return (
    <div ref={containerRef} className={containerClassName} style={{ margin: "20px 0" }}>
      <p className={textClassName} style={{ lineHeight: 1.6 }}>
        {splitText}
      </p>
    </div>
  )
}
