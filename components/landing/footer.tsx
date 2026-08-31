// @ts-nocheck
import { Separator } from "@/components/ui/separator"
import Image from "next/image"

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/voltrix90/", icon: InstagramIcon },
  { label: "Facebook", href: "https://www.facebook.com/p/Voltrix-Batteries-Pvt-LTD-61573607052471/", icon: FacebookIcon },
]

const links = {
  Company: ["About", "Outlets", "Dealerships", "Blog", "Careers"],
  Locations: ["Islamabad", "Lahore", "Karachi"],
  Legal: ["Privacy", "Terms", "Cookies"],
  Resources: ["Documentation", "ERP"],
}

export default function Footer() {
  return (
    <footer className="px-4 pb-10 pt-16 border-t border-neutral-100">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row gap-10 justify-between">
          <div className="space-y-3 max-w-xs">
            <a href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Voltrix" width={120} height={40} className="h-9 w-auto object-contain" />
            </a>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Advanced battery technology for a world that never stops moving.
            </p>
            <div className="flex items-center gap-3 pt-1">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-[#1a9f9a] hover:border-[#1a9f9a]/40 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {Object.entries(links).map(([group, items]) => (
              <div key={group} className="space-y-3">
                <p className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">{group}</p>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const href = item === "About" ? "/about" :
                                 item === "Outlets" ? "/outlets" :
                                 item === "Dealerships" ? "/dealerships" :
                                 item === "Blog" ? "/blog" :
                                 item === "Careers" ? "/careers" :
                                 item === "Islamabad" ? "/islamabad" :
                                 item === "Lahore" ? "/lahore" :
                                 item === "Karachi" ? "/karachi" :
                                 item === "Privacy" ? "/privacy" :
                                 item === "Terms" ? "/terms" :
                                 item === "Cookies" ? "/cookies" :
                                 item === "Documentation" ? "/documentation" :
                                 item === "ERP" ? "/login" : "#"
                    return (
                      <li key={item}>
                        <a href={href} className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer">
                          {item}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-neutral-100" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <p>© 2026 Voltrix. All rights reserved.</p>
          <p>
            Designed and developed with{" "}
            <span className="text-[#1a9f9a]" aria-hidden>
              ♥
            </span>{" "}
            by{" "}
            <a
              href="https://ahmad-swart.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-600 hover:text-[#1a9f9a] transition-colors"
            >
              Ahmad
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
