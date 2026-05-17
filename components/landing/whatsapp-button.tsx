// @ts-nocheck
"use client"

import Image from "next/image"

export default function WhatsappButton() {
  return (
    <a
      href="https://wa.me/923034927779"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200"
      aria-label="Chat on WhatsApp"
    >
      <Image src="/whatsapp.png" alt="WhatsApp" width={28} height={28} className="w-7 h-7 object-contain" />
    </a>
  )
}
