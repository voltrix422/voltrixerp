import { Space_Grotesk } from "next/font/google"
import type { Metadata } from "next"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import InstallerCashbackForm from "@/components/landing/installer-cashback-form"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata({
  title: "Installer Cashback",
  description:
    "Voltrix installer cashback program — submit installation photos and claim cashback on genuine Voltrix products in Pakistan.",
  path: "/installer-cashback",
})

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" })

export default function InstallerCashbackPage() {
  return (
    <main className={`${spaceGrotesk.className} min-h-screen bg-white text-neutral-900 antialiased`}>
      <Navbar />
      <InstallerCashbackForm />
      <Footer />
      <WhatsappButton />
    </main>
  )
}
