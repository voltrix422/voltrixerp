export interface Doc {
  id: string
  name: string
  category: string
  file_url: string
  file_type?: string
  file_size?: number
  description?: string
  created_at: string
  created_by: string
}

export const DOC_CATEGORIES = [
  "Policies", "Procedures", "Contracts", "Invoices", "Reports",
  "Certificates", "Legal", "HR", "Finance", "Operations", "Other"
] as const

export type DocCategory = typeof DOC_CATEGORIES[number]

function mapRow(r: Record<string, unknown>): Doc {
  return {
    id: r.id as string,
    name: r.name as string,
    category: r.category as string,
    file_url: (r.fileUrl ?? r.file_url) as string,
    file_type: (r.fileType ?? r.file_type) as string | undefined,
    file_size: (r.fileSize ?? r.file_size) as number | undefined,
    description: r.description as string | undefined,
    created_at: (r.createdAt ?? r.created_at) as string,
    created_by: (r.createdBy ?? r.created_by) as string,
  }
}

export async function getDocs(): Promise<Doc[]> {
  const res = await fetch("/api/db/docs")
  if (!res.ok) return []
  const data = await res.json()
  return data.map(mapRow)
}

export async function saveDoc(doc: Doc): Promise<void> {
  await fetch("/api/db/docs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  })
}

export async function deleteDoc(id: string): Promise<void> {
  await fetch("/api/db/docs", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("files", file)
  formData.append("folder", "docs")
  const res = await fetch("/api/upload", { method: "POST", body: formData })
  if (!res.ok) throw new Error("Upload failed")
  const { urls } = await res.json()
  return urls[0]
}
