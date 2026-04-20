import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

async function ensureDir(dir: string) {
  try { await fs.access(dir) } catch { await fs.mkdir(dir, { recursive: true }) }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    const folder = (formData.get("folder") as string) || "misc"

    const uploadDir = path.join(process.cwd(), "public", "uploads", folder)
    await ensureDir(uploadDir)

    const urls: string[] = []

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const ext = file.name.split(".").pop()
      const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      await fs.writeFile(path.join(uploadDir, filename), buffer)
      urls.push(`/uploads/${folder}/${filename}`)
    }

    return NextResponse.json({ urls })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Failed to upload files" }, { status: 500 })
  }
}
