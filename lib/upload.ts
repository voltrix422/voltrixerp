/**
 * Upload a file to the local /uploads folder via the /api/upload route.
 * Replaces Supabase Storage usage.
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const formData = new FormData()
  formData.append("files", file)
  formData.append("folder", folder)
  const res = await fetch("/api/upload", { method: "POST", body: formData })
  if (!res.ok) throw new Error("Upload failed")
  const { urls } = await res.json()
  return urls[0]
}
