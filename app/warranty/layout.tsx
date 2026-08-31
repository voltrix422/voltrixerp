import type { ReactNode } from "react"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({
  title: "Voltrix Warranty Lookup",
  description:
    "Check Voltrix LiFePO4 battery and inverter warranty status. Start or look up a serial from Voltrix Batteries Pakistan.",
  path: "/warranty",
  keywords: ["Voltrix warranty", "lithium battery warranty Pakistan"],
})

export default function WarrantyLayout({ children }: { children: ReactNode }) {
  return children
}
