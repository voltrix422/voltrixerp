import type { Metadata } from "next"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getSeoArticle, SEO_ARTICLES } from "@/lib/seo-articles"
import { buildPageMetadata, faqJsonLd } from "@/lib/seo"
import { JsonLd } from "@/components/landing/site-json-ld"

export function generateStaticParams() {
  return SEO_ARTICLES.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = getSeoArticle(slug)
  if (!article) {
    return buildPageMetadata({
      title: "Article not found",
      description: "This Voltrix article is unavailable.",
      path: `/blog/${slug}`,
      noIndex: true,
    })
  }
  return buildPageMetadata({
    title: article.title,
    description: article.description,
    path: `/blog/${article.slug}`,
    keywords: [article.keyword, "Voltrix Batteries", "Pakistan", "LiFePO4"],
  })
}

export default async function SeoArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getSeoArticle(slug)
  if (!article) notFound()

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <JsonLd data={faqJsonLd(article.faqs)} />
      <Navbar />
      <article className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1a9f9a]">
            {article.keyword}
          </p>
          <h1 className="text-4xl font-bold tracking-tight">{article.title}</h1>
          <p className="text-sm text-neutral-400">
            {new Date(article.publishedAt).toLocaleDateString("en-PK", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          {article.paragraphs.map((p) => (
            <p key={p.slice(0, 40)} className="text-neutral-700 leading-relaxed">
              {p}
            </p>
          ))}
          <section className="space-y-4 pt-4 border-t">
            <h2 className="text-xl font-semibold">FAQ</h2>
            {article.faqs.map((f) => (
              <div key={f.q}>
                <h3 className="text-sm font-semibold">{f.q}</h3>
                <p className="text-sm text-neutral-600 mt-1">{f.a}</p>
              </div>
            ))}
          </section>
          <p className="text-sm text-neutral-600">
            Next step:{" "}
            <Link href="/products" className="text-[#1a9f9a] font-medium hover:underline">
              browse LiFePO4 batteries and inverters
            </Link>{" "}
            or{" "}
            <Link href="/quote" className="text-[#1a9f9a] font-medium hover:underline">
              request a quote
            </Link>
            .
          </p>
        </div>
      </article>
      <Footer />
    </main>
  )
}
