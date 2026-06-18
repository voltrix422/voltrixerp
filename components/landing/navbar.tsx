// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import Image from "next/image"
import { GetQuoteButton } from "@/components/ui/get-quote-button"
import { usePathname } from "next/navigation"

const links = [
  { label: "Products",           hash: "products"  },
  { label: "Services",           hash: "services"  },
  { label: "Vision & Mission",   hash: "vision"    },
  { label: "R&D & Manufacturing",hash: "rd"        },
  { label: "About Us",           hash: "about"     },
  { label: "Contact",            hash: "contact"   },
  { label: "Outlets",            href: "/outlets"  },
  { label: "Warranty",           href: "/warranty" },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const isHome = pathname === "/"

  const transparent = isHome && !scrolled
  const glass = !transparent

  const getHref = (hash?: string) => hash ? (isHome ? `#${hash}` : `/#${hash}`) : ""
  const closeMenu = () => setOpen(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    handler()
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  useEffect(() => {
    closeMenu()
  }, [pathname])

  useEffect(() => {
    setVisible(true)
  }, [])

  const navClass = glass
    ? "bg-white/70 backdrop-blur-xl border-white/50 shadow-lg border"
    : "bg-transparent border-transparent shadow-none"

  const linkClass = transparent
    ? "text-white hover:text-white/70"
    : "text-neutral-900 hover:text-neutral-500"

  const toggleClass = transparent
    ? "text-white hover:text-white/70"
    : "text-neutral-400 hover:text-neutral-900"

  const logoClass = transparent
    ? "h-7 w-auto object-contain brightness-0 invert"
    : "h-7 w-auto object-contain"

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
        className={`flex items-center justify-between px-8 py-2.5 rounded-xl w-full max-w-6xl mx-4 transition-all duration-500 ${navClass}`}
      >
        <a href="/" onClick={closeMenu}>
          <Image
            src="/logo.png"
            alt="Voltrix"
            width={100}
            height={32}
            className={logoClass}
          />
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href || getHref(l.hash)}
              className={`text-base transition-colors font-medium whitespace-nowrap cursor-pointer ${linkClass}`}
              style={{ letterSpacing: "-0.5px" }}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-6">
          <GetQuoteButton variant={transparent ? "ghost" : "solid"} />
        </div>

        <button
          className={`md:hidden transition-colors ${toggleClass}`}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </nav>

      {open && (
        <div className="absolute top-14 left-4 right-4 bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl p-5 flex flex-col gap-4 md:hidden">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href || getHref(l.hash)}
              onClick={closeMenu}
              className="text-base text-neutral-900 hover:text-neutral-500 transition-colors font-medium cursor-pointer"
            >
              {l.label}
            </a>
          ))}
          <div className="pt-3 border-t border-neutral-100">
            <GetQuoteButton onClick={closeMenu} />
          </div>
        </div>
      )}
    </div>
  )
}
