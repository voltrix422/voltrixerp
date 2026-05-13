"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2, Plus, Trash2, Upload, X } from "lucide-react"
import { DEFAULT_PRODUCT_TERMS_CONTENT } from "@/lib/default-product-terms"

type TermsTemplate = {
  id: string
  name: string
  content: string
  fileUrl?: string | null
  isDefault?: boolean
}

type TermsState = {
  terms: string
  termsTemplateId: string
  termsFile: string
}

type Props = {
  value: TermsState
  onChange: (value: TermsState) => void
}

const EMPTY_TEMPLATE = {
  name: "",
  content: DEFAULT_PRODUCT_TERMS_CONTENT,
  fileUrl: "",
}

export default function ProductTermsEditor({ value, onChange }: Props) {
  const [templates, setTemplates] = useState<TermsTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState(EMPTY_TEMPLATE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchTemplates = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/product-terms")
      const data = await res.json()
      const items = Array.isArray(data) ? data : []
      setTemplates(items)

      if (!value.termsTemplateId) {
        const defaultTemplate = items.find((item: TermsTemplate) => item.isDefault) || items[0]
        if (defaultTemplate && !value.terms.trim()) {
          onChange({
            terms: defaultTemplate.content,
            termsTemplateId: defaultTemplate.id,
            termsFile: value.termsFile,
          })
        }
      }
    } catch {
      setError("Could not load terms templates.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const applyTemplate = (template: TermsTemplate) => {
    onChange({
      terms: template.content,
      termsTemplateId: template.id,
      termsFile: template.fileUrl || value.termsFile,
    })
    setEditingId(template.id)
    setDraft({
      name: template.name,
      content: template.content,
      fileUrl: template.fileUrl || "",
    })
  }

  const startNewTemplate = () => {
    setEditingId(null)
    setDraft({
      name: "",
      content: value.terms || DEFAULT_PRODUCT_TERMS_CONTENT,
      fileUrl: "",
    })
  }

  const saveTemplate = async () => {
    if (!draft.name.trim()) {
      setError("Template name is required.")
      return
    }

    setSavingTemplate(true)
    setError("")
    try {
      const payload = {
        id: editingId || undefined,
        name: draft.name.trim(),
        content: draft.content,
        fileUrl: draft.fileUrl || null,
        isDefault: editingId
          ? templates.find((item) => item.id === editingId)?.isDefault
          : templates.length === 0,
      }

      const res = await fetch("/api/product-terms", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save terms template")
      }

      await fetchTemplates()
      applyTemplate(data)
    } catch (err: any) {
      setError(err.message || "Failed to save terms template")
    } finally {
      setSavingTemplate(false)
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this terms template?")) return

    setError("")
    try {
      const res = await fetch(`/api/product-terms?id=${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete terms template")
      }

      if (value.termsTemplateId === id) {
        onChange({ terms: value.terms, termsTemplateId: "", termsFile: value.termsFile })
      }

      if (editingId === id) {
        setEditingId(null)
        setDraft(EMPTY_TEMPLATE)
      }

      await fetchTemplates()
    } catch (err: any) {
      setError(err.message || "Failed to delete terms template")
    }
  }

  const uploadTermsFile = async (files: FileList | null) => {
    if (!files?.length) return

    setUploadingFile(true)
    setError("")
    try {
      const formData = new FormData()
      Array.from(files).forEach((file) => formData.append("files", file))
      formData.append("folder", "product-terms")

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed")
      }

      const url = data.urls?.[0]
      if (!url) {
        throw new Error("No file was uploaded.")
      }

      onChange({ ...value, termsFile: url })
    } catch (err: any) {
      setError(err.message || "Failed to upload terms file")
    } finally {
      setUploadingFile(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Terms & Conditions</p>
        <button
          type="button"
          onClick={startNewTemplate}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-accent"
        >
          <Plus className="w-3 h-3" /> New template
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Saved templates</label>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading templates…
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                  value.termsTemplateId === template.id ? "border-[#1a9f9a] bg-[#1a9f9a]/5" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-medium truncate">{template.name}</p>
                  {template.isDefault && (
                    <p className="text-[10px] uppercase tracking-wide text-[#1a9f9a]">Default</p>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="px-2 py-1 rounded-md text-xs border hover:bg-accent"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(template.id)}
                    className="p-1.5 rounded-md hover:bg-red-50 text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border bg-neutral-50/60 p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Template name</label>
          <input
            value={draft.name}
            onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
            className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] bg-white"
            placeholder="e.g. 5 Year Warranty + Cell Replacement"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Template content</label>
          <textarea
            rows={8}
            value={draft.content}
            onChange={(e) => setDraft((current) => ({ ...current, content: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] resize-y bg-white"
            placeholder="Terms and conditions text"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveTemplate}
            disabled={savingTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: "#1a9f9a" }}
          >
            {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {editingId ? "Update template" : "Create template"}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Product terms shown on website</label>
        <textarea
          rows={10}
          value={value.terms}
          onChange={(e) => onChange({ ...value, terms: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] resize-y"
          placeholder="Terms and conditions for this product"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-medium text-muted-foreground">Terms document</label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingFile}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-accent disabled:opacity-60"
          >
            {uploadingFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload PDF or TXT
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => uploadTermsFile(e.target.files)}
          />
        </div>
        {value.termsFile ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <a href={value.termsFile} target="_blank" rel="noreferrer" className="text-[#1a9f9a] hover:underline truncate">
              {value.termsFile.split("/").pop()}
            </a>
            <button
              type="button"
              onClick={() => onChange({ ...value, termsFile: "" })}
              className="p-1 rounded-md hover:bg-red-50 text-red-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Optional PDF or TXT attachment for this product.</p>
        )}
      </div>
    </div>
  )
}
