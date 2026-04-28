import { Space_Grotesk } from "next/font/google"
import SectionBlur from "@/components/landing/section-blur"
import Navbar from "@/components/landing/navbar"
import Hero from "@/components/landing/hero"
import Stats from "@/components/landing/stats"
import MissionBanner from "@/components/landing/mission-banner"
import FeaturedProduct from "@/components/landing/featured-product"
import Testimonials from "@/components/landing/testimonials"
import FAQ from "@/components/landing/faq"
import Products from "@/components/landing/products"
import ServicesSection from "@/components/landing/services-section"
import VisionSection from "@/components/landing/vision-section"
import RDSection from "@/components/landing/rd-section"
import AboutSection from "@/components/landing/about-section"
import ContactSection from "@/components/landing/contact-section"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
})

export default function Home() {
  return (
    <main
        className={`${spaceGrotesk.variable} min-h-screen bg-white text-neutral-900 antialiased`}
        style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
      >
        <Navbar />
        <div id="home">
          <Hero />
        </div>
        <SectionBlur><Stats /></SectionBlur>
        <SectionBlur><MissionBanner /></SectionBlur>
        <SectionBlur><FeaturedProduct /></SectionBlur>
        <SectionBlur><Testimonials /></SectionBlur>
        <SectionBlur id="products"><Products /></SectionBlur>
        <SectionBlur><ServicesSection /></SectionBlur>
        <SectionBlur><VisionSection /></SectionBlur>
        <SectionBlur><RDSection /></SectionBlur>
        <SectionBlur><AboutSection /></SectionBlur>
        <SectionBlur><FAQ /></SectionBlur>
        <SectionBlur><ContactSection /></SectionBlur>
        <Footer />
        <WhatsappButton />
      </main>
  )
}
