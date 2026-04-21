import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { DialogProvider } from "@/components/ui/dialog-provider"
import { ToastProvider } from "@/components/ui/toast"
import { DBConnectionCheck } from "@/components/db-connection-check"
import "./globals.css"

export const metadata: Metadata = {
  title: "Voltrix",
  description: "Enterprise Resource Planning System",
  icons: { icon: "/logo.png" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <DialogProvider>
            <ToastProvider>
              <AuthProvider>
                <DBConnectionCheck />
                {children}
              </AuthProvider>
            </ToastProvider>
          </DialogProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
