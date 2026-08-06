import type { Metadata } from "next"
import { Space_Grotesk } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import SolarCalculator from "@/components/landing/solar-calculator"
import { buildPageMetadata } from "@/lib/seo"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" })

export const metadata: Metadata = buildPageMetadata({
  title: "Solar System Calculator",
  description:
    "Free Pakistan solar calculator — upload your electricity bill or estimate from home appliances, then get Voltrix inverter and battery recommendations.",
  path: "/solar-calculator",
  keywords: [
    "solar calculator Pakistan",
    "electricity bill solar sizing",
    "home appliance load estimate",
    "Voltrix battery recommendation",
  ],
})

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
