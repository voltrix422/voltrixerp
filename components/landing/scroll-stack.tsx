"use client"

import { useLayoutEffect, useRef, useCallback } from "react"
import Lenis from "lenis"

export const ScrollStackItem = ({
  children,
  itemClassName = "",
}: {
  children: React.ReactNode
  itemClassName?: string
}) => (
  <div className={`scroll-stack-card ${itemClassName}`.trim()}>{children}</div>
)

interface ScrollStackProps {
  children: React.ReactNode
  className?: string
  itemDistance?: number
  itemScale?: number
  itemStackDistance?: number
  stackPosition?: string
  scaleEndPosition?: string
  baseScale?: number
  scaleDuration?: number
  rotationAmount?: number
  blurAmount?: number
  useWindowScroll?: boolean
  onStackComplete?: () => void
}

const ScrollStack = ({
  children,
  className = "",
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = "20%",
  scaleEndPosition = "10%",
  baseScale = 0.85,
  rotationAmount = 0,
  blurAmount = 0,
  useWindowScroll = false,
  onStackComplete,
}: ScrollStackProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const stackCompletedRef = useRef(false)
  const animationFrameRef = useRef<number | null>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const cardsRef = useRef<HTMLElement[]>([])
  const lastTransformsRef = useRef(new Map())
  const isUpdatingRef = useRef(false)

  const calculateProgress = useCallback((scrollTop: number, start: number, end: number) => {
    if (scrollTop < start) return 0
    if (scrollTop > end) return 1
    return (scrollTop - start) / (end - start)
  }, [])

  const parsePercentage = useCallback((value: string | number, containerHeight: number) => {
    if (typeof value === "string" && value.includes("%")) {
      return (parseFloat(value) / 100) * containerHeight
    }
    return parseFloat(value as string)
  }, [])

  const getScrollData = useCallback(() => {
    if (useWindowScroll) {
      return { scrollTop: window.scrollY, containerHeight: window.innerHeight }
    }
    const scroller = scrollerRef.current!
    return { scrollTop: scroller.scrollTop, containerHeight: scroller.clientHeight }
  }, [useWindowScroll])

  const getElementOffset = useCallback((element: HTMLElement) => {
    if (useWindowScroll) {
      return element.getBoundingClientRect().top + window.scrollY
    }
    return element.offsetTop
  }, [useWindowScroll])

  const updateCardTransforms = useCallback(() => {
    if (!cardsRef.current.length || isUpdatingRef.current) return
    isUpdatingRef.current = true
    const { scrollTop, containerHeight } = getScrollData()
    const stackPositionPx = parsePercentage(stackPosition, containerHeight)
    const scaleEndPositionPx = parsePercentage(scaleEndPosition, containerHeight)
    const endEl = useWindowScroll
      ? document.querySelector(".scroll-stack-end")
      : scrollerRef.current?.querySelector(".scroll-stack-end")
    const endElementTop = endEl ? getElementOffset(endEl as HTMLElement) : 0

    cardsRef.current.forEach((card, i) => {
      if (!card) return
      const cardTop = getElementOffset(card)
      const triggerStart = cardTop - stackPositionPx - itemStackDistance * i
      const triggerEnd = cardTop - scaleEndPositionPx
      const pinStart = cardTop - stackPositionPx - itemStackDistance * i
      const pinEnd = endElementTop - containerHeight / 2
      const scaleProgress = calculateProgress(scrollTop, triggerStart, triggerEnd)
      const targetScale = baseScale + i * itemScale
      const scale = 1 - scaleProgress * (1 - targetScale)
      const rotation = rotationAmount ? i * rotationAmount * scaleProgress : 0
      let blur = 0
      if (blurAmount) {
        let topCardIndex = 0
        for (let j = 0; j < cardsRef.current.length; j++) {
          const jCardTop = getElementOffset(cardsRef.current[j])
          const jTriggerStart = jCardTop - stackPositionPx - itemStackDistance * j
          if (scrollTop >= jTriggerStart) topCardIndex = j
        }
        if (i < topCardIndex) blur = Math.max(0, (topCardIndex - i) * blurAmount)
      }
      let translateY = 0
      const isPinned = scrollTop >= pinStart && scrollTop <= pinEnd
      if (isPinned) translateY = scrollTop - cardTop + stackPositionPx + itemStackDistance * i
      else if (scrollTop > pinEnd) translateY = pinEnd - cardTop + stackPositionPx + itemStackDistance * i

      const newT = {
        translateY: Math.round(translateY * 100) / 100,
        scale: Math.round(scale * 1000) / 1000,
        rotation: Math.round(rotation * 100) / 100,
        blur: Math.round(blur * 100) / 100,
      }
      const last = lastTransformsRef.current.get(i)
      const changed = !last ||
        Math.abs(last.translateY - newT.translateY) > 0.1 ||
        Math.abs(last.scale - newT.scale) > 0.001 ||
        Math.abs(last.rotation - newT.rotation) > 0.1 ||
        Math.abs(last.blur - newT.blur) > 0.1

      if (changed) {
        card.style.transform = `translate3d(0,${newT.translateY}px,0) scale(${newT.scale}) rotate(${newT.rotation}deg)`
        card.style.filter = newT.blur > 0 ? `blur(${newT.blur}px)` : ""
        lastTransformsRef.current.set(i, newT)
      }

      if (i === cardsRef.current.length - 1) {
        const inView = scrollTop >= pinStart && scrollTop <= pinEnd
        if (inView && !stackCompletedRef.current) { stackCompletedRef.current = true; onStackComplete?.() }
        else if (!inView && stackCompletedRef.current) stackCompletedRef.current = false
      }
    })
    isUpdatingRef.current = false
  }, [itemScale, itemStackDistance, stackPosition, scaleEndPosition, baseScale, rotationAmount, blurAmount, useWindowScroll, onStackComplete, calculateProgress, parsePercentage, getScrollData, getElementOffset])

  const setupLenis = useCallback(() => {
    if (useWindowScroll) {
      const lenis = new Lenis({ duration: 1.2, smoothWheel: true, lerp: 0.1 })
      lenis.on("scroll", updateCardTransforms)
      const raf = (time: number) => { lenis.raf(time); animationFrameRef.current = requestAnimationFrame(raf) }
      animationFrameRef.current = requestAnimationFrame(raf)
      lenisRef.current = lenis
    } else {
      const scroller = scrollerRef.current
      if (!scroller) return
      const lenis = new Lenis({
        wrapper: scroller,
        content: scroller.querySelector(".scroll-stack-inner") as HTMLElement,
        duration: 1.2, smoothWheel: true, lerp: 0.1,
      })
      lenis.on("scroll", updateCardTransforms)
      const raf = (time: number) => { lenis.raf(time); animationFrameRef.current = requestAnimationFrame(raf) }
      animationFrameRef.current = requestAnimationFrame(raf)
      lenisRef.current = lenis
    }
  }, [updateCardTransforms, useWindowScroll])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const cards = Array.from(
      useWindowScroll ? document.querySelectorAll(".scroll-stack-card") : scroller.querySelectorAll(".scroll-stack-card")
    ) as HTMLElement[]
    cardsRef.current = cards
    cards.forEach((card, i) => {
      if (i < cards.length - 1) card.style.marginBottom = `${itemDistance}px`
      card.style.willChange = "transform, filter"
      card.style.transformOrigin = "top center"
      card.style.backfaceVisibility = "hidden"
    })
    setupLenis()
    updateCardTransforms()
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      lenisRef.current?.destroy()
      stackCompletedRef.current = false
      cardsRef.current = []
      lastTransformsRef.current.clear()
      isUpdatingRef.current = false
    }
  }, [itemDistance, itemScale, itemStackDistance, stackPosition, scaleEndPosition, baseScale, rotationAmount, blurAmount, useWindowScroll, onStackComplete, setupLenis, updateCardTransforms])

  return (
    <div
      ref={scrollerRef}
      className={`scroll-stack-scroller ${className}`.trim()}
      style={{ position: "relative", width: "100%", height: "100%", overflowY: "auto", overflowX: "visible", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" as never }}
    >
      <div className="scroll-stack-inner" style={{ padding: "2vh 0 30rem", minHeight: "100vh" }}>
        {children}
        <div className="scroll-stack-end" style={{ width: "100%", height: "1px" }} />
      </div>
    </div>
  )
}

export default ScrollStack
