// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import Image from "next/image"

export default function WhatsappButton() {
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPopup(true)
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
          <button
            onClick={() => setShowPopup(false)}
            className="w-3.5 h-3.5 flex items-center justify-center rounded text-neutral-300 hover:text-neutral-500 transition-colors text-[10px] leading-none cursor-pointer"
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
        className="w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200"
        aria-label="Chat on WhatsApp"
      >
        <Image src="/whatsapp.png" alt="WhatsApp" width={28} height={28} className="w-7 h-7 object-contain" />
      </a>
    </div>
  )
}
