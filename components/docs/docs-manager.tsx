"use client"
import { useState, useEffect } from "react"
import { getDocs, saveDoc, deleteDoc, uploadFile, DOC_CATEGORIES, type Doc } from "@/lib/docs"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Upload, X, FileText, Download, Trash2, Eye, Filter, Edit2 } from "lucide-react"

export function DocsManager({ currentUser }: { currentUser: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [showUploadForm, setShowUploadForm] = useState(false)

  useEffect(() => {
    loadDocs()
  }, [])

  async function loadDocs() {
    const data = await getDocs()
    setDocs(data)
    setLoading(false)
  }

  const filtered = docs.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === "all" || doc.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categoryCounts = DOC_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = docs.filter(d => d.category === cat).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full h-10 pl-10 pr-4 rounded-lg border bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <Button size="sm" className="h-10 text-xs" onClick={() => setShowUploadForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Upload
        </Button>
      </div>

      <div className="flex gap-6">
        <div className="w-56 shrink-0">
          <div className="rounded-lg border bg-[hsl(var(--card))]">
            <div className="px-4 py-3 border-b bg-[hsl(var(--muted))]/30">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <p className="text-sm font-semibold">Categories</p>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                  selectedCategory === "all"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "hover:bg-[hsl(var(--muted))]/50"
                }`}
              >
                <span>All Documents</span>
                <Badge variant={selectedCategory === "all" ? "secondary" : "outline"} className="text-[10px]">
                  {docs.length}
                </Badge>
              </button>
              <div className="h-px bg-[hsl(var(--border))] my-2" />
              {DOC_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                    selectedCategory === cat
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "hover:bg-[hsl(var(--muted))]/50"
                  }`}
                >
                  <span>{cat}</span>
                  {categoryCounts[cat] > 0 && (
                    <Badge variant={selectedCategory === cat ? "secondary" : "outline"} className="text-[10px]">
                      {categoryCounts[cat]}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="h-12 w-12 rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="h-20 w-20 rounded-full bg-[hsl(var(--muted))]/30 flex items-center justify-center mb-4">
                <FileText className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
              </div>
              <p className="text-lg font-semibold mb-2">No documents found</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
                {docs.length === 0 ? "Upload your first document" : "Try a different search or category"}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                {filtered.length} {filtered.length === 1 ? "document" : "documents"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(doc => (
                  <DocCard key={doc.id} doc={doc} onUpdate={loadDocs} onDelete={loadDocs} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showUploadForm && (
        <UploadForm
          currentUser={currentUser}
          onClose={() => setShowUploadForm(false)}
          onSave={() => {
            loadDocs()
            setShowUploadForm(false)
          }}
        />
      )}
    </div>
  )
}

function DocCard({ doc, onUpdate, onDelete }: { doc: Doc; onUpdate: () => void; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(doc.name)

  async function handleDelete() {
    if (!confirm(`Delete "${doc.name}"?`)) return
    setDeleting(true)
    try {
      await deleteDoc(doc.id)
      onDelete()
    } catch (error) {
      alert("Failed to delete")
      setDeleting(false)
    }
  }

  async function handleSave() {
    if (!newName.trim()) {
      alert("Name cannot be empty")
      return
    }
    try {
      await saveDoc({ ...doc, name: newName.trim() })
      setEditing(false)
      onUpdate()
    } catch (error) {
      alert("Failed to update")
    }
  }

  const fileSize = doc.file_size ? (doc.file_size / 1024 / 1024).toFixed(2) + " MB" : "—"

  return (
    <div className="group rounded-xl border bg-[hsl(var(--card))] p-4 hover:shadow-lg hover:border-[hsl(var(--primary))]/50 transition-all">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--primary))]/5 flex items-center justify-center shrink-0">
          <FileText className="h-6 w-6 text-[hsl(var(--primary))]" />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              autoFocus
            />
          ) : (
            <p className="text-sm font-semibold truncate">{doc.name}</p>
          )}
          <Badge variant="secondary" className="text-[10px] mt-1">{doc.category}</Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => editing ? handleSave() : setEditing(true)}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      </div>

      {doc.description && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3 line-clamp-2">{doc.description}</p>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs text-[hsl(var(--muted-foreground))]">
        <span>{fileSize}</span>
        <span>·</span>
        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
      </div>

      {editing ? (
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={handleSave}>
            Save
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => {
            setNewName(doc.name)
            setEditing(false)
          }}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => window.open(doc.file_url, "_blank")}>
            <Eye className="h-3 w-3 mr-1" /> View
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => {
            const a = document.createElement("a")
            a.href = doc.file_url
            a.download = doc.name
            a.click()
          }}>
            <Download className="h-3 w-3 mr-1" /> Download
          </Button>
          <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

function UploadForm({ currentUser, onClose, onSave }: {
  currentUser: string
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState<string>(DOC_CATEGORIES[0])
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !file) {
      alert("Please provide name and file")
      return
    }

    setUploading(true)
    try {
      const fileUrl = await uploadFile(file)
      
      const doc: Doc = {
        id: Date.now().toString(),
        name: name.trim(),
        category,
        file_url: fileUrl,
        file_type: file.type,
        file_size: file.size,
        description: description.trim(),
        created_at: new Date().toISOString(),
        created_by: currentUser,
      }

      await saveDoc(doc)
      onSave()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload failed")
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <p className="text-base font-bold">Upload Document</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Add a new document</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase mb-1.5 block">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Document name"
              className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase mb-1.5 block">
              Category *
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            >
              {DOC_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase mb-1.5 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional"
              rows={3}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase mb-1.5 block">
              File *
            </label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                id="doc-file"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="doc-file" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-2" />
                {file ? (
                  <p className="text-sm font-medium">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">Click to upload</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Any file type</p>
                  </>
                )}
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="h-8 text-xs ml-auto" onClick={handleSubmit} disabled={uploading || !name.trim() || !file}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  )
}
