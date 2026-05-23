import { NextRequest, NextResponse } from "next/server"
import { existsSync } from "fs"
import { readFile, stat } from "fs/promises"
import path from "path"

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
}

function safeSegments(segments: string[]): string[] | null {
  const safe: string[] = []
  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") return null
    if (segment.includes("/") || segment.includes("\\")) return null
    safe.push(segment)
  }
  return safe
}

/** Serve files from public/uploads (payment proofs, product images, etc.). */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params
  const safe = safeSegments(segments ?? [])
  if (!safe?.length) {
    return new NextResponse("Not found", { status: 404 })
  }

  const uploadsRoot = path.join(process.cwd(), "public", "uploads")
  const filePath = path.join(uploadsRoot, ...safe)
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(uploadsRoot))) {
    return new NextResponse("Not found", { status: 404 })
  }

  if (!existsSync(resolved)) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    const info = await stat(resolved)
    if (!info.isFile()) {
      return new NextResponse("Not found", { status: 404 })
    }

    const ext = path.extname(resolved).toLowerCase()
    const contentType = MIME_BY_EXT[ext] || "application/octet-stream"
    const buf = await readFile(resolved)

    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
