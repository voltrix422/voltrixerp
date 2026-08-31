import type { Metadata } from "next"

export const SITE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://voltrixbatteries.com"
).replace(/\/$/, "")

export const SITE_NAME = "Voltrix Batteries"
export const SITE_TAGLINE =
  "LiFePO₄ energy storage batteries, hybrid inverters & solar solutions in Pakistan"

export const SITE_DESCRIPTION =
  "Voltrix LiFePO4 batteries and hybrid solar inverters in Pakistan. Free quotes, solar sizing, and outlets in Islamabad."

export const SITE_KEYWORDS = [
  "Voltrix Batteries",
  "LiFePO4 battery Pakistan",
  "lithium battery Islamabad",
  "solar battery Pakistan",
  "hybrid inverter Pakistan",
  "energy storage battery",
  "solar system calculator",
  "home energy storage",
  "Voltrix inverter",
  "Voltrix Fusion",
]

export const ORGANIZATION = {
  name: SITE_NAME,
  legalName: "Voltrix Batteries",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  email: "ops@voltrixbatteries.com",
  telephone: "+92-303-4927779",
  address: {
    streetAddress: "Plot 73, Street 14, Industrial Area I-9/2",
    addressLocality: "Islamabad",
    postalCode: "44000",
    addressCountry: "PK",
  },
  sameAs: [] as string[],
}

/** Marketing routes included in sitemap (path, changeFrequency, priority). */
export const MARKETING_ROUTES: {
  path: string
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
  priority: number
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/products", changeFrequency: "daily", priority: 0.95 },
  { path: "/solar-calculator", changeFrequency: "weekly", priority: 0.9 },
  { path: "/quote", changeFrequency: "monthly", priority: 0.85 },
  { path: "/services", changeFrequency: "monthly", priority: 0.8 },
  { path: "/technology", changeFrequency: "monthly", priority: 0.75 },
  { path: "/vision", changeFrequency: "monthly", priority: 0.7 },
  { path: "/rd", changeFrequency: "monthly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.75 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.8 },
  { path: "/dealerships", changeFrequency: "weekly", priority: 0.8 },
  { path: "/outlets", changeFrequency: "weekly", priority: 0.8 },
  { path: "/warranty", changeFrequency: "monthly", priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.65 },
  { path: "/blog/lifepo4-battery-price-pakistan-2026", changeFrequency: "monthly", priority: 0.7 },
  { path: "/blog/lithium-vs-tubular-battery-pakistan", changeFrequency: "monthly", priority: 0.7 },
  { path: "/blog/best-lithium-battery-for-solar-pakistan", changeFrequency: "monthly", priority: 0.7 },
  { path: "/blog/5kwh-vs-15kwh-solar-battery-pakistan", changeFrequency: "monthly", priority: 0.65 },
  { path: "/islamabad", changeFrequency: "monthly", priority: 0.7 },
  { path: "/lahore", changeFrequency: "monthly", priority: 0.65 },
  { path: "/karachi", changeFrequency: "monthly", priority: 0.65 },
  { path: "/careers", changeFrequency: "monthly", priority: 0.5 },
  { path: "/documentation", changeFrequency: "monthly", priority: 0.55 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.3 },
]

export const HOME_FAQS = [
  {
    q: "How long do Voltrix lithium batteries last?",
    a: "Voltrix lithium batteries last between 10–15 years depending upon usage and the type of lithium battery purchased.",
  },
  {
    q: "Do Voltrix lithium batteries come with a warranty?",
    a: "Yes. All Voltrix lithium battery products come with a warranty ranging from 1 to 10 years depending on the product line. Our residential wall-mount lithium batteries carry up to a 10-year warranty.",
  },
  {
    q: "Are Voltrix lithium batteries safe to use?",
    a: "Absolutely. Every Voltrix lithium battery is built with multi-layer safety protection including overcharge, over-discharge, short circuit, and thermal runaway prevention, meeting IEC 62619 and UN 38.3 standards.",
  },
  {
    q: "Can I use Voltrix lithium batteries with solar systems?",
    a: "Yes. Voltrix lithium batteries are fully compatible with solar systems and are designed to integrate seamlessly with inverters and solar charge controllers for residential and commercial applications.",
  },
  {
    q: "Do you provide installation and support?",
    a: "Yes. We offer end-to-end installation, commissioning, and after-sales technical support for Voltrix lithium battery systems. Our team is available 24/7 to assist with any queries or issues.",
  },
] as const

/** Keep meta descriptions within Google's typical display length without cutting mid-word. */
export function truncateMetaDescription(text: string, max = 155): string {
  const compact = text.replace(/\s+/g, " ").trim()
  if (compact.length <= max) return compact
  const sliced = compact.slice(0, max)
  const lastSpace = sliced.lastIndexOf(" ")
  const cut = lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced
  return `${cut.replace(/[.,;:]+$/, "")}.`
}

export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return SITE_URL
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export function buildPageMetadata({
  title,
  description,
  path = "/",
  image,
  keywords,
  noIndex = false,
}: {
  title: string
  description: string
  path?: string
  image?: string | null
  keywords?: string[]
  noIndex?: boolean
}): Metadata {
  const url = absoluteUrl(path)
  const metaDescription = truncateMetaDescription(description)
  const ogImage = image
    ? image.startsWith("http")
      ? image
      : absoluteUrl(image)
    : absoluteUrl("/logo.png")

  return {
    title,
    description: metaDescription,
    keywords: keywords?.length ? keywords : SITE_KEYWORDS,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_PK",
      url,
      siteName: SITE_NAME,
      title: title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`,
      description: metaDescription,
      images: [{ url: ogImage, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`,
      description: metaDescription,
      images: [ogImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  }
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORGANIZATION.name,
    legalName: ORGANIZATION.legalName,
    url: ORGANIZATION.url,
    logo: ORGANIZATION.logo,
    email: ORGANIZATION.email,
    telephone: ORGANIZATION.telephone,
    address: {
      "@type": "PostalAddress",
      ...ORGANIZATION.address,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: ORGANIZATION.telephone,
        email: ORGANIZATION.email,
        areaServed: "PK",
        availableLanguage: ["English", "Urdu"],
      },
    ],
    ...(ORGANIZATION.sameAs.length ? { sameAs: ORGANIZATION.sameAs } : {}),
  }
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: { "@type": "Organization", name: SITE_NAME, logo: ORGANIZATION.logo },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/products?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  }
}

export function faqJsonLd(faqs: readonly { q: string; a: string }[] = HOME_FAQS) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Voltrix Batteries Pvt Ltd",
    image: ORGANIZATION.logo,
    url: ORGANIZATION.url,
    telephone: ORGANIZATION.telephone,
    email: ORGANIZATION.email,
    address: {
      "@type": "PostalAddress",
      ...ORGANIZATION.address,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 33.658,
      longitude: 73.066,
    },
    areaServed: ["Islamabad", "Rawalpindi", "Lahore", "Karachi", "Pakistan"],
    priceRange: "PKR",
  }
}

export function productJsonLd(product: {
  id: string
  name: string
  description?: string
  model?: string
  category?: string
  price?: number | string | null
  images?: string[]
  image?: string
  warranty?: string
  stock?: string | number
  path?: string
}) {
  const images = Array.isArray(product.images) ? product.images : []
  const firstImage = images[0] || product.image
  const imageUrl = firstImage
    ? firstImage.startsWith("http")
      ? firstImage
      : absoluteUrl(firstImage)
    : ORGANIZATION.logo

  const price = Number(product.price)
  const hasPrice = Number.isFinite(price) && price > 0
  const stock =
    typeof product.stock === "number"
      ? product.stock > 0
        ? "InStock"
        : "OutOfStock"
      : product.stock === "out"
        ? "OutOfStock"
        : product.stock === "low"
          ? "LimitedAvailability"
          : "InStock"

  const path = product.path || `/products/${product.id}`

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: truncateMetaDescription(
      product.description || `${product.name} by Voltrix Batteries`,
      300,
    ),
    sku: product.model || product.id,
    mpn: product.model || product.id,
    brand: { "@type": "Brand", name: "Voltrix" },
    category: product.category || "Energy Storage Battery",
    image: [imageUrl],
    url: absoluteUrl(path),
    ...(product.warranty
      ? {
          warranty: {
            "@type": "WarrantyPromise",
            durationOfWarranty: product.warranty,
            description: product.warranty,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(path),
      priceCurrency: "PKR",
      ...(hasPrice ? { price: String(Math.round(price)) } : {}),
      availability: `https://schema.org/${stock}`,
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  }
}
