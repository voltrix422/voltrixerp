import type { ReactNode } from "react"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({
  title: "Terms of Service",
  description: "Terms of service for using the Voltrix Batteries website and related services.",
  path: "/terms",
})

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children
}
