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
  title: "Terms of Service",
  description: "Terms of service for using the Voltrix Batteries website and related services.",
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
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
