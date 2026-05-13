import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

async function ensureDir(dir: string) {
  try { await fs.access(dir) } catch { await fs.mkdir(dir, { recursive: true }) }
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "application/pdf": "pdf",
  "text/plain": "txt",
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    const folder = (formData.get("folder") as string) || "misc"
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "") || "misc"

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", safeFolder)
    await ensureDir(uploadDir)

    const urls: string[] = []

    for (const file of files) {
      if (!file || typeof file.arrayBuffer !== "function") continue
      if (!file.type || !MIME_TO_EXT[file.type]) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type || "unknown"}. Use JPG, PNG, WEBP, GIF, AVIF, PDF, or TXT.` },
          { status: 400 }
        )
      }

      const bytes = await file.arrayBuffer()
      if (!bytes || bytes.byteLength === 0) {
        return NextResponse.json({ error: "One of the uploaded files is empty or corrupted." }, { status: 400 })
      }
      const buffer = Buffer.from(bytes)
      const ext = MIME_TO_EXT[file.type]
      const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`
      await fs.writeFile(path.join(uploadDir, filename), buffer)
      urls.push(`/uploads/${safeFolder}/${filename}`)
    }

    return NextResponse.json({ urls })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Failed to upload files" }, { status: 500 })
  }
}
