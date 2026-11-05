"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

export const POST_LOGIN_SPLASH_KEY = "voltrix-post-login-splash"
/** Marks that the ERP entry splash already ran this browser tab session. */
export const ERP_ENTRY_SPLASH_KEY = "voltrix-erp-entry-splash"

type Props = {
  /** When true, force-show (e.g. overlay on the login page right after sign-in). */
  force?: boolean
  /**
   * When true (ERP shell), show once per tab session for already-logged-in visits
   * as well as post-login landings that did not already play the force splash.
   */
  onErpEntry?: boolean
  onDone?: () => void
}

export function markErpEntrySplashDone() {
  try {
    sessionStorage.setItem(ERP_ENTRY_SPLASH_KEY, "1")
  } catch {
    // ignore
  }
}

/** Bold logo animation after sign-in / when opening the logged-in ERP screen. */
export function PostLoginSplash({ force = false, onErpEntry = false, onDone }: Props = {}) {
  const [active, setActive] = useState(force)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    let fadeTimer: number | undefined
    let doneTimer: number | undefined

    if (!force) {
      try {
        if (onErpEntry) {
          if (sessionStorage.getItem(ERP_ENTRY_SPLASH_KEY) === "1") return
          sessionStorage.setItem(ERP_ENTRY_SPLASH_KEY, "1")
        } else if (sessionStorage.getItem(POST_LOGIN_SPLASH_KEY) === "1") {
          sessionStorage.removeItem(POST_LOGIN_SPLASH_KEY)
          markErpEntrySplashDone()
        } else {
          return
        }
      } catch {
        if (!onErpEntry) return
      }
      setActive(true)
    } else {
      markErpEntrySplashDone()
    }

    // Navigating away: keep the splash fully opaque until onDone runs so the
    // login form never flashes between animation end and the next page.
    if (onDone) {
      doneTimer = window.setTimeout(() => {
        onDone()
      }, 2400)
    } else {
      fadeTimer = window.setTimeout(() => setFading(true), 2100)
      doneTimer = window.setTimeout(() => {
        setActive(false)
      }, 2600)
    }

    return () => {
      if (fadeTimer) window.clearTimeout(fadeTimer)
      if (doneTimer) window.clearTimeout(doneTimer)
    }
  }, [force, onErpEntry, onDone])

  if (!active) return null

  return (
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 45%, #0f766e 0%, #042f2e 45%, #020617 100%)",
      }}
      aria-hidden={fading}
    >
      <div className="relative z-10 flex items-center justify-center">
        <Image
          src="/logo.png"
          alt="Voltrix"
          width={360}
          height={280}
          priority
          className="h-32 sm:h-40 w-auto object-contain brightness-0 invert voltrix-splash-logo"
        />
      </div>

      <style>{`
        @keyframes voltrixSplashLogo {
          0% {
            opacity: 0;
            transform: scale(0.4);
            filter: blur(10px) brightness(1.8);
          }
          40% {
            opacity: 1;
            transform: scale(1.12);
            filter: blur(0) brightness(1.25);
          }
          65% {
            transform: scale(0.97);
            filter: brightness(1.08);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: brightness(1);
          }
        }
        .voltrix-splash-logo {
          animation: voltrixSplashLogo 1.35s cubic-bezier(0.22, 1, 0.36, 1) both;
          filter: drop-shadow(0 0 28px rgba(45, 212, 191, 0.55));
        }
      `}</style>
    </div>
  )
}
