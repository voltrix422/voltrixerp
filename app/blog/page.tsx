import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"

async function getBlogs() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/db/blogs`, {
    cache: 'no-store'
  })
  if (!res.ok) return []
  const blogs = await res.json()
  return blogs.filter((b: any) => b.published)
}

export default async function BlogPage() {
  const blogs = await getBlogs()

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Blog</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Latest from Voltrix</h1>
            <p className="text-neutral-500 text-lg max-w-xl mx-auto">News, updates, and insights from our team.</p>
          </div>

          {blogs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-neutral-400">Coming soon...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {blogs.map((blog: any) => (
                <article key={blog.id} className="border-b border-neutral-100 pb-8">
                  {blog.coverImage && (
                    <img src={blog.coverImage} alt={blog.title} className="w-full h-64 object-cover rounded-lg mb-6" />
                  )}
                  <p className="text-xs text-neutral-400 mb-2">
                    {new Date(blog.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <h2 className="text-2xl font-bold text-neutral-900 mb-3">{blog.title}</h2>
                  {blog.excerpt && (
                    <p className="text-neutral-600 mb-4">{blog.excerpt}</p>
                  )}
                  <p className="text-neutral-600 leading-relaxed whitespace-pre-line">{blog.content}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}
