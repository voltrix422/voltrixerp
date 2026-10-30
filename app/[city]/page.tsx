import type { Metadata } from "next"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import Link from "next/link"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo"

const CITIES = {
  islamabad: {
    name: "Islamabad",
    title: "Lithium Battery Islamabad — Voltrix Solar Storage",
    description:
      "Buy LiFePO4 solar batteries and hybrid inverters in Islamabad. Voltrix Batteries, Plot 73 Street 14 I-9/2. Quotes and support.",
    h1: "Lithium batteries in Islamabad",
    body: "Voltrix supplies LiFePO4 storage and hybrid inverters from I-9/2, Islamabad — for homes and businesses across the capital.",
  },
  lahore: {
    name: "Lahore",
    title: "Solar Battery Lahore — Voltrix LiFePO4",
    description:
      "Voltrix LiFePO4 solar batteries and hybrid inverters for Lahore. Request a quote for lithium storage and warranty support.",
    h1: "Solar lithium batteries in Lahore",
    body: "Voltrix LiFePO4 packs for Lahore homes and factories — supply, warranty, and dealer support from Islamabad.",
  },
  attock: {
    name: "Attock",
    title: "Lithium Battery Attock — Voltrix Solar Storage",
    description:
      "Voltrix LiFePO4 solar batteries and hybrid inverters for Attock. Quotes, warranty, and delivery support.",
    h1: "Lithium batteries in Attock",
    body: "Backup and solar storage for Attock — Voltrix LiFePO4 batteries with Pakistan warranty and installer-friendly supply.",
  },
  sargodha: {
    name: "Sargodha",
    title: "Solar Battery Sargodha — Voltrix LiFePO4",
    description:
      "Voltrix LiFePO4 batteries and hybrid inverters for Sargodha. Request a quote for lithium solar storage.",
    h1: "Solar lithium batteries in Sargodha",
    body: "Voltrix storage for Sargodha homes and shops — daily cycling lithium packs matched to hybrid inverters.",
  },
  "fateh-jang": {
    name: "Fateh Jang",
    title: "Lithium Battery Fateh Jang — Voltrix",
    description:
      "Voltrix LiFePO4 solar batteries for Fateh Jang. Quotes and warranty support from Voltrix Batteries.",
    h1: "Lithium batteries in Fateh Jang",
    body: "Reliable LiFePO4 backup for Fateh Jang — quote a pack sized to your load and solar setup.",
  },
  rawalpindi: {
    name: "Rawalpindi",
    title: "Lithium Battery Rawalpindi — Voltrix Solar Storage",
    description:
      "Buy LiFePO4 solar batteries in Rawalpindi. Voltrix supply from nearby Islamabad I-9/2 with quotes and support.",
    h1: "Lithium batteries in Rawalpindi",
    body: "Rawalpindi and twin-city customers get Voltrix LiFePO4 storage and hybrid inverters with local support from Islamabad.",
  },
  "wah-cantt": {
    name: "Wah Cantt",
    title: "Solar Battery Wah Cantt — Voltrix LiFePO4",
    description:
      "Voltrix LiFePO4 batteries and hybrid inverters for Wah Cantt. Request a quote for lithium storage.",
    h1: "Solar lithium batteries in Wah Cantt",
    body: "Voltrix packs for Wah Cantt homes and facilities — lithium storage with warranty and quote-based sizing.",
  },
  gujranwala: {
    name: "Gujranwala",
    title: "Lithium Battery Gujranwala — Voltrix Solar Storage",
    description:
      "Voltrix LiFePO4 solar batteries and hybrid inverters for Gujranwala. Quotes, warranty, and dealer supply.",
    h1: "Lithium batteries in Gujranwala",
    body: "Industrial and home backup in Gujranwala with Voltrix LiFePO4 — request a quote for capacity and inverter match.",
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
    keywords: [`lithium battery ${data.name}`, `solar battery ${data.name}`, "Voltrix", "Pakistan"],
  })
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params
  const data = CITIES[city as CityKey]
  if (!data) notFound()

  const others = (Object.entries(CITIES) as [CityKey, (typeof CITIES)[CityKey]][]).filter(
    ([key]) => key !== city,
  )

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <section className="relative pt-28 pb-16 px-4 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(26,159,154,0.12), transparent 55%)",
          }}
        />
        <div className="relative max-w-2xl mx-auto space-y-12">
          <div className="space-y-5">
            <p className="text-sm font-semibold text-[#1a9f9a]">{data.name}</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 leading-tight">
              {data.h1}
            </h1>
            <p className="text-base text-neutral-600 leading-relaxed">{data.body}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/quote"
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#1a9f9a] px-5 text-sm font-semibold text-white hover:bg-[#158f8a] transition-colors"
              >
                Get a quote
              </Link>
              <Link
                href="/products"
                className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-200 px-5 text-sm font-semibold text-neutral-800 hover:border-neutral-300 transition-colors"
              >
                Products
              </Link>
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-8 space-y-3">
            <p className="text-xs font-medium text-neutral-400">Also serving</p>
            <div className="flex flex-wrap gap-2">
              {others.map(([key, loc]) => (
                <Link
                  key={key}
                  href={`/${key}`}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:border-[#1a9f9a]/50 hover:text-[#1a9f9a] transition-colors"
                >
                  {loc.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
