import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const jobs = await prisma.erpJob.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  
  try {
    if (body.id) {
      const job = await prisma.erpJob.update({
        where: { id: body.id },
        data: {
          title: body.title,
          location: body.location,
          type: body.type,
          description: body.description,
          requirements: body.requirements,
          salary: body.salary,
          published: body.published,
        },
      })
      return NextResponse.json(job)
    } else {
      const job = await prisma.erpJob.create({
        data: {
          title: body.title,
          location: body.location,
          type: body.type,
          description: body.description,
          requirements: body.requirements,
          salary: body.salary,
          published: body.published,
          createdBy: body.createdBy,
        },
      })
      return NextResponse.json(job)
    }
  } catch (error: any) {
    console.error("Error saving job:", error)
    return NextResponse.json({ error: error.message || "Failed to save job" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpJob.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
