import { DM_Sans } from "next/font/google"

/** Variable DM Sans — avoid multi-weight next/font (breaks Turbopack production builds). */
export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
})
