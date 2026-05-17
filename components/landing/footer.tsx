// @ts-nocheck
import { Separator } from "@/components/ui/separator"
import Image from "next/image"
import { Instagram, Facebook } from "lucide-react"

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  )
}

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/voltrix90/", icon: Instagram },
  { label: "Facebook", href: "https://www.facebook.com/p/Voltrix-Batteries-Pvt-LTD-61573607052471/", icon: Facebook },
  { label: "TikTok", href: null, icon: TikTokIcon },
]

const links = {
  Company: ["About", "Blog", "Careers"],
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
              {socialLinks.map(({ label, href, icon: Icon }) =>
                href ? (
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
                ) : (
                  <span
                    key={label}
                    className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-300"
                    title={`${label} — link coming soon`}
                    aria-hidden
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {Object.entries(links).map(([group, items]) => (
              <div key={group} className="space-y-3">
                <p className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">{group}</p>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const href = item === "About" ? "/about" :
                                 item === "Blog" ? "/blog" :
                                 item === "Careers" ? "/careers" :
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

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <p>© 2026 Voltrix. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
