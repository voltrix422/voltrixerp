import type { ReactNode } from "react"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: "How Voltrix Batteries collects, uses, and protects your personal information.",
  path: "/privacy",
})

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children
}
