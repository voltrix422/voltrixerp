"use client"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Search, Trash2, UserCog, Phone, Mail, MapPin, Briefcase, Upload, FileText, Download, IdCard } from "lucide-react"

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
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterDept, setFilterDept] = useState("All")
  const [filterStatus, setFilterStatus] = useState("All")
  const [showFilters, setShowFilters] = useState(false)

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

  function downloadIdCard(member: StaffMember) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Vertical ID card dimensions (standard vertical: 54mm x 85.6mm ~ 638x1012 pixels at 300dpi)
    canvas.width = 638
    canvas.height = 1012

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(0.5, '#16213e')
    gradient.addColorStop(1, '#0f3460')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Decorative pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.fillRect(i, 0, 2, canvas.height)
    }

    // Company logo
    const logoImg = new Image()
    logoImg.crossOrigin = 'anonymous'
    
    const drawCard = () => {
      // Draw logo if loaded, otherwise use text
      if (logoImg.complete && logoImg.naturalWidth > 0) {
        const logoSize = 100
        const logoX = (canvas.width - logoSize) / 2
        ctx.drawImage(logoImg, logoX, 30, logoSize, logoSize)
      } else {
        // Fallback logo
        ctx.fillStyle = '#e94560'
        ctx.beginPath()
        ctx.arc(canvas.width / 2, 80, 50, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 48px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('V', canvas.width / 2, 85)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      // Company name
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 22px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('VOLTRIX', canvas.width / 2, 150)
      ctx.textAlign = 'left'

      // Circular staff photo (avatar)
      const photoCenterX = canvas.width / 2
      const photoCenterY = 320
      const photoRadius = 100
      
      // Photo background circle
      ctx.fillStyle = '#2a2a4a'
      ctx.beginPath()
      ctx.arc(photoCenterX, photoCenterY, photoRadius + 10, 0, Math.PI * 2)
      ctx.fill()

      const drawStaffPhoto = () => {
        if (member.photo_url) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            ctx.save()
            ctx.beginPath()
            ctx.arc(photoCenterX, photoCenterY, photoRadius, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(img, photoCenterX - photoRadius, photoCenterY - photoRadius, photoRadius * 2, photoRadius * 2)
            ctx.restore()
            finishCard()
          }
          img.onerror = () => {
            drawPlaceholderAvatar()
            finishCard()
          }
          img.src = member.photo_url
        } else {
          drawPlaceholderAvatar()
          finishCard()
        }
      }

      const drawPlaceholderAvatar = () => {
        ctx.fillStyle = '#3a3a5a'
        ctx.beginPath()
        ctx.arc(photoCenterX, photoCenterY, photoRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#e94560'
        ctx.font = 'bold 50px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(), photoCenterX, photoCenterY)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      const finishCard = () => {
        // Employee name (first letter capital)
        const capitalizedName = member.name.charAt(0).toUpperCase() + member.name.slice(1).toLowerCase()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 32px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(capitalizedName, canvas.width / 2, photoCenterY + photoRadius + 60)

        // Role (first letter capital)
        const capitalizedRole = member.role.charAt(0).toUpperCase() + member.role.slice(1).toLowerCase()
        ctx.fillStyle = '#e94560'
        ctx.font = '20px Arial'
        ctx.fillText(capitalizedRole, canvas.width / 2, photoCenterY + photoRadius + 95)

        // Department (simple text)
        ctx.fillStyle = '#a0a0a0'
        ctx.font = '16px Arial'
        ctx.fillText(member.department, canvas.width / 2, photoCenterY + photoRadius + 125)

        // Employee ID (small, one line)
        const infoY = photoCenterY + photoRadius + 160
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('ID: #' + String(member.id).padStart(6, '0'), canvas.width / 2, infoY)
        ctx.textAlign = 'left'

        // Download
        const link = document.createElement('a')
        link.download = `${member.name.replace(/\s+/g, '_')}_ID_Card.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }

      drawStaffPhoto()
    }

    logoImg.onload = drawCard
    logoImg.onerror = drawCard
    logoImg.src = '/logo.png'
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-end">
        <Button size="sm" className="h-8 text-sm gap-2 bg-black hover:bg-neutral-800 text-white cursor-pointer" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> New Staff
        </Button>
      </div>

      {/* Stats */}
      {staff.length > 0 && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-[hsl(var(--border))]">
            <div className="p-3 text-center">
              <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-[hsl(var(--foreground))] mt-0.5">{staff.length}</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Active</p>
              <p className="text-xl font-bold text-[hsl(var(--foreground))] mt-0.5">{activeCount}</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Inactive</p>
              <p className="text-xl font-bold text-[hsl(var(--foreground))] mt-0.5">{staff.length - activeCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters Toggle */}
      {staff.length > 0 && (
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Filter staff
        </button>
      )}

      {/* Filters */}
      {staff.length > 0 && showFilters && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 flex flex-wrap gap-2 items-center animate-in slide-in-from-top-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, role, email..."
              className="w-full h-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-10 pr-3 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent" />
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="h-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent">
            <option value="All">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent">
            <option value="All">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || filterDept !== "All" || filterStatus !== "All") && (
            <button onClick={() => { setSearch(""); setFilterDept("All"); setFilterStatus("All") }}
              className="h-8 px-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border))] rounded hover:bg-[hsl(var(--muted))]/10">Clear</button>
          )}
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto">{filtered.length} of {staff.length}</span>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[hsl(var(--border))]/30 rounded-xl bg-[hsl(var(--card))]">
          <div className="h-12 w-12 rounded-full bg-[hsl(var(--muted))]/30 flex items-center justify-center mx-auto mb-3">
            <UserCog className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">No staff yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Add your first staff member to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-xs text-[hsl(var(--muted-foreground))] border border-dashed border-[hsl(var(--border))]/30 rounded-lg bg-[hsl(var(--card))]">No staff match your filters.</div>
      ) : (
        <div className="border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20">
                <th className="text-left px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Staff</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Department</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Status</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Contact</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Salary</th>
                <th className="text-right px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => setViewMember(s)}
                  className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/5 cursor-pointer transition-colors">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full shrink-0 overflow-hidden bg-[hsl(var(--muted))]/30 flex items-center justify-center">
                        {s.photo_url
                          ? <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                          : <span className="text-[8px] font-semibold text-[hsl(var(--muted-foreground))]">{s.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                        }
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-[hsl(var(--foreground))]">{s.name}</p>
                        <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{s.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <p className="text-[10px] text-[hsl(var(--foreground))]">{s.department}</p>
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge variant={s.status === "active" ? "success" : "destructive"} className="text-[8px] px-1 py-0">{s.status}</Badge>
                  </td>
                  <td className="px-2 py-1.5">
                    <p className="text-[10px] text-[hsl(var(--foreground))]">{s.email || "—"}</p>
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{s.phone || "—"}</p>
                  </td>
                  <td className="px-2 py-1.5">
                    {s.salary > 0 ? (
                      <p className="text-[10px] font-medium text-[hsl(var(--foreground))]">{s.currency} {s.salary.toLocaleString()}</p>
                    ) : (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">—</p>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost"
                        className="h-5 w-5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={e => { e.stopPropagation(); handleDelete(s.id) }}>
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <p className="text-base font-semibold text-[hsl(var(--foreground))]">{editingMember ? "Edit Staff Member" : "New Staff Member"}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={resetForm}><X className="h-5 w-5" /></Button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">

              {/* Photo */}
              <div className="flex items-center gap-4">
                <div onClick={() => fileRef.current?.click()}
                  className="h-20 w-20 rounded-full border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center cursor-pointer hover:border-[#1a9f9a] overflow-hidden shrink-0 transition-colors bg-[hsl(var(--muted))]/10">
                  {photoPreview
                    ? <img src={photoPreview} alt="photo" className="h-full w-full object-cover" />
                    : <Upload className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">Photo</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Click circle to upload</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Full Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Ahmed Khan"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Job Title *</label>
                  <input value={role} onChange={e => setRole(e.target.value)} required placeholder="e.g. Engineer"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Department</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@company.com"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92 300 0000000"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Salary</label>
                  <input value={salary} onChange={e => setSalary(e.target.value)} type="number" min="0" placeholder="0"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Join Date</label>
                  <input value={joinDate} onChange={e => setJoinDate(e.target.value)} type="date"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as "active" | "inactive")}
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Address</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="City, Country"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional info..."
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent resize-none" />
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Documents</label>
                  <button type="button" onClick={() => docFileRef.current?.click()}
                    className="flex items-center gap-1.5 text-sm text-[#1a9f9a] hover:underline font-medium">
                    <Plus className="h-4 w-4" /> Add Document
                  </button>
                </div>
                <input ref={docFileRef} type="file" multiple className="hidden" onChange={handleDocFileChange} />
                
                {/* Existing documents (in edit mode) */}
                {editingMember && editingMember.documents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide font-medium">Existing Documents</p>
                    {editingMember.documents.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
                        <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                        <span className="flex-1 min-w-0 text-sm truncate">{doc.name}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
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
                    className="flex items-center gap-3 rounded-lg border-2 border-dashed border-[hsl(var(--border))] px-4 py-4 cursor-pointer hover:border-[#1a9f9a] transition-colors bg-[hsl(var(--muted))]/10">
                    <FileText className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Click to upload documents (PDF, DOCX, images…)</p>
                  </div>
                ) : documents.length > 0 ? (
                  <div className="space-y-2">
                    {editingMember && <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide font-medium">New Documents</p>}
                    {documents.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
                        <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                        <input
                          value={doc.name}
                          onChange={e => updateDocName(i, e.target.value)}
                          placeholder="Document name"
                          className="flex-1 min-w-0 bg-transparent text-sm text-[hsl(var(--foreground))] focus:outline-none"
                        />
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                          {(doc.file.size / 1024).toFixed(0)}KB
                        </span>
                        <button type="button" onClick={() => removeDoc(i)}
                          className="text-red-400 hover:text-red-600 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => docFileRef.current?.click()}
                      className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[#1a9f9a] transition-colors">
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
          <div className="w-full max-w-2xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <div className="flex items-center gap-3">
                <div 
                  className="h-10 w-10 rounded-full shrink-0 overflow-hidden bg-[hsl(var(--muted))]/30 flex items-center justify-center border border-[hsl(var(--border))] cursor-pointer hover:ring-2 hover:ring-[#1a9f9a] transition-all"
                  onClick={() => viewMember.photo_url && setLightboxPhoto(viewMember.photo_url)}
                >
                  {viewMember.photo_url
                    ? <img src={viewMember.photo_url} alt={viewMember.name} className="h-full w-full object-cover" />
                    : <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{viewMember.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                  }
                </div>
                <p className="text-base font-semibold text-[hsl(var(--foreground))]">{viewMember.name}</p>
                <Badge variant={viewMember.status === "active" ? "success" : "destructive"} className="text-[10px] px-1.5 py-0">{viewMember.status}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => downloadIdCard(viewMember)}>
                  <IdCard className="h-4 w-4" /> Download ID Card
                </Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => openEditForm(viewMember)}>Edit</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => setViewMember(null)}><X className="h-5 w-5" /></Button>
              </div>
            </div>
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Role & Department */}
              <div>
                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Role & Department</p>
                <p className="text-lg font-semibold text-[hsl(var(--foreground))]">{viewMember.role}</p>
                <p className="text-sm text-[hsl(var(--foreground))]">{viewMember.department}</p>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                {viewMember.email && (
                  <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 px-4 py-3">
                    <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Email</p>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewMember.email}</p>
                    </div>
                  </div>
                )}
                {viewMember.phone && (
                  <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 px-4 py-3">
                    <Phone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Phone</p>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewMember.phone}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Salary */}
              {viewMember.salary > 0 && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Salary</p>
                  <p className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">{viewMember.currency} {viewMember.salary.toLocaleString()}</p>
                </div>
              )}

              {/* Join Date */}
              {viewMember.join_date && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Join Date</p>
                  <p className="text-sm text-[hsl(var(--foreground))]">{viewMember.join_date}</p>
                </div>
              )}

              {/* Address */}
              {viewMember.address && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Address</p>
                  <p className="text-sm text-[hsl(var(--foreground))]">{viewMember.address}</p>
                </div>
              )}

              {/* Notes */}
              {viewMember.notes && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Notes</p>
                  <p className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap bg-[hsl(var(--muted))]/10 rounded-lg border border-[hsl(var(--border))] p-4">{viewMember.notes}</p>
                </div>
              )}

              {/* Documents */}
              {viewMember.documents?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Documents ({viewMember.documents.length})</p>
                  <div className="space-y-2">
                    {viewMember.documents.map((doc, i) => (
                      <a key={i} href={doc.data} download={doc.name}
                        className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]/10 px-4 py-3 transition-colors group">
                        <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                        <span className="text-sm flex-1 truncate">{doc.name}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{(doc.size / 1024).toFixed(0)}KB</span>
                        <Download className="h-4 w-4 text-[hsl(var(--muted-foreground))] group-hover:text-[#1a9f9a] shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1 pt-4 border-t border-[hsl(var(--border))]">
                <p>Created: {new Date(viewMember.created_at).toLocaleString()}</p>
                <p>Created by: {viewMember.created_by}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setLightboxPhoto(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={lightboxPhoto} alt="Employee photo" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-4 right-4 h-10 w-10 bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setLightboxPhoto(null)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
