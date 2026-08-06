import { Space_Grotesk } from "next/font/google"
import type { Metadata } from "next"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import QuoteForm from "@/components/landing/quote-form"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata({
  title: "Get a Quote",
  description:
    "Request a free Voltrix quote for LiFePO₄ batteries, hybrid inverters, or a complete home solar energy system in Pakistan.",
  path: "/quote",
})

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" })

export default function QuotePage() {
  return (
    <main className={`${spaceGrotesk.className} min-h-screen bg-white text-neutral-900 antialiased`}>
      <Navbar />
      <QuoteForm />
      <Footer />
      <WhatsappButton />
    </main>
  )
}
