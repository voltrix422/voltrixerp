import type { Metadata } from "next"
import { Space_Grotesk } from "next/font/google"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { ThemeProvider } from "@/components/theme-provider"
import { DialogProvider } from "@/components/ui/dialog-provider"
import { ToastProvider } from "@/components/ui/toast"
import "../globals.css"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
})

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Voltrix Batteries — LiFePO₄ energy storage, hybrid inverters, and our mission to power Pakistan with safer battery technology.",
  alternates: { canonical: "https://voltrixbatteries.com/about" },
  openGraph: {
    title: "About Us | Voltrix Batteries",
    description:
      "Learn about Voltrix Batteries — LiFePO₄ energy storage, hybrid inverters, and our mission in Pakistan.",
    url: "https://voltrixbatteries.com/about",
    siteName: "Voltrix Batteries",
    type: "website",
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className={spaceGrotesk.className}>
        <ThemeProvider>
          <DialogProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </DialogProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
