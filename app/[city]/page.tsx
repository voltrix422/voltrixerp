import type { Metadata } from "next"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import Link from "next/link"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo"

const CITIES = {
  islamabad: {
    title: "Lithium Battery Islamabad — Voltrix Solar Storage",
    description:
      "Buy LiFePO4 solar batteries and hybrid inverters in Islamabad. Voltrix Batteries Pvt Ltd, Plot 73 Street 14 I-9/2. Quotes and support.",
    h1: "Lithium batteries and solar inverters in Islamabad",
    body: "Voltrix Batteries Pvt Ltd is based in I-9/2, Islamabad. We supply LiFePO4 energy storage and hybrid inverters for homes and businesses across Islamabad and Rawalpindi. Visit the factory area showroom path or request a quote for delivery and installer pairing.",
  },
  lahore: {
    title: "Solar Battery Lahore — Voltrix LiFePO4 Pakistan",
    description:
      "Voltrix LiFePO4 solar batteries and hybrid inverters for Lahore. Request a quote for lithium storage, warranty, and dealer supply.",
    h1: "Solar lithium batteries for Lahore",
    body: "Lahore homes and factories use Voltrix LiFePO4 packs for load shedding and solar harvest. We ship from Islamabad and work with dealers. Share your inverter model and backup hours for a matched 5 kWh to 15 kWh lithium bank.",
  },
  karachi: {
    title: "Lithium Battery Karachi — Voltrix Solar Storage",
    description:
      "Voltrix LiFePO4 batteries and hybrid inverters for Karachi solar and backup. Quote lithium storage with Pakistan warranty support.",
    h1: "LiFePO4 solar batteries for Karachi",
    body: "Karachi heat and outages are a hard test for tubular banks. Voltrix LiFePO4 storage is built for daily cycling. Request a quote for coastal delivery and a compatible hybrid inverter.",
  },
} as const

type CityKey = keyof typeof CITIES

export const dynamicParams = false

export function generateStaticParams() {
  return (Object.keys(CITIES) as CityKey[]).map((city) => ({ city }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>
}): Promise<Metadata> {
  const { city } = await params
  const data = CITIES[city as CityKey]
  if (!data) {
    return buildPageMetadata({ title: "Not found", description: "Page not found", noIndex: true })
  }
  return buildPageMetadata({
    title: data.title,
    description: data.description,
    path: `/${city}`,
    keywords: [`lithium battery ${city}`, `solar battery ${city}`, "Voltrix", "Pakistan"],
  })
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params
  const data = CITIES[city as CityKey]
  if (!data) notFound()

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">{data.h1}</h1>
          <p className="text-neutral-600 leading-relaxed">{data.body}</p>
          <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-2">
            <li>LiFePO4 solar batteries for home and commercial backup</li>
            <li>Hybrid inverters matched to lithium charge profiles</li>
            <li>Quotes, warranty support, and dealer supply from Voltrix Islamabad</li>
          </ul>
          <p className="text-sm text-neutral-600">
            <Link href="/products" className="text-[#1a9f9a] font-medium hover:underline">
              View products
            </Link>
            {" · "}
            <Link href="/quote" className="text-[#1a9f9a] font-medium hover:underline">
              Request a quote
            </Link>
            {" · "}
            <Link href="/contact" className="text-[#1a9f9a] font-medium hover:underline">
              Contact Islamabad
            </Link>
          </p>
        </div>
      </section>
      <Footer />
    </main>
  )
}
