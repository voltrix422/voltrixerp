/**
 * Upload a file to the local /uploads folder via the /api/upload route.
 * Replaces Supabase Storage usage.
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const urls = await uploadFiles([file], folder)
  return urls[0]
}

export async function uploadFiles(files: File[], folder: string): Promise<string[]> {
  if (files.length === 0) return []
  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }
  formData.append("folder", folder)
  const res = await fetch("/api/upload", { method: "POST", body: formData })
  if (!res.ok) throw new Error("Upload failed")
  const { urls } = await res.json()
  return urls as string[]
}
