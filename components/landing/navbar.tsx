// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import Image from "next/image"
import { GetQuoteButton } from "@/components/ui/get-quote-button"
import { usePathname } from "next/navigation"

const links = [
  { label: "Products",            hash: "products"  },
  { label: "Solar Calculator",    href: "/solar-calculator" },
  { label: "Services",            hash: "services"  },
  { label: "Vision & Mission",    hash: "vision"    },
  { label: "R&D & Manufacturing", hash: "rd"        },
  { label: "About Us",            hash: "about"     },
  { label: "Contact",             hash: "contact"   },
  { label: "Dealerships",         href: "/dealerships" },
  { label: "Warranty",            href: "/warranty" },
  { label: "ERP",                 href: "/login" },
]

const primaryLinks = links.slice(0, 7)
const locationLinks = links.slice(7)

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

  const dividerClass = transparent
    ? "border-white/20"
    : "border-neutral-200/80"

  const toggleClass = transparent
    ? "text-white hover:text-white/70"
    : "text-neutral-400 hover:text-neutral-900"

  const logoClass = transparent
    ? "h-7 w-auto object-contain brightness-0 invert"
    : "h-7 w-auto object-contain"

  return (
    <div
      className="fixed top-4 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-20px)",
        transition: "opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <nav
        className={`relative grid grid-cols-[auto_1fr_auto] items-center gap-x-4 xl:gap-x-6 px-4 sm:px-6 xl:px-8 py-2.5 rounded-xl w-full max-w-7xl transition-all duration-500 ${navClass}`}
      >
        <a href="/" onClick={closeMenu} className="shrink-0 flex items-center">
          <Image
            src="/logo.png"
            alt="Voltrix"
            width={100}
            height={32}
            className={`${logoClass} h-7 w-auto min-w-[88px]`}
            priority
          />
        </a>

        <div className="hidden lg:flex items-center justify-center min-w-0">
          <div className="flex items-center gap-x-4 xl:gap-x-5">
            {primaryLinks.map((l) => (
              <a
                key={l.label}
                href={l.href || getHref(l.hash)}
                className={`text-sm xl:text-[15px] transition-colors font-medium whitespace-nowrap cursor-pointer ${linkClass}`}
                style={{ letterSpacing: "-0.3px" }}
              >
                {l.label}
              </a>
            ))}
          </div>
          <span className={`hidden xl:block w-px h-4 mx-3 xl:mx-4 shrink-0 border-l ${dividerClass}`} aria-hidden />
          <div className="flex items-center gap-x-4 xl:gap-x-5">
            {locationLinks.map((l) => (
              <a
                key={l.label}
                href={l.href || getHref(l.hash)}
                className={`text-sm xl:text-[15px] transition-colors font-medium whitespace-nowrap cursor-pointer ${linkClass}`}
                style={{ letterSpacing: "-0.3px" }}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

        <div className={`hidden lg:flex shrink-0 items-center pl-4 xl:pl-6 ml-1 border-l ${dividerClass}`}>
          <GetQuoteButton variant={transparent ? "ghost" : "solid"} />
        </div>

        <button
          className={`lg:hidden col-start-3 transition-colors ${toggleClass}`}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </nav>

      {open && (
        <div className="absolute top-14 left-4 right-4 bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl p-5 flex flex-col gap-4 lg:hidden">
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
