"use client"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Plus, X, Search, Trash2, UserCog, Phone, Mail, MapPin, Briefcase, Upload, FileText, Download } from "lucide-react"

const STORAGE_KEY = "erp_hrm_staff"
const DB_NAME = "erp_hrm_db"
const DB_VERSION = 1
const DOCS_STORE = "documents"

interface StaffDocument {
  name: string
  data: string // base64
  type: string
  size: number
}

interface StaffMember {
  id: string
  name: string
  role: string
  department: string
  email: string
  phone: string
  address: string
  salary: number
  currency: string
  join_date: string
  status: "active" | "inactive"
  notes: string
  photo_url: string // Will be loaded from IndexedDB
  documents: StaffDocument[]
  created_by: string
  created_at: string
}

const DEPARTMENTS = ["Management", "Engineering", "Sales", "Finance", "HR", "Operations", "Marketing", "Support", "Other"]
const CURRENCIES = ["USD", "PKR", "EUR", "GBP", "AED"]

// IndexedDB helpers
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE)
      }
    }
  })
}

async function saveDocuments(staffId: string, docs: StaffDocument[]) {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, "readwrite")
    const store = tx.objectStore(DOCS_STORE)
    store.put(docs, staffId)
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (error) {
    console.error("Error saving documents:", error)
    throw error
  }
}

async function loadDocuments(staffId: string): Promise<StaffDocument[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, "readonly")
    const store = tx.objectStore(DOCS_STORE)
    return new Promise((resolve) => {
      const request = store.get(staffId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => resolve([])
    })
  } catch (error) {
    console.error("Error loading documents:", error)
    return []
  }
}

async function savePhoto(staffId: string, photoData: string) {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, "readwrite")
    const store = tx.objectStore(DOCS_STORE)
    store.put(photoData, `${staffId}_photo`)
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (error) {
    console.error("Error saving photo:", error)
    throw error
  }
}

async function loadPhoto(staffId: string): Promise<string> {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, "readonly")
    const store = tx.objectStore(DOCS_STORE)
    return new Promise((resolve) => {
      const request = store.get(`${staffId}_photo`)
      request.onsuccess = () => resolve(request.result || "")
      request.onerror = () => resolve("")
    })
  } catch (error) {
    console.error("Error loading photo:", error)
    return ""
  }
}

async function deleteDocuments(staffId: string) {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, "readwrite")
    const store = tx.objectStore(DOCS_STORE)
    store.delete(staffId)
    store.delete(`${staffId}_photo`)
  } catch {
    // ignore
  }
}

export function HrmManager() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewMember, setViewMember] = useState<StaffMember | null>(null)
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null)
  const [search, setSearch] = useState("")
  const [filterDept, setFilterDept] = useState("All")
  const [filterStatus, setFilterStatus] = useState("All")

  // form
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [department, setDepartment] = useState("Management")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [salary, setSalary] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [joinDate, setJoinDate] = useState("")
  const [status, setStatus] = useState<"active" | "inactive">("active")
  const [notes, setNotes] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const docFileRef = useRef<HTMLInputElement>(null)

  // documents
  const [documents, setDocuments] = useState<{ file: File; name: string }[]>([])

  function handleDocFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const newDocs = files.map(f => ({ file: f, name: f.name.replace(/\.[^.]+$/, "") }))
    setDocuments(prev => [...prev, ...newDocs])
    e.target.value = ""
  }

  function updateDocName(index: number, name: string) {
    setDocuments(prev => prev.map((d, i) => i === index ? { ...d, name } : d))
  }

  function removeDoc(index: number) {
    setDocuments(prev => prev.filter((_, i) => i !== index))
  }

  function openEditForm(member: StaffMember) {
    setEditingMember(member)
    setName(member.name)
    setRole(member.role)
    setDepartment(member.department)
    setEmail(member.email)
    setPhone(member.phone)
    setAddress(member.address)
    setSalary(member.salary.toString())
    setCurrency(member.currency)
    setJoinDate(member.join_date)
    setStatus(member.status)
    setNotes(member.notes)
    setPhotoPreview(member.photo_url)
    setDocuments([]) // Existing docs will be shown separately
    setShowForm(true)
    setViewMember(null)
  }

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/hrm/staff')
        const staffData = await res.json()
        // Load documents and photos from IndexedDB for each staff member
        const staffWithDocs = await Promise.all(
          staffData.map(async (s: any) => ({
            ...s,
            documents: await loadDocuments(s.id),
            photo_url: await loadPhoto(s.id)
          }))
        )
        setStaff(staffWithDocs)
      } catch (error) {
        console.error('Failed to load staff:', error)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const filtered = staff.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !search || s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    const matchDept = filterDept === "All" || s.department === filterDept
    const matchStatus = filterStatus === "All" || s.status === filterStatus
    return matchSearch && matchDept && matchStatus
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !role) return
    setSaving(true)

    try {
      let photo_url = photoPreview
      if (photoFile) {
        photo_url = await new Promise<string>(resolve => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(photoFile)
        })
      }

      const memberId = editingMember?.id || `staff_${Date.now()}`
      
      // encode new documents
      const encodedDocs: StaffDocument[] = await Promise.all(
        documents.map(({ file, name: docName }) =>
          new Promise<StaffDocument>(resolve => {
            const reader = new FileReader()
            reader.onload = () => resolve({
              name: docName || file.name,
              data: reader.result as string,
              type: file.type,
              size: file.size,
            })
            reader.readAsDataURL(file)
          })
        )
      )

      // Merge existing and new documents
      const allDocs = [...(editingMember?.documents || []), ...encodedDocs]
      
      // Try to save to IndexedDB, fallback to in-memory only
      try {
        if (photo_url) {
          await savePhoto(memberId, photo_url)
        }
        if (allDocs.length > 0) {
          await saveDocuments(memberId, allDocs)
        }
      } catch (dbError) {
        console.warn("IndexedDB not available, using memory storage only:", dbError)
      }

      // Save staff metadata to database
      const staffData = {
        id: memberId,
        name, role, department, email, phone, address,
        salary: parseFloat(salary) || 0,
        currency, joinDate, status, notes,
        createdBy: editingMember?.created_by || user?.name || "Unknown",
        createdAt: editingMember?.created_at || new Date().toISOString(),
      }
      const res = await fetch('/api/hrm/staff', {
        method: editingMember ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData)
      })
      const savedMember = await res.json()

      // Update state with full data including documents and photo
      const updated = editingMember
        ? staff.map(s => s.id === memberId ? { ...savedMember, documents: allDocs, photo_url: photoPreview || "" } : s)
        : [{ ...savedMember, documents: allDocs, photo_url: photoPreview || "" }, ...staff]

      setStaff(updated)
      resetForm()
    } catch (error) {
      console.error("Error saving staff:", error)
      alert("Failed to save staff member. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setName(""); setRole(""); setDepartment("Management"); setEmail("")
    setPhone(""); setAddress(""); setSalary(""); setCurrency("USD")
    setJoinDate(""); setStatus("active"); setNotes("")
    setPhotoFile(null); setPhotoPreview(""); setShowForm(false)
    setDocuments([])
    setEditingMember(null)
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/hrm/staff?id=${id}`, { method: 'DELETE' })
      const updated = staff.filter(s => s.id !== id)
      setStaff(updated)
      deleteDocuments(id) // Clean up IndexedDB (docs + photo)
      if (viewMember?.id === id) setViewMember(null)
    } catch (error) {
      console.error('Failed to delete staff:', error)
    }
  }

  const activeCount = staff.filter(s => s.status === "active").length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-neutral-900">Human Resources</p>
          <p className="text-sm text-neutral-500">Manage staff profiles and information</p>
        </div>
        <Button size="sm" className="h-9 text-sm gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      {/* Stats */}
      {staff.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Total Staff</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{staff.length}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Inactive</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{staff.length - activeCount}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {staff.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, role, email..."
              className="w-full h-10 rounded-lg border border-neutral-300 bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
            <option value="All">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
            <option value="All">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || filterDept !== "All" || filterStatus !== "All") && (
            <button onClick={() => { setSearch(""); setFilterDept("All"); setFilterStatus("All") }}
              className="h-10 px-4 text-sm text-neutral-500 hover:text-neutral-900 border border-neutral-300 rounded-lg hover:bg-neutral-50">Clear</button>
          )}
          <span className="text-sm text-neutral-400 ml-auto">{filtered.length} of {staff.length}</span>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div className="text-center py-16 text-sm text-neutral-400">Loading...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-neutral-300 rounded-2xl bg-white">
          <div className="h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
            <UserCog className="h-8 w-8 text-neutral-400" />
          </div>
          <p className="text-base font-semibold text-neutral-900">No staff yet</p>
          <p className="text-sm text-neutral-500 mt-2">Add your first staff member to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-neutral-400 border border-dashed border-neutral-300 rounded-xl bg-white">No staff match your filters.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} onClick={() => setViewMember(s)}
              className="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 hover:border-[#1a9f9a] hover:bg-neutral-50 cursor-pointer transition-all">
              {/* Avatar */}
              <div className="h-12 w-12 rounded-full shrink-0 overflow-hidden bg-neutral-100 flex items-center justify-center">
                {s.photo_url
                  ? <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                  : <span className="text-sm font-semibold text-neutral-500">{s.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-neutral-900 truncate">{s.name}</p>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 font-medium shrink-0">{s.department}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${s.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {s.status}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 truncate">{s.role}{s.email ? ` · ${s.email}` : ""}</p>
              </div>

              <div className="text-right shrink-0">
                {s.salary > 0 && <p className="text-sm font-semibold tabular-nums text-neutral-900">{s.currency} {s.salary.toLocaleString()}</p>}
                <p className="text-xs text-neutral-400">{s.join_date || "—"}</p>
              </div>

              <Button size="icon" variant="ghost"
                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={e => { e.stopPropagation(); handleDelete(s.id) }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Staff Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
              <p className="text-base font-semibold text-neutral-900">{editingMember ? "Edit Staff Member" : "Add Staff Member"}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-neutral-900" onClick={resetForm}><X className="h-5 w-5" /></Button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">

              {/* Photo */}
              <div className="flex items-center gap-4">
                <div onClick={() => fileRef.current?.click()}
                  className="h-20 w-20 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center cursor-pointer hover:border-[#1a9f9a] overflow-hidden shrink-0 transition-colors bg-neutral-50">
                  {photoPreview
                    ? <img src={photoPreview} alt="photo" className="h-full w-full object-cover" />
                    : <Upload className="h-6 w-6 text-neutral-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900">Photo</p>
                  <p className="text-sm text-neutral-500">Click circle to upload</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-neutral-700">Full Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Ahmed Khan"
                    className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Job Title *</label>
                  <input value={role} onChange={e => setRole(e.target.value)} required placeholder="e.g. Engineer"
                    className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Department</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@company.com"
                    className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92 300 0000000"
                    className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Salary</label>
                  <input value={salary} onChange={e => setSalary(e.target.value)} type="number" min="0" placeholder="0"
                    className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Join Date</label>
                  <input value={joinDate} onChange={e => setJoinDate(e.target.value)} type="date"
                    className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as "active" | "inactive")}
                    className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-neutral-700">Address</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="City, Country"
                    className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-neutral-700">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional info..."
                    className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent resize-none" />
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-neutral-700">Documents</label>
                  <button type="button" onClick={() => docFileRef.current?.click()}
                    className="flex items-center gap-1.5 text-sm text-[#1a9f9a] hover:underline font-medium">
                    <Plus className="h-4 w-4" /> Add Document
                  </button>
                </div>
                <input ref={docFileRef} type="file" multiple className="hidden" onChange={handleDocFileChange} />
                
                {/* Existing documents (in edit mode) */}
                {editingMember && editingMember.documents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Existing Documents</p>
                    {editingMember.documents.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
                        <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                        <span className="flex-1 min-w-0 text-sm truncate">{doc.name}</span>
                        <span className="text-xs text-neutral-400 shrink-0">
                          {(doc.size / 1024).toFixed(0)}KB
                        </span>
                        <button type="button" onClick={() => {
                          const updated = editingMember.documents.filter((_, idx) => idx !== i)
                          setEditingMember({ ...editingMember, documents: updated })
                        }}
                          className="text-red-400 hover:text-red-600 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* New documents to upload */}
                {documents.length === 0 && (!editingMember || editingMember.documents.length === 0) ? (
                  <div onClick={() => docFileRef.current?.click()}
                    className="flex items-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 px-4 py-4 cursor-pointer hover:border-[#1a9f9a] transition-colors bg-neutral-50">
                    <FileText className="h-5 w-5 text-neutral-400" />
                    <p className="text-sm text-neutral-500">Click to upload documents (PDF, DOCX, images…)</p>
                  </div>
                ) : documents.length > 0 ? (
                  <div className="space-y-2">
                    {editingMember && <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">New Documents</p>}
                    {documents.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
                        <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                        <input
                          value={doc.name}
                          onChange={e => updateDocName(i, e.target.value)}
                          placeholder="Document name"
                          className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
                        />
                        <span className="text-xs text-neutral-400 shrink-0">
                          {(doc.file.size / 1024).toFixed(0)}KB
                        </span>
                        <button type="button" onClick={() => removeDoc(i)}
                          className="text-red-400 hover:text-red-600 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => docFileRef.current?.click()}
                      className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#1a9f9a] transition-colors">
                      <Plus className="h-4 w-4" /> Add more
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-10" onClick={resetForm}>Cancel</Button>
                <Button type="submit" size="sm" className="flex-1 h-10 bg-[#1a9f9a] hover:bg-[#158a85] text-white" disabled={saving}>
                  {saving ? "Saving..." : editingMember ? "Update Staff" : "Save Staff"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Staff Modal */}
      {viewMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewMember(null)}>
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Profile header */}
            <div className="flex items-center gap-4 px-6 pt-6 pb-5">
              <div className="h-16 w-16 rounded-full shrink-0 overflow-hidden bg-neutral-100 flex items-center justify-center border-2 border-neutral-200">
                {viewMember.photo_url
                  ? <img src={viewMember.photo_url} alt={viewMember.name} className="h-full w-full object-cover" />
                  : <span className="text-lg font-semibold text-neutral-500">{viewMember.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-neutral-900 truncate">{viewMember.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 font-medium">{viewMember.department}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${viewMember.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {viewMember.status}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 mt-1">{viewMember.role}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-neutral-900 shrink-0" onClick={() => setViewMember(null)}><X className="h-5 w-5" /></Button>
            </div>

            {/* Salary block */}
            {viewMember.salary > 0 && (
              <div className="mx-6 mb-5 rounded-xl bg-neutral-50 border border-neutral-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Monthly Salary</p>
                  <p className="text-2xl font-bold tabular-nums text-neutral-900">{viewMember.currency} {viewMember.salary.toLocaleString()}</p>
                </div>
                <Briefcase className="h-6 w-6 text-[#1a9f9a]" />
              </div>
            )}

            {/* Info grid */}
            <div className="px-6 pb-5 grid grid-cols-2 gap-3">
              {viewMember.email && (
                <div className="col-span-2 flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
                  <Mail className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                  <p className="text-sm truncate">{viewMember.email}</p>
                </div>
              )}
              {viewMember.phone && (
                <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
                  <Phone className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                  <p className="text-sm truncate">{viewMember.phone}</p>
                </div>
              )}
              {viewMember.join_date && (
                <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
                  <Briefcase className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                  <p className="text-sm">Joined {viewMember.join_date}</p>
                </div>
              )}
              {viewMember.address && (
                <div className="col-span-2 flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
                  <MapPin className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                  <p className="text-sm truncate">{viewMember.address}</p>
                </div>
              )}
              {viewMember.notes && (
                <div className="col-span-2 rounded-lg border border-neutral-200 bg-white px-4 py-3">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-1">Notes</p>
                  <p className="text-sm">{viewMember.notes}</p>
                </div>
              )}
              {viewMember.documents?.length > 0 && (
                <div className="col-span-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 space-y-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Documents ({viewMember.documents.length})</p>
                  {viewMember.documents.map((doc, i) => (
                    <a key={i} href={doc.data} download={doc.name}
                      className="flex items-center gap-3 rounded-lg hover:bg-neutral-50 px-3 py-2 transition-colors group">
                      <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                      <span className="text-sm flex-1 truncate">{doc.name}</span>
                      <Download className="h-4 w-4 text-neutral-400 group-hover:text-[#1a9f9a] shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <Button variant="outline" size="sm" className="flex-1 h-10" onClick={() => setViewMember(null)}>Close</Button>
              <Button size="sm" className="flex-1 h-10 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
                onClick={() => openEditForm(viewMember)}>
                Edit
              </Button>
              <Button size="sm" className="h-10 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                onClick={() => handleDelete(viewMember.id)}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
