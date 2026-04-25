"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

interface Job {
  id: string
  title: string
  location: string
  type: string
  description: string
  requirements: string
  salary?: string
  published: boolean
  createdAt: string
  updatedAt: string
}

export default function JobManager() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    type: "",
    description: "",
    requirements: "",
    salary: "",
    published: false,
  })

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    const res = await fetch("/api/db/jobs")
    const data = await res.json()
    setJobs(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const payload = editingJob
      ? { ...formData, id: editingJob.id }
      : { ...formData, createdBy: user?.id }

    const res = await fetch("/api/db/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      setShowForm(false)
      setEditingJob(null)
      setFormData({ title: "", location: "", type: "", description: "", requirements: "", salary: "", published: false })
      fetchJobs()
    } else {
      const error = await res.json()
      alert(error.error || "Failed to save job")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this job?")) return
    await fetch("/api/db/jobs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchJobs()
  }

  async function togglePublish(job: Job) {
    const res = await fetch("/api/db/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...job, published: !job.published }),
    })
    if (res.ok) fetchJobs()
  }

  function handleEdit(job: Job) {
    setEditingJob(job)
    setFormData({
      title: job.title,
      location: job.location,
      type: job.type,
      description: job.description,
      requirements: job.requirements,
      salary: job.salary || "",
      published: job.published,
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Job Management</h2>
        <Button onClick={() => setShowForm(true)} className="bg-[#1a9f9a] hover:bg-[#158a85] h-8 px-3 text-sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Job
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold">{editingJob ? "Edit Job" : "New Job"}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  required
                >
                  <option value="">Select type</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm h-24"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Requirements</label>
              <textarea
                value={formData.requirements}
                onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm h-24"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Salary</label>
              <input
                type="text"
                value={formData.salary}
                onChange={e => setFormData({ ...formData, salary: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="e.g., Competitive, $50k-70k"
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
              <label htmlFor="published" className="text-xs">Published</label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="bg-[#1a9f9a] hover:bg-[#158a85] h-8 px-3 text-sm">
                {editingJob ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-sm"
                onClick={() => {
                  setShowForm(false)
                  setEditingJob(null)
                  setFormData({ title: "", location: "", type: "", description: "", requirements: "", salary: "", published: false })
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
              <th className="text-left px-3 py-2 text-xs font-medium">Title</th>
              <th className="text-left px-3 py-2 text-xs font-medium">Location</th>
              <th className="text-left px-3 py-2 text-xs font-medium">Type</th>
              <th className="text-left px-3 py-2 text-xs font-medium">Status</th>
              <th className="text-right px-3 py-2 text-xs font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => handleEdit(job)}>
                <td className="px-3 py-2 text-sm">{job.title}</td>
                <td className="px-3 py-2 text-sm">{job.location}</td>
                <td className="px-3 py-2 text-sm">{job.type}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                    job.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                  }`}>
                    {job.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => togglePublish(job)}>
                      {job.published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDelete(job.id)}>
                      <Trash2 className="h-3 w-3 text-red-500" />
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
