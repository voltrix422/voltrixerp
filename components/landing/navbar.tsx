"use client"

import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import Image from "next/image"
import { GetQuoteButton } from "@/components/ui/get-quote-button"
import { usePathname } from "next/navigation"

type NavLink = {
  label: string
  short?: string
  href?: string
  hash?: string
  accent?: boolean
}

/** Exact site nav order requested for the marketing site. */
const navLinks: NavLink[] = [
  { label: "Products", hash: "products" },
  { label: "Solar Calculator", short: "Calculator", href: "/solar-calculator" },
  { label: "Services", hash: "services" },
  { label: "Vision & Mission", short: "Vision", hash: "vision" },
  { label: "Technology & Partners", short: "Technology", hash: "rd" },
  { label: "About Us", short: "About", hash: "about" },
  { label: "Contact", hash: "contact" },
  { label: "Dealerships", href: "/dealerships" },
  { label: "Blog", href: "/blog" },
  { label: "Warranty", href: "/warranty" },
  { label: "Cashback", href: "/installer-cashback", accent: true },
  { label: "ERP", href: "/login" },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const isHome = pathname === "/"
  const isCashback = pathname === "/installer-cashback"

  const glass = !isHome || scrolled
  const getHref = (link: NavLink) =>
    link.href || (link.hash ? (isHome ? `#${link.hash}` : `/#${link.hash}`) : "#")
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
    ? "bg-white/90 backdrop-blur-xl border-neutral-200/80 shadow-lg border"
    : "bg-transparent border-transparent shadow-none"

  return (
    <div
      className="fixed left-0 right-0 top-3 z-50 flex flex-col items-center gap-2 px-3 sm:px-4"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-20px)",
        transition: "opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <nav
        className={`relative flex items-center gap-2 xl:gap-3 px-3 sm:px-4 xl:px-5 py-2 rounded-2xl w-full max-w-[96rem] transition-all duration-500 ${navClass}`}
      >
        <a href="/" onClick={closeMenu} className="shrink-0 flex items-center pr-1">
          <Image
            src="/logo.png"
            alt="Voltrix"
            width={100}
            height={32}
            className="h-7 w-auto min-w-[84px] object-contain"
            priority
          />
        </a>

        {/* Desktop links — compact, no wrap, CTA never clipped */}
        <div className="hidden xl:flex flex-1 items-center justify-center min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-x-1 2xl:gap-x-2 px-1">
            {navLinks.map((l) => {
              const active = l.href ? pathname === l.href : false
              const accent = l.accent || (l.href === "/installer-cashback" && isCashback)
              return (
                <a
                  key={l.label}
                  href={getHref(l)}
                  className={[
                    "px-2 2xl:px-2.5 py-1.5 rounded-lg text-[12px] 2xl:text-[13px] font-medium whitespace-nowrap transition-colors",
                    accent
                      ? "text-[#1a9f9a] bg-[#1a9f9a]/10 hover:bg-[#1a9f9a]/15"
                      : active
                        ? "text-neutral-900 bg-neutral-100"
                        : "text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100/80",
                  ].join(" ")}
                  style={{ letterSpacing: "-0.2px" }}
                >
                  <span className="2xl:hidden">{l.short || l.label}</span>
                  <span className="hidden 2xl:inline">{l.label}</span>
                </a>
              )
            })}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="hidden xl:block">
            <GetQuoteButton variant="solid" className="!text-sm !h-9" />
          </div>
          <a
            href="/installer-cashback"
            onClick={closeMenu}
            className="xl:hidden inline-flex items-center h-8 px-2.5 rounded-full text-[11px] font-semibold text-[#1a9f9a] bg-[#1a9f9a]/10 border border-[#1a9f9a]/20"
          >
            Cashback
          </a>
          <button
            type="button"
            className="xl:hidden p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="absolute top-[3.6rem] left-3 right-3 sm:left-4 sm:right-4 bg-white/95 backdrop-blur-xl border border-neutral-200/80 rounded-2xl shadow-xl p-3 flex flex-col gap-0.5 xl:hidden max-h-[min(78vh,640px)] overflow-y-auto">
          {navLinks.map((l) => {
            const accent = l.accent
            return (
              <a
                key={l.label}
                href={getHref(l)}
                onClick={closeMenu}
                className={[
                  "px-3 py-2.5 rounded-xl text-[15px] font-medium transition-colors",
                  accent
                    ? "text-[#1a9f9a] bg-[#1a9f9a]/10"
                    : "text-neutral-900 hover:bg-neutral-100",
                ].join(" ")}
              >
                {l.label}
              </a>
            )
          })}
          <div className="pt-2 mt-1 border-t border-neutral-100 px-1 pb-1">
            <GetQuoteButton onClick={closeMenu} className="w-full justify-center" />
          </div>
        </div>
      )}
    </div>
  )
}
