import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { createDefaultProductTermsTemplate } from "@/lib/product-terms"

const DATA_FILE = path.join(process.cwd(), "data", "product-terms-templates.json")

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE)
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
    await fs.writeFile(DATA_FILE, JSON.stringify([createDefaultProductTermsTemplate()], null, 2))
  }
}

async function readTemplates() {
  await ensureDataFile()
  const data = await fs.readFile(DATA_FILE, "utf-8")
  const templates = JSON.parse(data)
  return Array.isArray(templates) ? templates : [createDefaultProductTermsTemplate()]
}

async function writeTemplates(templates: unknown[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(templates, null, 2))
}

export async function GET() {
  try {
    const templates = await readTemplates()
    return NextResponse.json(templates)
  } catch (error) {
    console.error("Error reading product terms templates:", error)
    return NextResponse.json([createDefaultProductTermsTemplate()])
  }
}

export async function POST(request: NextRequest) {
  try {
    const template = await request.json()
    const templates = await readTemplates()

    const nextTemplate = {
      id: template.id || crypto.randomUUID(),
      name: String(template.name || "Untitled terms").trim(),
      content: String(template.content || ""),
      fileUrl: template.fileUrl || null,
      isDefault: Boolean(template.isDefault),
      created_at: template.created_at || new Date().toISOString(),
    }

    if (nextTemplate.isDefault) {
      templates.forEach((item: { isDefault?: boolean }) => {
        item.isDefault = false
      })
    }

    templates.unshift(nextTemplate)
    await writeTemplates(templates)
    return NextResponse.json(nextTemplate)
  } catch (error) {
    console.error("Error creating product terms template:", error)
    return NextResponse.json({ error: "Failed to create terms template" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const updatedTemplate = await request.json()
    const templates = await readTemplates()
    const index = templates.findIndex((item: { id: string }) => item.id === updatedTemplate.id)

    if (index === -1) {
      return NextResponse.json({ error: "Terms template not found" }, { status: 404 })
    }

    if (updatedTemplate.isDefault) {
      templates.forEach((item: { isDefault?: boolean }) => {
        item.isDefault = false
      })
    }

    templates[index] = {
      ...templates[index],
      ...updatedTemplate,
      name: String(updatedTemplate.name || templates[index].name).trim(),
      content: String(updatedTemplate.content ?? templates[index].content),
    }

    await writeTemplates(templates)
    return NextResponse.json(templates[index])
  } catch (error) {
    console.error("Error updating product terms template:", error)
    return NextResponse.json({ error: "Failed to update terms template" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 })
    }

    const templates = await readTemplates()
    const filtered = templates.filter((item: { id: string }) => item.id !== id)

    if (filtered.length === templates.length) {
      return NextResponse.json({ error: "Terms template not found" }, { status: 404 })
    }

    if (!filtered.some((item: { isDefault?: boolean }) => item.isDefault)) {
      filtered[0].isDefault = true
    }

    await writeTemplates(filtered)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting product terms template:", error)
    return NextResponse.json({ error: "Failed to delete terms template" }, { status: 500 })
  }
}
