"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react"

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
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    
    const payload = editingJob
      ? { ...formData, id: editingJob.id }
      : { ...formData, createdBy: user.id }

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Job Management</h2>
        <Button onClick={() => setShowForm(true)} className="bg-[#1a9f9a] hover:bg-[#158a85]">
          <Plus className="h-4 w-4 mr-2" /> New Job
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="text-lg font-semibold">{editingJob ? "Edit Job" : "New Job"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
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
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 h-32"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Requirements</label>
              <textarea
                value={formData.requirements}
                onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 h-32"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Salary</label>
              <input
                type="text"
                value={formData.salary}
                onChange={e => setFormData({ ...formData, salary: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
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
              <label htmlFor="published" className="text-sm">Published</label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="bg-[#1a9f9a] hover:bg-[#158a85]">
                {editingJob ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
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
              <th className="text-left px-4 py-3 text-sm font-medium">Title</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Location</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} className="border-t">
                <td className="px-4 py-3">{job.title}</td>
                <td className="px-4 py-3">{job.location}</td>
                <td className="px-4 py-3">{job.type}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                    job.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                  }`}>
                    {job.published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {job.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(job)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => togglePublish(job)}>
                      {job.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(job.id)}>
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
