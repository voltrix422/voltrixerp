"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

export const POST_LOGIN_SPLASH_KEY = "voltrix-post-login-splash"

/** Brief logo animation after a successful ERP sign-in, then reveal app. */
export function PostLoginSplash() {
  const [active, setActive] = useState(false)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    let fadeTimer: number | undefined
    let doneTimer: number | undefined
    try {
      if (sessionStorage.getItem(POST_LOGIN_SPLASH_KEY) !== "1") return
      sessionStorage.removeItem(POST_LOGIN_SPLASH_KEY)
    } catch {
      return
    }
    setActive(true)
    fadeTimer = window.setTimeout(() => setFading(true), 1500)
    doneTimer = window.setTimeout(() => setActive(false), 2000)
    return () => {
      if (fadeTimer) window.clearTimeout(fadeTimer)
      if (doneTimer) window.clearTimeout(doneTimer)
    }
  }, [])

  if (!active) return null

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-white transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden={fading}
    >
      <Image
        src="/logo.png"
        alt="Voltrix"
        width={280}
        height={210}
        priority
        className="h-28 sm:h-32 w-auto object-contain voltrix-post-login-splash-logo"
      />
      <style>{`
        @keyframes voltrixPostLoginSplashIn {
          0% { opacity: 0; transform: scale(0.9); }
          45% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        .voltrix-post-login-splash-logo {
          animation: voltrixPostLoginSplashIn 1.05s ease-out both;
        }
      `}</style>
    </div>
  )
}
