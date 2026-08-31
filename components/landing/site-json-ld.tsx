import {
  faqJsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
  websiteJsonLd,
  HOME_FAQS,
} from "@/lib/seo"

/** Server-rendered JSON-LD for Organization, WebSite, LocalBusiness, and home FAQ. */
export function SiteJsonLd({ includeFaq = false }: { includeFaq?: boolean }) {
  const graphs: Record<string, unknown>[] = [
    organizationJsonLd(),
    websiteJsonLd(),
    localBusinessJsonLd(),
  ]
  if (includeFaq) graphs.push(faqJsonLd(HOME_FAQS))

  return (
    <>
      {graphs.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
    </>
  )
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const list = Array.isArray(data) ? data : [data]
  return (
    <>
      {list.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  )
}
