"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

export const POST_LOGIN_SPLASH_KEY = "voltrix-post-login-splash"

type Props = {
  /** When true, force-show (e.g. overlay on the login page right after sign-in). */
  force?: boolean
  onDone?: () => void
}

/** Bold logo animation after a successful ERP sign-in. */
export function PostLoginSplash({ force = false, onDone }: Props = {}) {
  const [active, setActive] = useState(force)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    let fadeTimer: number | undefined
    let doneTimer: number | undefined

    if (!force) {
      try {
        if (sessionStorage.getItem(POST_LOGIN_SPLASH_KEY) !== "1") return
        sessionStorage.removeItem(POST_LOGIN_SPLASH_KEY)
      } catch {
        return
      }
      setActive(true)
    }

    fadeTimer = window.setTimeout(() => setFading(true), 2100)
    doneTimer = window.setTimeout(() => {
      setActive(false)
      onDone?.()
    }, 2600)

    return () => {
      if (fadeTimer) window.clearTimeout(fadeTimer)
      if (doneTimer) window.clearTimeout(doneTimer)
    }
  }, [force, onDone])

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
      {/* Energy rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="voltrix-splash-ring voltrix-splash-ring-a" />
        <span className="voltrix-splash-ring voltrix-splash-ring-b" />
        <span className="voltrix-splash-ring voltrix-splash-ring-c" />
      </div>

      {/* Soft glow bloom */}
      <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-[#2dd4bf]/25 blur-3xl voltrix-splash-bloom" />

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
        @keyframes voltrixSplashRing {
          0% { opacity: 0.85; transform: scale(0.2); }
          100% { opacity: 0; transform: scale(2.4); }
        }
        @keyframes voltrixSplashBloom {
          0%, 100% { opacity: 0.35; transform: scale(0.9); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        .voltrix-splash-logo {
          animation: voltrixSplashLogo 1.35s cubic-bezier(0.22, 1, 0.36, 1) both;
          filter: drop-shadow(0 0 28px rgba(45, 212, 191, 0.55));
        }
        .voltrix-splash-ring {
          position: absolute;
          border-radius: 9999px;
          border: 2px solid rgba(45, 212, 191, 0.55);
          width: 8rem;
          height: 8rem;
        }
        .voltrix-splash-ring-a { animation: voltrixSplashRing 1.6s ease-out 0.15s both; }
        .voltrix-splash-ring-b {
          width: 11rem; height: 11rem;
          border-color: rgba(153, 246, 228, 0.4);
          animation: voltrixSplashRing 1.8s ease-out 0.35s both;
        }
        .voltrix-splash-ring-c {
          width: 14rem; height: 14rem;
          border-color: rgba(45, 212, 191, 0.25);
          animation: voltrixSplashRing 2s ease-out 0.55s both;
        }
        .voltrix-splash-bloom {
          animation: voltrixSplashBloom 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
