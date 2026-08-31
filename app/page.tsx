import { Space_Grotesk } from "next/font/google"
import type { Metadata } from "next"
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
import { JsonLd } from "@/components/landing/site-json-ld"
import { buildPageMetadata, faqJsonLd, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
})

export const metadata: Metadata = buildPageMetadata({
  title: `${SITE_NAME} | LiFePO₄ Batteries & Solar Inverters Pakistan`,
  description: SITE_DESCRIPTION,
  path: "/",
  keywords: [
    "LiFePO4 battery Pakistan",
    "solar battery Pakistan",
    "lithium battery Islamabad",
    "Voltrix batteries",
    "hybrid inverter Pakistan",
    "home energy storage",
  ],
})

export default function Home() {
  return (
    <main
      className={`${spaceGrotesk.variable} min-h-screen bg-white text-neutral-900 antialiased`}
      style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
    >
      <JsonLd data={faqJsonLd()} />
      <Navbar />
      <div id="home">
        <Hero />
      </div>
      <SectionBlur id="featured-product">
        <FeaturedProduct />
      </SectionBlur>
      <SectionBlur id="products">
        <Products />
      </SectionBlur>
      <SectionBlur id="testimonials">
        <Testimonials />
      </SectionBlur>
      <SectionBlur id="stats">
        <Stats />
      </SectionBlur>
      <SectionBlur id="mission">
        <MissionBanner />
      </SectionBlur>
      <SectionBlur id="services">
        <ServicesSection />
      </SectionBlur>
      <SectionBlur id="vision">
        <VisionSection />
      </SectionBlur>
      <SectionBlur id="rd">
        <RDSection />
      </SectionBlur>
      <SectionBlur id="about">
        <AboutSection />
      </SectionBlur>
      <SectionBlur id="faq">
        <FAQ />
      </SectionBlur>
      <SectionBlur id="contact">
        <ContactSection />
      </SectionBlur>
      <Footer />
      <WhatsappButton />
    </main>
  )
}
