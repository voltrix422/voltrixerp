"use client"

import { useState } from "react"
import { Upload, X, FileText, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { uploadFile } from "@/lib/upload"
import {
  ATTACHMENT_CATEGORIES,
  attachmentLabel,
  newId,
  type AttachmentCategory,
  type ImportAttachment,
} from "@/lib/import-shipment"

interface Props {
  attachments: ImportAttachment[]
  onChange: (docs: ImportAttachment[]) => void
  uploadedBy: string
  readOnly?: boolean
  /** Limit picker to these categories (optional) */
  allowedCategories?: AttachmentCategory[]
  title?: string
  hint?: string
}

export function ImportAttachments({
  attachments,
  onChange,
  uploadedBy,
  readOnly,
  allowedCategories,
  title = "Attachments",
  hint,
}: Props) {
  const cats = allowedCategories?.length
    ? ATTACHMENT_CATEGORIES.filter(c => allowedCategories.includes(c.value))
    : ATTACHMENT_CATEGORIES
  const [category, setCategory] = useState<AttachmentCategory>(cats[0]?.value || "other")
  const [label, setLabel] = useState("")
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const next = [...attachments]
      for (const file of Array.from(files)) {
        const url = await uploadFile(file, "import-shipment-docs")
        next.push({
          id: newId(),
          category,
          name: label.trim() || file.name,
          url,
          uploadedBy,
          uploadedAt: new Date().toISOString(),
        })
      }
      onChange(next)
      setLabel("")
    } finally {
      setUploading(false)
    }
  }

  function remove(id: string) {
    onChange(attachments.filter(a => a.id !== id))
  }

  const grouped = cats
    .map(c => ({
      ...c,
      docs: attachments.filter(a => a.category === c.value),
    }))
    .filter(g => g.docs.length > 0 || !allowedCategories)

  return (
    <div className="space-y-3 rounded-lg border bg-[hsl(var(--muted))]/10 p-3">
      <div className="flex items-start gap-2">
        <Paperclip className="h-4 w-4 mt-0.5 text-[hsl(var(--muted-foreground))]" />
        <div>
          <p className="text-xs font-semibold">{title}</p>
          {hint && <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{hint}</p>}
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-3">
          {(allowedCategories
            ? grouped.filter(g => g.docs.length > 0)
            : [{ value: "all" as const, label: "All", docs: attachments }]
          ).map(group => (
            <div key={"value" in group ? group.value : "all"}>
              {"label" in group && allowedCategories && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1.5">
                  {group.label}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {group.docs.map(d => (
                  <div key={d.id} className="relative rounded-md border overflow-hidden bg-[hsl(var(--background))]">
                    <a href={d.url} target="_blank" rel="noreferrer" className="block">
                      {d.url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ? (
                        <img src={d.url} alt={d.name} className="w-full h-20 object-cover" />
                      ) : (
                        <div className="h-20 flex flex-col items-center justify-center gap-1 px-2 text-center">
                          <FileText className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))] line-clamp-2">{d.name}</span>
                        </div>
                      )}
                    </a>
                    <div className="px-2 py-1 border-t">
                      <p className="text-[9px] font-medium text-[hsl(var(--muted-foreground))] truncate">
                        {attachmentLabel(d.category)}
                      </p>
                      <p className="text-[10px] truncate">{d.name}</p>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <select
            value={category}
            onChange={e => setCategory(e.target.value as AttachmentCategory)}
            className="h-9 rounded-md border bg-[hsl(var(--background))] px-2 text-xs min-w-[160px]"
          >
            {cats.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Name this attachment"
            className="flex-1 min-w-[140px] h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
          />
          <input
            type="file"
            id={`imp-att-${title.replace(/\s+/g, "-")}`}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            multiple
            className="hidden"
            onChange={e => {
              void handleFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <label htmlFor={`imp-att-${title.replace(/\s+/g, "-")}`}>
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs cursor-pointer" asChild disabled={uploading}>
              <span>
                <Upload className="h-3.5 w-3.5 mr-1.5 inline" />
                {uploading ? "Uploading..." : "Add file(s)"}
              </span>
            </Button>
          </label>
        </div>
      )}
    </div>
  )
}
