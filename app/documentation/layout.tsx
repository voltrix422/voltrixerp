import type { ReactNode } from "react"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({
  title: "Voltrix Product Documentation",
  description:
    "Voltrix LiFePO4 battery and hybrid inverter manuals, specs, and installation guides.",
  path: "/documentation",
})

export default function DocsLayout({ children }: { children: ReactNode }) {
  return children
}
