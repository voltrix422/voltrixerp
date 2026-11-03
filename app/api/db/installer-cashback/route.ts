import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

const STATUSES = new Set(["new", "reviewing", "approved", "paid", "rejected"])

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((u) => String(u ?? "").trim()).filter(Boolean)
}

function mapRow(r: {
  id: string
  fullName: string
  cnic: string
  phone: string
  installPlace: string
  productId: string
  productName: string
  quantity: number
  imageUrls: Prisma.JsonValue
  notes: string
  cashbackAmount: number | null
  status: string
  adminNotes: string
  reviewedBy: string
  reviewedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: r.id,
    fullName: r.fullName,
    cnic: r.cnic,
    phone: r.phone,
    installPlace: r.installPlace,
    productId: r.productId,
    productName: r.productName,
    quantity: r.quantity,
    imageUrls: asStringArray(r.imageUrls),
    notes: r.notes,
    cashbackAmount: r.cashbackAmount,
    status: r.status,
    adminNotes: r.adminNotes,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export async function GET() {
  try {
    const rows = await prisma.erpInstallerCashbackRequest.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(rows.map(mapRow))
  } catch (error) {
    console.error("[installer-cashback GET]", error)
    return NextResponse.json({ error: "Failed to load cashback requests" }, { status: 500 })
  }
}

/** Public submit from /installer-cashback */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const fullName = String(body.fullName ?? body.full_name ?? "").trim()
    const cnic = String(body.cnic ?? "").trim()
    const phone = String(body.phone ?? "").trim()
    const installPlace = String(body.installPlace ?? body.install_place ?? "").trim()
    const productName = String(body.productName ?? body.product_name ?? "").trim()
    const productId = String(body.productId ?? body.product_id ?? "").trim()
    const notes = String(body.notes ?? "").trim()
    const quantity = Math.max(1, Math.min(99, Number(body.quantity) || 1))
    const imageUrls = asStringArray(body.imageUrls ?? body.image_urls)

    if (!fullName || !cnic || !phone || !installPlace || !productName) {
      return NextResponse.json(
        { error: "Name, CNIC, phone, install place, and product are required." },
        { status: 400 },
      )
    }
    if (imageUrls.length < 1) {
      return NextResponse.json(
        { error: "Please upload at least one photo of the installation / product." },
        { status: 400 },
      )
    }
    if (imageUrls.length > 8) {
      return NextResponse.json({ error: "Maximum 8 photos allowed." }, { status: 400 })
    }

    const record = await prisma.erpInstallerCashbackRequest.create({
      data: {
        fullName,
        cnic,
        phone,
        installPlace,
        productId,
        productName,
        quantity,
        imageUrls,
        notes,
        status: "new",
      },
    })
    return NextResponse.json(mapRow(record), { status: 201 })
  } catch (error) {
    console.error("[installer-cashback POST]", error)
    return NextResponse.json({ error: "Failed to submit cashback request" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body.id ?? "").trim()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const data: Prisma.ErpInstallerCashbackRequestUpdateInput = {}
    if (body.status != null) {
      const status = String(body.status).trim()
      if (!STATUSES.has(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      data.status = status
      if (status !== "new") {
        data.reviewedAt = new Date()
        if (body.reviewedBy) data.reviewedBy = String(body.reviewedBy).trim()
      }
    }
    if (body.adminNotes != null) data.adminNotes = String(body.adminNotes)
    if (body.cashbackAmount != null) {
      const n = Number(body.cashbackAmount)
      data.cashbackAmount = Number.isFinite(n) ? n : null
    }
    if (body.reviewedBy != null) data.reviewedBy = String(body.reviewedBy).trim()

    const record = await prisma.erpInstallerCashbackRequest.update({ where: { id }, data })
    return NextResponse.json(mapRow(record))
  } catch (error) {
    console.error("[installer-cashback PATCH]", error)
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body.id ?? "").trim()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    await prisma.erpInstallerCashbackRequest.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[installer-cashback DELETE]", error)
    return NextResponse.json({ error: "Failed to delete request" }, { status: 500 })
  }
}
