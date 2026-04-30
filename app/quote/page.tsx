import { Space_Grotesk } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import QuoteForm from "@/components/landing/quote-form"

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
