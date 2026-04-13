import { supabase } from "@/lib/supabase"

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
  "Policies",
  "Procedures",
  "Contracts",
  "Invoices",
  "Reports",
  "Certificates",
  "Legal",
  "HR",
  "Finance",
  "Operations",
  "Other"
] as const

export type DocCategory = typeof DOC_CATEGORIES[number]

const METADATA_FILE = "docs/metadata.json"

async function getMetadata(): Promise<Doc[]> {
  try {
    const { data, error } = await supabase.storage
      .from("erp-files")
      .download(METADATA_FILE)
    
    if (error) {
      console.log("No metadata file yet, returning empty array")
      return []
    }
    
    const text = await data.text()
    return JSON.parse(text)
  } catch (err) {
    console.error("Error reading metadata:", err)
    return []
  }
}

async function saveMetadata(docs: Doc[]): Promise<void> {
  const blob = new Blob([JSON.stringify(docs, null, 2)], { type: "application/json" })
  
  await supabase.storage
    .from("erp-files")
    .upload(METADATA_FILE, blob, { upsert: true })
}

export async function getDocs(): Promise<Doc[]> {
  return await getMetadata()
}

export async function saveDoc(doc: Doc): Promise<void> {
  const docs = await getMetadata()
  const index = docs.findIndex(d => d.id === doc.id)
  
  if (index >= 0) {
    docs[index] = doc
  } else {
    docs.push(doc)
  }
  
  await saveMetadata(docs)
}

export async function deleteDoc(id: string): Promise<void> {
  const docs = await getMetadata()
  const filtered = docs.filter(d => d.id !== id)
  await saveMetadata(filtered)
}

export async function uploadFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()
  const path = `docs/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`
  
  const { error } = await supabase.storage
    .from("erp-files")
    .upload(path, file, { upsert: true })
  
  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }
  
  const { data: urlData } = supabase.storage.from("erp-files").getPublicUrl(path)
  return urlData.publicUrl
}
