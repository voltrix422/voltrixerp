"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  ExternalLink,
  Pencil,
  ArrowLeft,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { canWriteInstallments } from "@/lib/auth"

type DocLabel = "agreement" | "checklist" | "other"

type InstallmentDocument = {
  id: string
  clientId: string
  label: string
  customLabel: string
  fileName: string
  fileUrl: string
  uploadedBy: string
  uploadedById: string
  createdAt: string
}

type InstallmentClient = {
  id: string
  name: string
  phone: string
  email: string
  cnic: string
  address: string
  product: string
  notes: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  documents?: InstallmentDocument[]
  _count?: { documents: number }
}

const LABEL_OPTIONS: { value: DocLabel; label: string }[] = [
  { value: "agreement", label: "Agreement" },
  { value: "checklist", label: "Checklist" },
  { value: "other", label: "Other" },
]

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  cnic: "",
  address: "",
  product: "",
  notes: "",
}

function labelDisplay(doc: InstallmentDocument) {
  if (doc.label === "other" && doc.customLabel.trim()) return doc.customLabel.trim()
  const found = LABEL_OPTIONS.find((o) => o.value === doc.label)
  return found?.label || doc.label
}

function formatWhen(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function InstallmentsDashboard() {
  const { user } = useAuth()
  const canWrite = canWriteInstallments(user?.role)
  const [clients, setClients] = useState<InstallmentClient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<InstallmentClient | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [docLabel, setDocLabel] = useState<DocLabel>("agreement")
  const [customLabel, setCustomLabel] = useState("")
  const [uploading, setUploading] = useState(false)

  const loadList = useCallback(
    async (q = search) => {
      if (!user?.id) return
      setLoading(true)
      setError("")
      try {
        const params = new URLSearchParams({ actorUserId: user.id })
        if (q.trim()) params.set("q", q.trim())
        const res = await fetch(`/api/db/installments?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load")
        setClients(Array.isArray(data) ? data : [])
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    },
    [user?.id, search],
  )

  const loadClient = useCallback(
    async (id: string) => {
      if (!user?.id) return
      setError("")
      try {
        const params = new URLSearchParams({ actorUserId: user.id, id })
        const res = await fetch(`/api/db/installments?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load client")
        setSelected(data)
        setSelectedId(id)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load client")
      }
    },
    [user?.id],
  )

  useEffect(() => {
    void loadList("")
  }, [user?.id])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadList(search)
    }, 250)
    return () => window.clearTimeout(t)
  }, [search])

  const docsByLabel = useMemo(() => {
    const docs = selected?.documents || []
    return {
      agreement: docs.filter((d) => d.label === "agreement"),
      checklist: docs.filter((d) => d.label === "checklist"),
      other: docs.filter((d) => d.label === "other"),
    }
  }, [selected])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
    setSelected(null)
    setSelectedId(null)
  }

  function openEdit(client: InstallmentClient) {
    setEditingId(client.id)
    setForm({
      name: client.name || "",
      phone: client.phone || "",
      email: client.email || "",
      cnic: client.cnic || "",
      address: client.address || "",
      product: client.product || "",
      notes: client.notes || "",
    })
    setShowForm(true)
  }

  async function saveClient(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id || !canWrite) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/db/installments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          id: editingId || undefined,
          actorUserId: user.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      setShowForm(false)
      setEditingId(null)
      await loadList(search)
      await loadClient(data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function deleteClient(id: string) {
    if (!user?.id || !canWrite) return
    if (!window.confirm("Delete this client and all documents?")) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/db/installments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, actorUserId: user.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      if (selectedId === id) {
        setSelected(null)
        setSelectedId(null)
      }
      await loadList(search)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setSaving(false)
    }
  }

  async function uploadDocument(file: File) {
    if (!user?.id || !canWrite || !selectedId) return
    setUploading(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("files", file)
      fd.append("folder", "installments")
      const up = await fetch("/api/upload", { method: "POST", body: fd })
      const upData = await up.json()
      if (!up.ok) throw new Error(upData.error || "Upload failed")
      const fileUrl = Array.isArray(upData.urls) ? upData.urls[0] : ""
      if (!fileUrl) throw new Error("Upload failed")

      const res = await fetch("/api/db/installments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_document",
          actorUserId: user.id,
          clientId: selectedId,
          label: docLabel,
          customLabel: docLabel === "other" ? customLabel : "",
          fileName: file.name,
          fileUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not save document")
      setCustomLabel("")
      await loadClient(selectedId)
      await loadList(search)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function deleteDocument(documentId: string) {
    if (!user?.id || !canWrite || !selectedId) return
    if (!window.confirm("Remove this document?")) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/db/installments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_document",
          actorUserId: user.id,
          documentId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not delete")
      await loadClient(selectedId)
      await loadList(search)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full h-9 rounded-[10px] border border-black/[0.08] bg-white px-3 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:border-[#007aff]/50 focus:ring-[3px] focus:ring-[#007aff]/15"

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-[#1d1d1f]">Clients</h1>
          <p className="text-[12px] text-[#86868b] mt-0.5">
            Shared workspace — everyone with a portal ID can view and edit.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full bg-[#007aff] text-white text-[13px] font-semibold hover:bg-[#0066d6] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add client
          </button>
        )}
      </div>

      {error ? (
        <p className="text-[12px] text-[#ff3b30] bg-[#ff3b30]/08 rounded-xl px-3 py-2">{error}</p>
      ) : null}

      {showForm && (
        <form
          onSubmit={saveClient}
          className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5 space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-[#1d1d1f]">
              {editingId ? "Edit client" : "New client"}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg text-[#86868b] hover:bg-black/[0.04] cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              required
              className={inputClass}
              placeholder="Full name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="CNIC"
              value={form.cnic}
              onChange={(e) => setForm((f) => ({ ...f, cnic: e.target.value }))}
            />
            <input
              className={`${inputClass} sm:col-span-2`}
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
            <input
              className={`${inputClass} sm:col-span-2`}
              placeholder="Product / system"
              value={form.product}
              onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
            />
            <textarea
              className="w-full min-h-[72px] rounded-[10px] border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:border-[#007aff]/50 focus:ring-[3px] focus:ring-[#007aff]/15 sm:col-span-2"
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-full bg-[#1d1d1f] text-white text-[13px] font-semibold hover:bg-black disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-9 px-4 rounded-full border border-black/[0.08] bg-white text-[13px] font-medium text-[#1d1d1f] hover:bg-black/[0.03] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {selected ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setSelected(null)
              setSelectedId(null)
            }}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#007aff] hover:underline cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to list
          </button>

          <div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[18px] font-semibold text-[#1d1d1f] truncate">{selected.name}</h2>
                <p className="text-[11px] text-[#86868b] mt-1">
                  Updated {formatWhen(selected.updatedAt)}
                  {selected.updatedBy ? ` · ${selected.updatedBy}` : ""}
                </p>
              </div>
              {canWrite && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(selected)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-black/[0.08] hover:bg-black/[0.03] cursor-pointer"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteClient(selected.id)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-black/[0.08] text-[#ff3b30] hover:bg-[#ff3b30]/08 cursor-pointer"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <Detail label="Phone" value={selected.phone} />
              <Detail label="Email" value={selected.email} />
              <Detail label="CNIC" value={selected.cnic} />
              <Detail label="Product" value={selected.product} />
              <Detail label="Address" value={selected.address} className="sm:col-span-2" />
              <Detail label="Notes" value={selected.notes} className="sm:col-span-2" />
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Documents</h3>
              <p className="text-[12px] text-[#86868b] mt-0.5">
                Upload agreement, checklist, or other labeled files.
              </p>
            </div>

            {canWrite && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-[11px] text-[#86868b]">Label</label>
                  <select
                    value={docLabel}
                    onChange={(e) => setDocLabel(e.target.value as DocLabel)}
                    className={inputClass}
                  >
                    {LABEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {docLabel === "other" && (
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] text-[#86868b]">Custom label</label>
                    <input
                      className={inputClass}
                      placeholder="e.g. ID copy"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                  </div>
                )}
                <label className="h-9 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-full bg-[#1d1d1f] text-white text-[13px] font-semibold hover:bg-black cursor-pointer disabled:opacity-50">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      if (file) void uploadDocument(file)
                    }}
                  />
                </label>
              </div>
            )}

            {(["agreement", "checklist", "other"] as DocLabel[]).map((key) => {
              const list = docsByLabel[key]
              return (
                <div key={key} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">
                    {LABEL_OPTIONS.find((o) => o.value === key)?.label}
                  </p>
                  {list.length === 0 ? (
                    <p className="text-[12px] text-[#aeaeb2]">No files yet</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {list.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-[#fafafa] px-3 py-2"
                        >
                          <FileText className="h-4 w-4 text-[#007aff] shrink-0" />
                          <div className="min-w-0 flex-1">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[13px] font-medium text-[#1d1d1f] hover:underline inline-flex items-center gap-1 truncate max-w-full"
                            >
                              <span className="truncate">
                                {doc.fileName || labelDisplay(doc)}
                              </span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                            </a>
                            <p className="text-[10px] text-[#86868b] truncate">
                              {labelDisplay(doc)}
                              {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}
                              {doc.createdAt ? ` · ${formatWhen(doc.createdAt)}` : ""}
                            </p>
                          </div>
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => deleteDocument(doc.id)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/08 cursor-pointer"
                              aria-label="Delete document"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#aeaeb2]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="w-full h-10 rounded-full border border-black/[0.08] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#007aff]/50 focus:ring-[3px] focus:ring-[#007aff]/15"
            />
          </div>

          <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            {loading ? (
              <p className="text-center text-[12px] text-[#86868b] py-10">Loading…</p>
            ) : clients.length === 0 ? (
              <p className="text-center text-[12px] text-[#86868b] py-10">
                {search.trim() ? "No clients match your search." : "No clients yet. Add the first one."}
              </p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {clients.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void loadClient(c.id)}
                      className="w-full text-left px-4 py-3.5 hover:bg-black/[0.02] transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[#1d1d1f] truncate">{c.name}</p>
                          <p className="text-[12px] text-[#86868b] truncate mt-0.5">
                            {[c.phone, c.product].filter(Boolean).join(" · ") || "No phone / product"}
                          </p>
                        </div>
                        <span className="text-[11px] text-[#aeaeb2] shrink-0">
                          {c._count?.documents ?? c.documents?.length ?? 0} docs
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Detail({
  label,
  value,
  className = "",
}: {
  label: string
  value?: string | null
  className?: string
}) {
  if (!value?.trim()) return null
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wide text-[#aeaeb2] font-semibold">{label}</p>
      <p className="text-[13px] text-[#1d1d1f] whitespace-pre-wrap break-words">{value}</p>
    </div>
  )
}
