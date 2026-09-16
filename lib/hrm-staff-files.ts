export type StaffFileDoc = {
  name: string
  url?: string
  data?: string
  type: string
  size: number
}

export function isStoredUrl(value?: string) {
  if (!value) return false
  return value.startsWith("/uploads/") || value.startsWith("http://") || value.startsWith("https://")
}

export function staffDocHref(doc: StaffFileDoc) {
  if (isStoredUrl(doc.url)) return doc.url as string
  if (isStoredUrl(doc.data)) return doc.data as string
  if (doc.data?.startsWith("data:")) return doc.data
  return ""
}

export function storedDocPayload(docs: StaffFileDoc[]) {
  return docs
    .map((d) => ({
      name: d.name,
      url: d.url || (isStoredUrl(d.data) ? d.data || "" : ""),
      type: d.type || "",
      size: Number(d.size) || 0,
    }))
    .filter((d) => d.url)
}

export function dataUrlToFile(dataUrl: string, filename: string, mime?: string) {
  const parts = dataUrl.split(",")
  const header = parts[0] || ""
  const body = parts[1] || ""
  const type = mime || header.match(/data:(.*?);/)?.[1] || "application/octet-stream"
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename || "file", { type })
}

export async function uploadStaffFile(file: File, folder: "staff-docs" | "staff-photos") {
  const fd = new FormData()
  fd.append("files", file)
  fd.append("folder", folder)
  const res = await fetch("/api/upload", { method: "POST", body: fd })
  const json = await res.json().catch(() => ({} as { error?: string; urls?: string[] }))
  if (!res.ok || !json.urls?.[0]) {
    throw new Error(json.error || "Could not upload file to the server.")
  }
  return json.urls[0] as string
}
