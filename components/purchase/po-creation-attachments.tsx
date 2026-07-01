"use client"
import { useState } from "react"
import { Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { uploadFile } from "@/lib/upload"
import type { PODocument } from "@/lib/purchase"

interface Props {
  docs: PODocument[]
  onChange: (docs: PODocument[]) => void
  uploadedBy: string
  readOnly?: boolean
}

export function PoCreationAttachments({ docs, onChange, uploadedBy, readOnly }: Props) {
  const [label, setLabel] = useState("")
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const url = await uploadFile(file, "purchase-po-attachments")
      onChange([
        ...docs,
        {
          id: Date.now().toString(),
          name: label.trim() || file.name,
          url,
          uploadedBy,
          uploadedAt: new Date().toISOString(),
        },
      ])
      setLabel("")
    } finally {
      setUploading(false)
    }
  }

  function removeDoc(id: string) {
    onChange(docs.filter((d) => d.id !== id))
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">Attachments / Photos</p>
      {docs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {docs.map((d) => (
            <div key={d.id} className="relative rounded-lg border overflow-hidden bg-[hsl(var(--muted))]/20">
              <a href={d.url} target="_blank" rel="noreferrer" className="block">
                {d.url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ? (
                  <img src={d.url} alt={d.name} className="w-full h-24 object-cover" />
                ) : (
                  <div className="h-24 flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))] px-2 text-center">
                    {d.name}
                  </div>
                )}
              </a>
              <p className="text-[10px] px-2 py-1 truncate">{d.name}</p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeDoc(d.id)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="flex-1 min-w-[140px] h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
          <input
            type="file"
            id="po-creation-file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ""
            }}
          />
          <label htmlFor="po-creation-file">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs cursor-pointer" asChild disabled={uploading}>
              <span>
                <Upload className="h-3.5 w-3.5 mr-1.5 inline" />
                {uploading ? "Uploading..." : "Add Photo / File"}
              </span>
            </Button>
          </label>
        </div>
      )}
    </div>
  )
}
