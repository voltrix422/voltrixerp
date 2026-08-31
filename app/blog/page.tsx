import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import Link from "next/link"
import { buildPageMetadata } from "@/lib/seo"
import { SEO_ARTICLES } from "@/lib/seo-articles"

export const metadata = buildPageMetadata({
  title: "Lithium Battery Guides for Pakistan",
  description:
    "Voltrix guides on LiFePO4 battery price, lithium vs tubular, and solar storage for homes in Pakistan.",
  path: "/blog",
  keywords: ["LiFePO4 battery Pakistan", "lithium vs tubular battery", "solar battery guide"],
})

async function getBlogs() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/db/blogs`, {
    cache: "no-store",
  })
  if (!res.ok) return []
  const blogs = await res.json()
  return (Array.isArray(blogs) ? blogs : []).filter((b: { published?: boolean }) => b.published)
}

export default async function BlogPage() {
  const blogs = await getBlogs()

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>
              Blog
            </p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">
              Lithium batteries & solar storage in Pakistan
            </h1>
            <p className="text-neutral-500 text-lg max-w-xl mx-auto">
              Guides on LiFePO4 prices, lithium vs tubular, and Voltrix product updates.
            </p>
          </div>

          <div className="space-y-8">
            {SEO_ARTICLES.map((article) => (
              <article key={article.slug} className="border-b border-neutral-100 pb-8">
                <p className="text-xs text-neutral-400 mb-2">
                  {new Date(article.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">
                  <Link href={`/blog/${article.slug}`} className="hover:text-[#1a9f9a]">
                    {article.title}
                  </Link>
                </h2>
                <p className="text-neutral-600 mb-4">{article.excerpt}</p>
                <Link href={`/blog/${article.slug}`} className="text-sm font-medium text-[#1a9f9a]">
                  Read article
                </Link>
              </article>
            ))}

            {blogs.map((blog: { id: string; title: string; excerpt?: string; content?: string; coverImage?: string; createdAt: string }) => (
              <article key={blog.id} className="border-b border-neutral-100 pb-8">
                {blog.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={blog.coverImage} alt={blog.title} className="w-full h-64 object-cover rounded-lg mb-6" />
                )}
                <p className="text-xs text-neutral-400 mb-2">
                  {new Date(blog.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">{blog.title}</h2>
                {blog.excerpt && <p className="text-neutral-600 mb-4">{blog.excerpt}</p>}
                <p className="text-neutral-600 leading-relaxed whitespace-pre-line">{blog.content}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
