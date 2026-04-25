// @ts-nocheck
import { Separator } from "@/components/ui/separator"
import Image from "next/image"

const links = {
  Company: ["About", "Blog", "Careers"],
  Legal: ["Privacy", "Terms", "Cookies"],
  Resources: ["Docs"],
}

export default function Footer() {
  return (
    <footer className="px-4 pb-10 pt-16 border-t border-neutral-100">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row gap-10 justify-between">
          {/* Brand */}
          <div className="space-y-3 max-w-xs">
            <a href="#" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Voltrix" width={120} height={40} className="h-9 w-auto object-contain" />
            </a>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Advanced battery technology for a world that never stops moving.
            </p>
          </div>

          {/* Links */}
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
                                 item === "Docs" ? "/docs" : "#"
                    return (
                      <li key={item}>
                        <a href={href} className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors">
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

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
          <p>© 2026 Voltrix. All rights reserved.</p>
          <a href="/login" className="hover:text-neutral-700 transition-colors hover:underline hover:decoration-dotted underline-offset-2">ERP Login</a>
        </div>
      </div>
    </footer>
  )
}
