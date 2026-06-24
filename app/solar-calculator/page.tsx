import type { Metadata } from "next"
import { Space_Grotesk } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import SolarCalculator from "@/components/landing/solar-calculator"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" })

export const metadata: Metadata = {
  title: "Solar Calculator | Voltrix Batteries",
  description:
    "Upload your electricity bill and get an instant solar system size estimate with Voltrix panel, inverter, and battery recommendations.",
}

export default function SolarCalculatorPage() {
  return (
    <main className={`${spaceGrotesk.className} min-h-screen bg-white text-neutral-900 antialiased`}>
      <Navbar />
      <SolarCalculator />
      <Footer />
      <WhatsappButton />
    </main>
  )
}
