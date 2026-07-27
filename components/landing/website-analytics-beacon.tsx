"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { isPublicAnalyticsPath, featureDisplayLabel } from "@/lib/website-analytics"

const VISITOR_KEY = "vx_web_vid"
const SESSION_KEY = "vx_web_sid"

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = uid("v")
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return uid("v")
  }
}

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = uid("s")
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return uid("s")
  }
}

const COLLECT_URL = "/api/site/collect"

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload)
  // Prefer fetch — avoid /analytics URLs (blocked by many ad blockers) and unreliable sendBeacon JSON parsing
  void fetch(COLLECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {})
}

const HOME_FEATURES = [
  { key: "home", sel: "#home" },
  { key: "featured-product", sel: "#featured-product" },
  { key: "products", sel: "#products" },
  { key: "testimonials", sel: "#testimonials" },
  { key: "stats", sel: "#stats" },
  { key: "mission", sel: "#mission" },
  { key: "services", sel: "#services" },
  { key: "vision", sel: "#vision" },
  { key: "rd", sel: "#rd" },
  { key: "about", sel: "#about" },
  { key: "faq", sel: "#faq" },
  { key: "contact", sel: "#contact" },
]

/**
 * Anonymous public-website analytics beacon.
 * Mount only on marketing pages (via Navbar).
 */
export function WebsiteAnalyticsBeacon() {
  const pathname = usePathname() || "/"
  const pageviewIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<number>(Date.now())
  const pathRef = useRef(pathname)
  const featureAccumRef = useRef<Map<string, number>>(new Map())
  const featureVisibleSinceRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!isPublicAnalyticsPath(pathname)) return

    const visitorId = getVisitorId()
    const sessionId = getSessionId()

    // Flush previous page dwell
    flushPage(pathRef.current, visitorId, sessionId)
    flushFeatures(pathRef.current, visitorId, sessionId)

    pathRef.current = pathname
    startedAtRef.current = Date.now()
    pageviewIdRef.current = null
    featureAccumRef.current = new Map()
    featureVisibleSinceRef.current = new Map()

    void fetch(COLLECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "pageview",
        path: pathname,
        title: typeof document !== "undefined" ? document.title : "",
        referrer: typeof document !== "undefined" ? document.referrer : "",
        visitorId,
        sessionId,
      }),
      keepalive: true,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.pageviewId) pageviewIdRef.current = d.pageviewId
      })
      .catch(() => {})

    const heartbeat = window.setInterval(() => {
      const durationMs = Date.now() - startedAtRef.current
      send({
        type: "heartbeat",
        path: pathname,
        visitorId,
        sessionId,
        pageviewId: pageviewIdRef.current,
        durationMs,
      })
    }, 30000)

    const onHide = () => {
      flushPage(pathname, visitorId, sessionId)
      flushFeatures(pathname, visitorId, sessionId)
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") onHide()
    }
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("pagehide", onHide)

    // Section / feature observers (homepage + any [data-analytics-feature])
    const observers: IntersectionObserver[] = []
    const watch = (key: string, el: Element) => {
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
              if (!featureVisibleSinceRef.current.has(key)) {
                featureVisibleSinceRef.current.set(key, Date.now())
              }
            } else if (featureVisibleSinceRef.current.has(key)) {
              const since = featureVisibleSinceRef.current.get(key)!
              const add = Date.now() - since
              featureAccumRef.current.set(
                key,
                (featureAccumRef.current.get(key) || 0) + add,
              )
              featureVisibleSinceRef.current.delete(key)
            }
          }
        },
        { threshold: [0.35] },
      )
      obs.observe(el)
      observers.push(obs)
    }

    // Delay so DOM sections exist
    const t = window.setTimeout(() => {
      for (const f of HOME_FEATURES) {
        const el = document.querySelector(f.sel)
        if (el) watch(f.key, el)
      }
      document.querySelectorAll<HTMLElement>("[data-analytics-feature]").forEach((el) => {
        const key = el.dataset.analyticsFeature
        if (key) watch(key, el)
      })
    }, 400)

    return () => {
      window.clearInterval(heartbeat)
      window.clearTimeout(t)
      observers.forEach((o) => o.disconnect())
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("pagehide", onHide)
      flushPage(pathname, visitorId, sessionId)
      flushFeatures(pathname, visitorId, sessionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function flushPage(path: string, visitorId: string, sessionId: string) {
    if (!isPublicAnalyticsPath(path)) return
    const durationMs = Date.now() - startedAtRef.current
    if (durationMs < 300) return
    send({
      type: "page_leave",
      path,
      visitorId,
      sessionId,
      pageviewId: pageviewIdRef.current,
      durationMs,
    })
  }

  function flushFeatures(path: string, visitorId: string, sessionId: string) {
    if (!isPublicAnalyticsPath(path)) return
    // Close currently visible
    for (const [key, since] of featureVisibleSinceRef.current.entries()) {
      featureAccumRef.current.set(
        key,
        (featureAccumRef.current.get(key) || 0) + (Date.now() - since),
      )
    }
    featureVisibleSinceRef.current.clear()

    for (const [key, durationMs] of featureAccumRef.current.entries()) {
      if (durationMs < 800) continue
      send({
        type: "feature",
        path,
        featureKey: key,
        featureLabel: featureDisplayLabel(key),
        visitorId,
        sessionId,
        durationMs,
      })
    }
    featureAccumRef.current.clear()
  }

  return null
}
