// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import Image from "next/image"
import { usePathname } from "next/navigation"

const links = [
  { label: "Products",           hash: "products"  },
  { label: "Services",           hash: "services"  },
  { label: "Vision & Mission",   hash: "vision"    },
  { label: "R&D & Manufacturing",hash: "rd"        },
  { label: "About Us",           hash: "about"     },
  { label: "Contact",            hash: "contact"   },
  { label: "Warranty",           href: "/warranty" },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const isHome = pathname === "/"

  const getHref = (hash?: string) => hash ? (isHome ? `#${hash}` : `/#${hash}`) : ""

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  // Show navbar immediately
  useEffect(() => {
    setVisible(true)
  }, [])

  return (
    <div
      className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-20px)",
        transition: "opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <nav
        className={`flex items-center justify-between px-8 py-2.5 rounded-xl border w-full max-w-6xl mx-4 transition-all duration-500 ${
          scrolled
            ? "bg-white border-neutral-200"
            : "bg-white border-neutral-200"
        }`}
      >
        {/* Logo */}
        <a href="/">
          <Image
            src="/logo.png"
            alt="Voltrix"
            width={100}
            height={32}
            className="h-7 w-auto object-contain"
          />
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">{links.map((l) => <a key={l.label} href={l.href || getHref(l.hash)} className="text-base text-neutral-900 hover:text-neutral-500 transition-colors font-medium whitespace-nowrap cursor-pointer" style={{ letterSpacing: '-0.5px' }}>{l.label}</a>)}</div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-6">
          <a
            href="/quote"
            className="group relative flex items-center gap-2 pl-4 pr-1.5 h-9 rounded-full text-base font-medium text-white transition-all duration-300 hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: "#1a9f9a" }}
          >
            <span className="transition-transform duration-300 group-hover:-translate-x-0.5">Get a quote</span>
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 group-hover:bg-white/30 transition-all duration-300 group-hover:translate-x-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </a>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-neutral-400 hover:text-neutral-900 transition-colors" onClick={() => setOpen(!open)}>
          {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </nav>

      {open && (
        <div className="absolute top-14 left-4 right-4 bg-white border border-neutral-200 rounded-2xl shadow-xl p-5 flex flex-col gap-4 md:hidden">
          {links.map((l) => (
            <a key={l.label} href={l.href || getHref(l.hash)} className="text-base text-neutral-900 hover:text-neutral-500 transition-colors font-medium cursor-pointer">
              {l.label}
            </a>
          ))}
          <div className="pt-3 border-t border-neutral-100">
            <a href="#" className="flex items-center justify-center gap-2 h-10 rounded-full text-base font-medium text-black bg-white border border-neutral-200">
              Get started
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
