import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { ThemeProvider } from "@/components/theme-provider"
import { DialogProvider } from "@/components/ui/dialog-provider"
import { ToastProvider } from "@/components/ui/toast"
import "../globals.css"

export const metadata: Metadata = {
  title: "Documentation - Voltrix",
  description: "Voltrix product documentation and guides",
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body>
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
