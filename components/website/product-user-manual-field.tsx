"use client"

import { useRef, useState } from "react"
import { ExternalLink, FileText, Loader2, Upload, X } from "lucide-react"

type UserManualValue = {
  userManualUrl: string
  userManualName: string
}

type Props = {
  value: UserManualValue
  onChange: (value: UserManualValue) => void
}

export default function ProductUserManualField({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadUserManual = async (files: FileList | null) => {
    if (!files?.length) return

    setUploading(true)
    setError("")
    try {
      const formData = new FormData()
      Array.from(files).forEach((file) => formData.append("files", file))
      formData.append("folder", "product-user-manuals")

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed")
      }

      const url = data.urls?.[0]
      if (!url) {
        throw new Error("No file was uploaded.")
      }

      const file = files[0]
      onChange({
        userManualUrl: url,
        userManualName: value.userManualName || file.name.replace(/\.[^.]+$/, ""),
      })
    } catch (err: any) {
      setError(err.message || "Failed to upload user manual")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User manual</p>
          <p className="text-xs text-muted-foreground mt-1">Upload a PDF user manual for visitors to view and download on the product page.</p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-accent disabled:opacity-60"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          Upload PDF
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => uploadUserManual(e.target.files)}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Manual title</label>
        <input
          value={value.userManualName}
          onChange={(e) => onChange({ ...value, userManualName: e.target.value })}
          className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a]"
          placeholder="e.g. Installation and user manual"
        />
      </div>

      {value.userManualUrl ? (
        <div className="space-y-3 rounded-lg border bg-neutral-50/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1a9f9a]/10 text-[#1a9f9a]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {value.userManualName || value.userManualUrl.split("/").pop()}
                </p>
                <p className="text-xs text-muted-foreground truncate">{value.userManualUrl}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ userManualUrl: "", userManualName: "" })}
              className="p-1.5 rounded-md hover:bg-red-50 text-red-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <a
            href={value.userManualUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#1a9f9a] hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Preview uploaded user manual
          </a>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No user manual uploaded yet.</p>
      )}
    </div>
  )
}
