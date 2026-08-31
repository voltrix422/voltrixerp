import type { ReactNode } from "react"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({
  title: "Careers at Voltrix Batteries",
  description:
    "Join Voltrix Batteries and help build safer LiFePO4 energy storage and hybrid inverters for Pakistan.",
  path: "/careers",
})

export default function CareersLayout({ children }: { children: ReactNode }) {
  return children
}
