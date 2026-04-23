import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const tickets = await prisma.erpTicket.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(tickets)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  
  try {
    // Generate ticket number
    const ticketCount = await prisma.erpTicket.count()
    const ticketNumber = `TKT-${String(ticketCount + 1).padStart(4, '0')}`
    
    const ticket = await prisma.erpTicket.create({
      data: {
        ticketNumber,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone || null,
        subject: body.subject,
        description: body.description,
        priority: body.priority || "medium",
        status: "open",
        createdBy: body.createdBy,
      },
    })
    return NextResponse.json(ticket)
  } catch (error) {
    console.error("Error creating ticket:", error)
    return NextResponse.json({ error: "Failed to create ticket", details: String(error) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const updateData: any = {
    customerName: body.customerName,
    customerEmail: body.customerEmail,
    customerPhone: body.customerPhone,
    subject: body.subject,
    description: body.description,
    priority: body.priority,
    status: body.status,
    assignedTo: body.assignedTo,
    resolution: body.resolution,
  }
  
  // Set closedAt when status changes to closed
  if (body.status === "closed" && !body.closedAt) {
    updateData.closedAt = new Date()
  }
  
  const ticket = await prisma.erpTicket.update({
    where: { id: body.id },
    data: updateData,
  })
  return NextResponse.json(ticket)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpTicket.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
