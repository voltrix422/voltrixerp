"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Eye, EyeOff, MapPin, ExternalLink, Store, GripVertical } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

type WebsiteDealership = {
  id: string
  name: string
  city: string
  address: string
  phone: string
  email: string
  contactPerson: string
  openingHours: string
  mapUrl: string
  published: boolean
  sortOrder: number
}

const emptyForm = {
  name: "",
  city: "",
  address: "",
  phone: "",
  email: "",
  contactPerson: "",
  openingHours: "",
  mapUrl: "",
  published: true,
}

export default function DealershipsManager() {
  const { user } = useAuth()
  const [dealerships, setDealerships] = useState<WebsiteDealership[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<WebsiteDealership | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const dragIndexRef = useRef<number | null>(null)

  useEffect(() => {
    fetchDealerships()
  }, [])

  async function fetchDealerships() {
    const res = await fetch("/api/db/dealerships")
    if (res.ok) setDealerships(await res.json())
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(dealership: WebsiteDealership) {
    setEditing(dealership)
    setForm({
      name: dealership.name,
      city: dealership.city,
      address: dealership.address,
      phone: dealership.phone,
      email: dealership.email,
      contactPerson: dealership.contactPerson,
      openingHours: dealership.openingHours,
      mapUrl: dealership.mapUrl,
      published: dealership.published,
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = editing
        ? { ...form, id: editing.id, sortOrder: editing.sortOrder }
        : { ...form, createdBy: user?.id }
      const res = await fetch("/api/db/dealerships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Failed to save dealership")
        return
      }
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm)
      await fetchDealerships()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this dealership? It will be removed from the website.")) return
    await fetch("/api/db/dealerships", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchDealerships()
  }

  async function togglePublish(dealership: WebsiteDealership) {
    await fetch("/api/db/dealerships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dealership, published: !dealership.published }),
    })
    fetchDealerships()
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleDrop(dropIndex: number) {
    const fromIndex = dragIndexRef.current
    if (fromIndex === null || fromIndex === dropIndex) return

    const nextItems = [...dealerships]
    const [moved] = nextItems.splice(fromIndex, 1)
    nextItems.splice(dropIndex, 0, moved)

    setDealerships(nextItems)
    dragIndexRef.current = null
    setDraggedIndex(null)
    setReordering(true)

    try {
      const res = await fetch("/api/db/dealerships", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: nextItems.map(item => item.id) }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Failed to update order")
        await fetchDealerships()
      }
    } finally {
      setReordering(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Authorized Dealerships</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Published dealerships appear in the website header and on{" "}
            <a href="/dealerships" target="_blank" rel="noreferrer" className="text-[#1a9f9a] hover:underline inline-flex items-center gap-0.5">
              /dealerships <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Drag rows up or down to set the order shown on the website.
            {reordering && <span className="ml-1 text-[#1a9f9a]">Saving order...</span>}
          </p>
        </div>
        <Button onClick={openNew} className="bg-[#1a9f9a] hover:bg-[#158a85] h-8 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add dealership
        </Button>
      </div>

      {showForm && (
        <div className="bg-[hsl(var(--card))] rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold">{editing ? "Edit dealership" : "New dealership"}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Dealership name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full h-9 rounded-md border px-3 text-sm bg-[hsl(var(--background))]"
                placeholder="AI Wells"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Company name only — put address and phone in their own fields below.</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                className="w-full h-9 rounded-md border px-3 text-sm bg-[hsl(var(--background))]"
                placeholder="Lahore"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full h-9 rounded-md border px-3 text-sm bg-[hsl(var(--background))]"
                placeholder="0300 1234567"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Address</label>
              <textarea
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                rows={2}
                className="w-full rounded-md border px-3 py-2 text-sm bg-[hsl(var(--background))] resize-none"
                placeholder="Street, area, postal code"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full h-9 rounded-md border px-3 text-sm bg-[hsl(var(--background))]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Contact person</label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={e => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full h-9 rounded-md border px-3 text-sm bg-[hsl(var(--background))]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Opening hours</label>
              <input
                type="text"
                value={form.openingHours}
                onChange={e => setForm({ ...form, openingHours: e.target.value })}
                className="w-full h-9 rounded-md border px-3 text-sm bg-[hsl(var(--background))]"
                placeholder="Mon–Sat 9am–6pm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Google Maps link</label>
              <input
                type="url"
                value={form.mapUrl}
                onChange={e => setForm({ ...form, mapUrl: e.target.value })}
                className="w-full h-9 rounded-md border px-3 text-sm bg-[hsl(var(--background))]"
                placeholder="https://maps.google.com/..."
              />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={e => setForm({ ...form, published: e.target.checked })}
                className="rounded"
              />
              Show on website
            </label>
            <div className="sm:col-span-2 flex gap-2 pt-1">
              <Button type="submit" disabled={saving} className="bg-[#1a9f9a] hover:bg-[#158a85] h-8 text-sm">
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-sm"
                onClick={() => { setShowForm(false); setEditing(null) }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {dealerships.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No dealerships yet. Add your first authorized partner to show it on the website.
        </div>
      ) : (
        <div className="space-y-2">
          {dealerships.map((dealership, index) => (
            <div
              key={dealership.id}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-opacity ${
                draggedIndex === index ? "opacity-50 border-[#1a9f9a]/40 bg-[#1a9f9a]/5" : ""
              }`}
            >
              <div className="min-w-0 flex gap-3 flex-1">
                <div
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnd={() => {
                    dragIndexRef.current = null
                    setDraggedIndex(null)
                  }}
                  className="flex flex-col items-center gap-1 pt-0.5 shrink-0 cursor-grab active:cursor-grabbing"
                  title="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4 text-neutral-300" />
                  <span className="text-[10px] font-medium text-neutral-400 tabular-nums">{index + 1}</span>
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Store className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                    <p className="font-semibold text-sm">{dealership.name}</p>
                    {dealership.published ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">
                        Live on website
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border">
                        Hidden
                      </span>
                    )}
                  </div>
                  {(dealership.city || dealership.address) && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{[dealership.address, dealership.city].filter(Boolean).join(", ")}</span>
                    </p>
                  )}
                  {dealership.phone && <p className="text-xs text-muted-foreground">{dealership.phone}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 sm:ml-2">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => togglePublish(dealership)} title={dealership.published ? "Hide" : "Publish"}>
                  {dealership.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(dealership)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => handleDelete(dealership.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
