import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const blogs = await prisma.erpBlog.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(blogs)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  
  try {
    if (body.id) {
      const blog = await prisma.erpBlog.update({
        where: { id: body.id },
        data: {
          title: body.title,
          slug: body.slug,
          excerpt: body.excerpt,
          content: body.content,
          coverImage: body.coverImage,
          published: body.published,
          publishedAt: body.published ? new Date() : null,
        },
      })
      return NextResponse.json(blog)
    } else {
      const blog = await prisma.erpBlog.create({
        data: {
          title: body.title,
          slug: body.slug,
          excerpt: body.excerpt,
          content: body.content,
          coverImage: body.coverImage,
          published: body.published,
          publishedAt: body.published ? new Date() : null,
          createdBy: body.createdBy,
        },
      })
      return NextResponse.json(blog)
    }
  } catch (error: any) {
    console.error("Error saving blog:", error)
    return NextResponse.json({ error: "Failed to save blog" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpBlog.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
