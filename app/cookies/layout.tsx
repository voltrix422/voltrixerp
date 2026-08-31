import type { ReactNode } from "react"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({
  title: "Cookie Policy",
  description: "How Voltrix Batteries uses cookies on voltrixbatteries.com.",
  path: "/cookies",
})

export default function CookiesLayout({ children }: { children: ReactNode }) {
  return children
}
