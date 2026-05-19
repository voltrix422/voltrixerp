"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Plus, Trash2 } from "lucide-react"
import { DEFAULT_PRODUCT_TERMS_CONTENT } from "@/lib/default-product-terms"
import {
  composeProductTermsContent,
  decomposeProductTermsContent,
} from "@/lib/parse-product-terms"

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

type StructuredFields = {
  title: string
  intro: string
  bullets: string
}

function fieldsFromContent(content: string): StructuredFields {
  const d = decomposeProductTermsContent(content || DEFAULT_PRODUCT_TERMS_CONTENT)
  return {
    title: d.title,
    intro: d.intro,
    bullets: d.bullets.join("\n"),
  }
}

function contentFromFields(fields: StructuredFields): string {
  return composeProductTermsContent({
    title: fields.title,
    intro: fields.intro,
    bullets: fields.bullets.split("\n"),
  })
}

const EMPTY_FIELDS: StructuredFields = {
  title: "",
  intro: "",
  bullets: "",
}

export default function ProductTermsEditor({ value, onChange }: Props) {
  const [templates, setTemplates] = useState<TermsTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState("")
  const [productFields, setProductFields] = useState<StructuredFields>(() =>
    fieldsFromContent(value.terms),
  )
  const [templateFields, setTemplateFields] = useState<StructuredFields>(EMPTY_FIELDS)

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
          const fields = fieldsFromContent(defaultTemplate.content)
          onChange({
            terms: contentFromFields(fields),
            termsTemplateId: defaultTemplate.id,
            termsFile: "",
          })
          setProductFields(fields)
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

  useEffect(() => {
    setProductFields(fieldsFromContent(value.terms))
  }, [value.terms])

  const applyTemplate = (template: TermsTemplate) => {
    const fields = fieldsFromContent(template.content)
    setEditingId(template.id)
    setTemplateName(template.name)
    setTemplateFields(fields)
    onChange({
      terms: contentFromFields(fields),
      termsTemplateId: template.id,
      termsFile: "",
    })
    setProductFields(fields)
  }

  const startNewTemplate = () => {
    setEditingId(null)
    setTemplateName("")
    const fields = fieldsFromContent(value.terms || DEFAULT_PRODUCT_TERMS_CONTENT)
    setTemplateFields(fields)
  }

  const updateProductFields = (patch: Partial<StructuredFields>) => {
    const next = { ...productFields, ...patch }
    setProductFields(next)
    onChange({
      ...value,
      terms: contentFromFields(next),
    })
  }

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      setError("Template name is required.")
      return
    }
    if (!templateFields.title.trim()) {
      setError("Title is required.")
      return
    }

    setSavingTemplate(true)
    setError("")
    try {
      const content = contentFromFields(templateFields)
      const payload = {
        id: editingId || undefined,
        name: templateName.trim(),
        content,
        fileUrl: null,
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save terms template")
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
        onChange({ terms: value.terms, termsTemplateId: "", termsFile: "" })
      }

      if (editingId === id) {
        setEditingId(null)
        setTemplateName("")
        setTemplateFields(EMPTY_FIELDS)
      }

      await fetchTemplates()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete terms template")
    }
  }

  return (
    <div className="rounded-xl border p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Terms & Conditions
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Title, intro text, and bullet points. Shown in a popup on the product page.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewTemplate}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-accent"
        >
          <Plus className="w-3 h-3" /> New template
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
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

      <div className="grid grid-cols-1 gap-4 rounded-lg border bg-neutral-50/60 p-4">
        <p className="text-xs font-semibold text-neutral-700">
          {editingId ? "Edit template" : "New template"}
        </p>
        <FieldBlock
          label="Template name (admin label)"
          value={templateName}
          onChange={setTemplateName}
          placeholder="e.g. 5 Year Warranty"
          singleLine
        />
        <TermsFieldsForm
          fields={templateFields}
          onChange={setTemplateFields}
          idPrefix="template"
        />
        <button
          type="button"
          onClick={saveTemplate}
          disabled={savingTemplate}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-60 w-fit"
          style={{ backgroundColor: "#1a9f9a" }}
        >
          {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {editingId ? "Update template" : "Create template"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-[#1a9f9a]/20 bg-[#1a9f9a]/5 p-4">
        <p className="text-xs font-semibold text-[#158a85]">Terms for this product (website)</p>
        <TermsFieldsForm
          fields={productFields}
          onChange={(fields) => updateProductFields(fields)}
          idPrefix="product"
        />
      </div>
    </div>
  )
}

function FieldBlock({
  label,
  value,
  onChange,
  placeholder,
  singleLine,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  singleLine?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {singleLine ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] bg-white"
          placeholder={placeholder}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] resize-y bg-white"
          placeholder={placeholder}
        />
      )}
    </div>
  )
}

function TermsFieldsForm({
  fields,
  onChange,
  idPrefix,
}: {
  fields: StructuredFields
  onChange: (fields: StructuredFields) => void
  idPrefix: string
}) {
  return (
    <>
      <FieldBlock
        label="Title"
        value={fields.title}
        onChange={(title) => onChange({ ...fields, title })}
        placeholder="e.g. 5 Year Warranty"
        singleLine
      />
      <FieldBlock
        label="Introduction (free text)"
        value={fields.intro}
        onChange={(intro) => onChange({ ...fields, intro })}
        placeholder="Short description about warranty coverage…"
      />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-bullets`}>
          Terms and conditions (one bullet per line)
        </label>
        <textarea
          id={`${idPrefix}-bullets`}
          value={fields.bullets}
          onChange={(e) => onChange({ ...fields, bullets: e.target.value })}
          rows={8}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] resize-y bg-white font-mono"
          placeholder={`For indoor use only (IP21)…\nInstall correctly with approved inverters…\nThe warranty covers manufacturing defects…`}
        />
        <p className="text-[10px] text-muted-foreground">
          Each line becomes a bullet point on the website. You do not need to type “-” at the start.
        </p>
      </div>
    </>
  )
}
