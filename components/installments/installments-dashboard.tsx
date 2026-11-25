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
  ChevronRight,
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
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatShortDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const fieldClass =
  "w-full h-10 rounded-[10px] border-0 bg-[#f2f2f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#007aff]/25 transition-shadow"
const labelClass = "block text-[12px] font-medium text-[#6e6e73] mb-1.5"

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
        setShowForm(false)
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

  function backToList() {
    setSelected(null)
    setSelectedId(null)
    setShowForm(false)
    setEditingId(null)
  }

  return (
    <div className="space-y-5">
      {!selected && !showForm && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f]">Clients</h1>
          {canWrite && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-[#007aff] text-white text-[13px] font-semibold hover:bg-[#0066d6] active:scale-[0.98] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,122,255,0.25)]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              New client
            </button>
          )}
        </div>
      )}

      {error ? (
        <p className="text-[12px] text-[#ff3b30] bg-[#ff3b30]/08 rounded-[12px] px-3.5 py-2.5">{error}</p>
      ) : null}

      {showForm && (
        <form
          onSubmit={saveClient}
          className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.06)]"
        >
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-black/[0.05] bg-[#fafafa]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <p className="flex-1 text-center text-[12px] font-medium text-[#86868b] pr-8 tracking-[-0.01em]">
              {editingId ? "Edit Client" : "New Client"}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
              className="p-1 rounded-md text-[#aeaeb2] hover:text-[#86868b] hover:bg-black/[0.04] cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#aeaeb2] mb-3">
                Personal details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="ic-name">
                    Full name <span className="text-[#ff3b30]">*</span>
                  </label>
                  <input
                    id="ic-name"
                    required
                    className={fieldClass}
                    placeholder="Client full name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ic-phone">
                    Phone
                  </label>
                  <input
                    id="ic-phone"
                    className={fieldClass}
                    placeholder="03XX XXXXXXX"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ic-email">
                    Email
                  </label>
                  <input
                    id="ic-email"
                    type="email"
                    className={fieldClass}
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="ic-cnic">
                    CNIC
                  </label>
                  <input
                    id="ic-cnic"
                    className={fieldClass}
                    placeholder="XXXXX-XXXXXXX-X"
                    value={form.cnic}
                    onChange={(e) => setForm((f) => ({ ...f, cnic: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <div className="h-px bg-black/[0.05]" />

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#aeaeb2] mb-3">
                Installation details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="ic-address">
                    Address
                  </label>
                  <input
                    id="ic-address"
                    className={fieldClass}
                    placeholder="Street, city, area"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="ic-product">
                    Product / system
                  </label>
                  <input
                    id="ic-product"
                    className={fieldClass}
                    placeholder="Battery, inverter, or package"
                    value={form.product}
                    onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="ic-notes">
                    Notes
                  </label>
                  <textarea
                    id="ic-notes"
                    rows={4}
                    className="w-full rounded-[10px] border-0 bg-[#f2f2f7] px-3.5 py-2.5 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#007aff]/25 resize-y min-h-[96px]"
                    placeholder="Payment terms, install schedule, special instructions…"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-black/[0.05] bg-[#fafafa]">
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
              className="h-9 px-4 rounded-full text-[13px] font-medium text-[#1d1d1f] hover:bg-black/[0.05] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 rounded-full bg-[#007aff] text-white text-[13px] font-semibold hover:bg-[#0066d6] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save client
            </button>
          </div>
        </form>
      )}

      {selected && !showForm ? (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 -ml-2.5 rounded-lg text-[13px] font-medium text-[#007aff] hover:bg-[#007aff]/08 cursor-pointer transition-colors w-fit"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
              Clients
            </button>
            {canWrite && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(selected)}
                  className="h-8 inline-flex items-center gap-1.5 px-3 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.03] cursor-pointer"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteClient(selected.id)}
                  className="h-8 inline-flex items-center gap-1.5 px-3 rounded-full border border-[#ff3b30]/20 bg-white text-[12px] font-semibold text-[#ff3b30] hover:bg-[#ff3b30]/08 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.05)]">
            <div className="px-5 sm:px-6 py-5 border-b border-black/[0.05]">
              <h2 className="text-[20px] font-semibold tracking-tight text-[#1d1d1f]">{selected.name}</h2>
              <p className="text-[12px] text-[#86868b] mt-1">
                Last updated {formatWhen(selected.updatedAt)}
                {selected.updatedBy ? ` by ${selected.updatedBy}` : ""}
              </p>
            </div>

            <dl className="divide-y divide-black/[0.045]">
              <InfoRow label="Phone" value={selected.phone} />
              <InfoRow label="Email" value={selected.email} />
              <InfoRow label="CNIC" value={selected.cnic} />
              <InfoRow label="Product / system" value={selected.product} />
              <InfoRow label="Address" value={selected.address} />
              <InfoRow label="Notes" value={selected.notes} multiline />
            </dl>
          </div>

          <div className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.05)]">
            <div className="px-5 sm:px-6 py-4 border-b border-black/[0.05] flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Documents</h3>
                <p className="text-[12px] text-[#86868b] mt-0.5">Agreement, checklist, and other files</p>
              </div>
              {canWrite && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={docLabel}
                    onChange={(e) => setDocLabel(e.target.value as DocLabel)}
                    className="h-8 rounded-full border-0 bg-[#f2f2f7] px-3 text-[12px] font-medium text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#007aff]/25"
                  >
                    {LABEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {docLabel === "other" && (
                    <input
                      className="h-8 w-[8.5rem] rounded-full border-0 bg-[#f2f2f7] px-3 text-[12px] outline-none focus:ring-2 focus:ring-[#007aff]/25"
                      placeholder="Custom label"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                  )}
                  <label className="h-8 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-full bg-[#007aff] text-white text-[12px] font-semibold hover:bg-[#0066d6] cursor-pointer">
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
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
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-black/[0.05]">
                    <th className="px-5 sm:px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
                      Type
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
                      File
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b] hidden sm:table-cell">
                      Uploaded
                    </th>
                    <th className="px-5 sm:px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b] text-right w-16">
                      {" "}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.045]">
                  {(["agreement", "checklist", "other"] as DocLabel[]).flatMap((key) => {
                    const list = docsByLabel[key]
                    if (list.length === 0) {
                      return [
                        <tr key={`${key}-empty`} className="bg-white">
                          <td className="px-5 sm:px-6 py-3.5 text-[13px] font-medium text-[#1d1d1f]">
                            {LABEL_OPTIONS.find((o) => o.value === key)?.label}
                          </td>
                          <td className="px-4 py-3.5 text-[13px] text-[#aeaeb2]" colSpan={canWrite ? 2 : 3}>
                            No files yet
                          </td>
                          {canWrite ? <td className="px-5 sm:px-6 py-3.5" /> : null}
                        </tr>,
                      ]
                    }
                    return list.map((doc) => (
                      <tr key={doc.id} className="bg-white hover:bg-[#fafafa]/80 transition-colors">
                        <td className="px-5 sm:px-6 py-3.5 text-[13px] font-medium text-[#1d1d1f] whitespace-nowrap">
                          {labelDisplay(doc)}
                        </td>
                        <td className="px-4 py-3.5">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#007aff] hover:underline max-w-[16rem] sm:max-w-none"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                            <span className="truncate">{doc.fileName || "Open file"}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                          </a>
                        </td>
                        <td className="px-4 py-3.5 text-[12px] text-[#86868b] hidden sm:table-cell whitespace-nowrap">
                          {formatShortDate(doc.createdAt)}
                          {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}
                        </td>
                        <td className="px-5 sm:px-6 py-3.5 text-right">
                          {canWrite ? (
                            <button
                              type="button"
                              onClick={() => deleteDocument(doc.id)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/08 cursor-pointer"
                              aria-label="Delete document"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {!selected && !showForm && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#aeaeb2]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email…"
              className="w-full h-10 rounded-full border-0 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] pl-10 pr-4 text-[13px] outline-none focus:ring-2 focus:ring-[#007aff]/25"
            />
          </div>

          <div className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.05)]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#86868b]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : clients.length === 0 ? (
              <div className="py-16 text-center px-4">
                <p className="text-[14px] font-medium text-[#1d1d1f]">
                  {search.trim() ? "No matching clients" : "No clients yet"}
                </p>
                <p className="text-[12px] text-[#86868b] mt-1">
                  {search.trim()
                    ? "Try a different search."
                    : "Create a client to start uploading documents."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-black/[0.05]">
                      <th className="px-5 sm:px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
                        Name
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
                        Product
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b] text-center">
                        Docs
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
                        Updated
                      </th>
                      <th className="px-5 sm:px-6 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045]">
                    {clients.map((c) => {
                      const docs = c._count?.documents ?? c.documents?.length ?? 0
                      return (
                        <tr
                          key={c.id}
                          onClick={() => void loadClient(c.id)}
                          className="bg-white hover:bg-[#f5f8ff] transition-colors cursor-pointer group"
                        >
                          <td className="px-5 sm:px-6 py-3.5">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] truncate max-w-[14rem]">
                              {c.name}
                            </p>
                            {c.email ? (
                              <p className="text-[11px] text-[#86868b] truncate max-w-[14rem] mt-0.5">
                                {c.email}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3.5 text-[13px] text-[#1d1d1f] whitespace-nowrap">
                            {c.phone || <span className="text-[#aeaeb2]">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-[13px] text-[#1d1d1f]">
                            <span className="truncate block max-w-[12rem]">
                              {c.product || <span className="text-[#aeaeb2]">—</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex min-w-[1.75rem] justify-center px-2 py-0.5 rounded-full bg-[#f2f2f7] text-[11px] font-semibold text-[#6e6e73] tabular-nums">
                              {docs}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-[12px] text-[#86868b] whitespace-nowrap">
                            {formatShortDate(c.updatedAt)}
                          </td>
                          <td className="px-5 sm:px-6 py-3.5 text-right">
                            <ChevronRight className="h-4 w-4 text-[#c7c7cc] group-hover:text-[#007aff] transition-colors inline-block" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function InfoRow({
  label,
  value,
  multiline = false,
}: {
  label: string
  value?: string | null
  multiline?: boolean
}) {
  const empty = !value?.trim()
  return (
    <div className="grid grid-cols-[7.5rem_1fr] sm:grid-cols-[9.5rem_1fr] gap-3 px-5 sm:px-6 py-3.5">
      <dt className="text-[12px] font-medium text-[#86868b] pt-0.5">{label}</dt>
      <dd
        className={`text-[13px] text-[#1d1d1f] ${
          multiline ? "whitespace-pre-wrap break-words" : "break-words"
        } ${empty ? "text-[#aeaeb2]" : ""}`}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  )
}
