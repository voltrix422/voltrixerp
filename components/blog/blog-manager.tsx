"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react"

interface Blog {
  id: string
  title: string
  slug: string
  excerpt?: string
  content: string
  coverImage?: string
  published: boolean
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export default function BlogManager() {
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    published: false,
  })

  useEffect(() => {
    fetchBlogs()
  }, [])

  async function fetchBlogs() {
    const res = await fetch("/api/db/blogs")
    const data = await res.json()
    setBlogs(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    
    const payload = editingBlog
      ? { ...formData, id: editingBlog.id }
      : { ...formData, createdBy: user.id }

    const res = await fetch("/api/db/blogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      setShowForm(false)
      setEditingBlog(null)
      setFormData({ title: "", slug: "", excerpt: "", content: "", coverImage: "", published: false })
      fetchBlogs()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this blog?")) return
    await fetch("/api/db/blogs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchBlogs()
  }

  async function togglePublish(blog: Blog) {
    const res = await fetch("/api/db/blogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...blog, published: !blog.published }),
    })
    if (res.ok) fetchBlogs()
  }

  function handleEdit(blog: Blog) {
    setEditingBlog(blog)
    setFormData({
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt || "",
      content: blog.content,
      coverImage: blog.coverImage || "",
      published: blog.published,
    })
    setShowForm(true)
  }

  function generateSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Blog Management</h2>
        <Button onClick={() => setShowForm(true)} className="bg-[#1a9f9a] hover:bg-[#158a85]">
          <Plus className="h-4 w-4 mr-2" /> New Blog
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="text-lg font-semibold">{editingBlog ? "Edit Blog" : "New Blog"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => {
                  setFormData({ ...formData, title: e.target.value, slug: generateSlug(e.target.value) })
                }}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => setFormData({ ...formData, slug: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Excerpt</label>
              <textarea
                value={formData.excerpt}
                onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 h-20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <textarea
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 h-40"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cover Image URL</label>
              <input
                type="text"
                value={formData.coverImage}
                onChange={e => setFormData({ ...formData, coverImage: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={formData.published}
                onChange={e => setFormData({ ...formData, published: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="published" className="text-sm">Published</label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="bg-[#1a9f9a] hover:bg-[#158a85]">
                {editingBlog ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  setEditingBlog(null)
                  setFormData({ title: "", slug: "", excerpt: "", content: "", coverImage: "", published: false })
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">Title</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Date</th>
              <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {blogs.map(blog => (
              <tr key={blog.id} className="border-t">
                <td className="px-4 py-3">{blog.title}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                    blog.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                  }`}>
                    {blog.published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {blog.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(blog.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(blog)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => togglePublish(blog)}>
                      {blog.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(blog.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
