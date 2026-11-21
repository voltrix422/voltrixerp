import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata({
  title: "Live Visitors | Voltrix Batteries",
  description: "Live visitor counter for Voltrix Batteries — increments by 1 on every page visit.",
  path: "/visitors",
  keywords: ["Voltrix visitors", "Voltrix Batteries"],
})

export default function VisitorsLayout({ children }: { children: React.ReactNode }) {
  return children
}
