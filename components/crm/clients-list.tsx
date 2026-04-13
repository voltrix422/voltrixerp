"use client"
import { useState, useEffect } from "react"
import { getClients, saveClient, deleteClient, type Client } from "@/lib/crm"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Plus, Search, X, Upload, Trash2, User, ShoppingCart } from "lucide-react"

export function ClientsList({ currentUser }: { currentUser: string }) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)

  useEffect(() => {
    getClients().then(c => {
      setClients(c)
      setLoading(false)
    })
    const channel = supabase
      .channel("crm_clients")
      .on("postgres_changes", { event: "*", schema: "public", table: "erp_clients" }, () => {
        getClients().then(setClients)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <div className="relative w-48">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full h-9 px-3 border-b-2 border-t-0 border-x-0 border-[hsl(var(--border))] bg-transparent text-sm focus:outline-none focus:border-[hsl(var(--primary))] transition-colors"
          />
        </div>
        <Button size="sm" className="h-8 text-xs px-3" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Clients
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-3">
            <div className="h-12 w-12 rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading clients...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <User className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {clients.length === 0 
              ? "No clients found" 
              : "No clients found"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
          {filtered.map(client => (
            <div
              key={client.id}
              onClick={() => setSelected(client)}
              className="group flex flex-col items-center text-center space-y-2 cursor-pointer"
            >
              {/* Avatar */}
              {client.imageUrl ? (
                <img 
                  src={client.imageUrl} 
                  alt={client.name} 
                  className="h-16 w-16 rounded-full object-cover shadow-md hover:shadow-lg transition-shadow" 
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[hsl(var(--primary))]/30 via-[hsl(var(--primary))]/20 to-[hsl(var(--primary))]/10 flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
                  <User className="h-8 w-8 text-[hsl(var(--primary))]" />
                </div>
              )}
              
              {/* Name */}
              <p className="text-xs font-semibold truncate w-full px-1 capitalize">
                {client.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ClientForm
          currentUser={currentUser}
          onClose={() => setShowForm(false)}
          onSave={c => {
            setClients(prev => [c, ...prev.filter(x => x.id !== c.id)])
            setShowForm(false)
          }}
        />
      )}

      {selected && (
        <ClientDetail
          client={selected}
          onClose={() => setSelected(null)}
          onUpdate={c => {
            setClients(prev => prev.map(x => x.id === c.id ? c : x))
            setSelected(c)
          }}
          onDelete={id => {
            setClients(prev => prev.filter(x => x.id !== id))
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

function ClientForm({ currentUser, existing, onClose, onSave }: {
  currentUser: string
  existing?: Client
  onClose: () => void
  onSave: (c: Client) => void
}) {
  const [name, setName] = useState(existing?.name || "")
  const [company, setCompany] = useState(existing?.company || "")
  const [email, setEmail] = useState(existing?.email || "")
  const [phone, setPhone] = useState(existing?.phone || "")
  const [address, setAddress] = useState(existing?.address || "")
  const [city, setCity] = useState(existing?.city || "")
  const [country, setCountry] = useState(existing?.country || "")
  const [website, setWebsite] = useState(existing?.website || "")
  const [taxId, setTaxId] = useState(existing?.taxId || "")
  const [industry, setIndustry] = useState(existing?.industry || "")
  const [contactPerson, setContactPerson] = useState(existing?.contactPerson || "")
  const [notes, setNotes] = useState(existing?.notes || "")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(existing?.imageUrl || null)
  const [saving, setSaving] = useState(false)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function submit() {
    if (!name.trim()) return
    setSaving(true)

    let imageUrl: string | undefined
    if (imageFile) {
      const ext = imageFile.name.split(".").pop()
      const path = `client-images/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("erp-files").upload(path, imageFile, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from("erp-files").getPublicUrl(path)
        imageUrl = data.publicUrl
      }
    }

    const client: Client = {
      id: existing?.id || Date.now().toString(),
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      country: country.trim(),
      website: website.trim(),
      taxId: taxId.trim(),
      industry: industry.trim(),
      contactPerson: contactPerson.trim(),
      imageUrl,
      notes: notes.trim(),
      createdAt: existing?.createdAt || new Date().toISOString(),
      createdBy: existing?.createdBy || currentUser,
    }

    await saveClient(client)
    onSave(client)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <p className="text-sm font-semibold">{existing ? "Edit Client" : "Add New Client"}</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Photo Upload Section */}
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="shrink-0">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-full object-cover border-2 border-[hsl(var(--border))]" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center border-2 border-[hsl(var(--border))]">
                  <User className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <input type="file" id="client-image" className="hidden" accept="image/*" onChange={handleImageChange} />
              <label htmlFor="client-image">
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <span className="cursor-pointer">
                    <Upload className="h-3 w-3 mr-1" /> Upload Photo
                  </span>
                </Button>
              </label>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">JPG, PNG or GIF (max 5MB)</p>
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Basic Information</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Full Name *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Company</label>
                <input value={company} onChange={e => setCompany(e.target.value)}
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Industry</label>
                <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Technology"
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-2 pt-1 border-t">
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Contact Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Phone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Contact Person</label>
                <input value={contactPerson} onChange={e => setContactPerson(e.target.value)}
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-2 pt-1 border-t">
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Address Information</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium">City</label>
                  <input value={city} onChange={e => setCity(e.target.value)}
                    className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium">Country</label>
                  <input value={country} onChange={e => setCountry(e.target.value)}
                    className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-2 pt-1 border-t">
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Additional Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Website</label>
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com"
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Tax ID / VAT</label>
                <input value={taxId} onChange={e => setTaxId(e.target.value)}
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
          <Button size="sm" className="h-8 text-xs" onClick={submit} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : existing ? "Update Client" : "Add Client"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

function ClientDetail({ client, onClose, onUpdate, onDelete }: {
  client: Client
  onClose: () => void
  onUpdate: (c: Client) => void
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this client?")) return
    setDeleting(true)
    await deleteClient(client.id)
    onDelete(client.id)
  }

  return (
    <>
      {editing ? (
        <ClientForm
          currentUser={client.createdBy}
          existing={client}
          onClose={() => setEditing(false)}
          onSave={c => {
            onUpdate(c)
            setEditing(false)
          }}
        />
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
          <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <p className="text-sm font-semibold">Client Details</p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Header with Avatar */}
              <div className="flex items-start gap-4 pb-5 border-b">
                {client.imageUrl ? (
                  <img src={client.imageUrl} alt={client.name} className="h-20 w-20 rounded-full object-cover border-2 border-[hsl(var(--border))] shadow-sm" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--primary))]/5 flex items-center justify-center border-2 border-[hsl(var(--border))] shadow-sm">
                    <User className="h-10 w-10 text-[hsl(var(--primary))]" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-lg font-bold">{client.name}</p>
                  {client.company && <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{client.company}</p>}
                  {client.industry && (
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-[hsl(var(--muted))]/40 text-[10px] font-medium">
                      {client.industry}
                    </span>
                  )}
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2">
                    Added {new Date(client.createdAt).toLocaleDateString()} by {client.createdBy}
                  </p>
                </div>
              </div>

              {/* Contact Information Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="flex items-start gap-3 py-2 border-b border-[hsl(var(--border))]/40">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Email</p>
                    <p className="text-sm">{client.email || "—"}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 py-2 border-b border-[hsl(var(--border))]/40">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Phone</p>
                    <p className="text-sm">{client.phone || "—"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 py-2 border-b border-[hsl(var(--border))]/40">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Website</p>
                    {client.website ? (
                      <a href={client.website} target="_blank" rel="noreferrer" className="text-sm text-[hsl(var(--primary))] hover:underline">
                        {client.website}
                      </a>
                    ) : (
                      <p className="text-sm">—</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 py-2 border-b border-[hsl(var(--border))]/40">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Tax ID / VAT</p>
                    <p className="text-sm">{client.taxId || "—"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 py-2 border-b border-[hsl(var(--border))]/40">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Contact Person</p>
                    <p className="text-sm">{client.contactPerson || "—"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 py-2 border-b border-[hsl(var(--border))]/40">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">City</p>
                    <p className="text-sm">{client.city || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Full Width Fields */}
              {client.address && (
                <div className="pt-3">
                  <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Address</p>
                  <p className="text-sm">{client.address}</p>
                  {client.country && (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{client.country}</p>
                  )}
                </div>
              )}

              {client.notes && (
                <div className="pt-3 border-t">
                  <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
              <Button size="sm" className="h-8 text-xs" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="h-3 w-3 mr-1.5" /> {deleting ? "Deleting..." : "Delete"}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={onClose}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
