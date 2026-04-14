// @ts-nocheck
"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"

export default function WhatsappButton() {
  const [showPopup, setShowPopup] = useState(false)
  const hasInteracted = useRef(false)
  const pendingSound = useRef(false)

  const playClick = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    } catch {}
  }

  useEffect(() => {
    const onInteract = () => {
      if (!hasInteracted.current) {
        hasInteracted.current = true
        if (pendingSound.current) {
          pendingSound.current = false
          playClick()
        }
      }
    }
    window.addEventListener("click", onInteract, { once: true })
    window.addEventListener("scroll", onInteract, { once: true })
    window.addEventListener("keydown", onInteract, { once: true })
    window.addEventListener("touchstart", onInteract, { once: true })
    return () => {
      window.removeEventListener("click", onInteract)
      window.removeEventListener("scroll", onInteract)
      window.removeEventListener("keydown", onInteract)
      window.removeEventListener("touchstart", onInteract)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPopup(true)
      if (hasInteracted.current) {
        playClick()
      } else {
        pendingSound.current = true
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">

      {/* Popup */}
      <div
        style={{
          opacity: showPopup ? 1 : 0,
          transform: showPopup ? "translateY(0) scale(1)" : "translateY(6px) scale(0.95)",
          transition: "opacity 0.4s cubic-bezier(0.34,1.56,0.64,1), transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          pointerEvents: showPopup ? "auto" : "none",
        }}
        className="relative"
      >
        {/* Bubble */}
        <div className="flex items-center gap-2 bg-white border border-neutral-100 rounded-xl shadow-lg shadow-neutral-200/60 px-3 py-1.5">
          {/* Green dot */}
          <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: "#25D366" }} />
          <span className="text-[11px] font-medium text-neutral-700 tracking-wide whitespace-nowrap">Let's chat</span>
          <button
            onClick={() => setShowPopup(false)}
            className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded text-neutral-300 hover:text-neutral-500 transition-colors text-[10px] leading-none cursor-pointer"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
        {/* Notch tail */}
        <div className="absolute -bottom-[7px] right-3.5 w-3 h-3 bg-white border-r border-b border-neutral-100 rotate-45" />
      </div>

      {/* WhatsApp icon */}
      <a
        href="https://wa.me/923034927779"
        target="_blank"
        rel="noopener noreferrer"
        onClick={playClick}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200"
        aria-label="Chat on WhatsApp"
      >
        <Image src="/whatsapp.png" alt="WhatsApp" width={28} height={28} className="w-7 h-7 object-contain" />
      </a>
    </div>
  )
}
