import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  getPosOrderCompanyAmount,
  getPosOrderProfit,
  getPosOrderSellAmount,
} from "@/lib/branch-pos-profit"
import type { OrderItem } from "@/lib/orders"

export const dynamic = "force-dynamic"

function asItems(raw: unknown): OrderItem[] {
  return Array.isArray(raw) ? (raw as OrderItem[]) : []
}

function mapClient(row: {
  id: string
  name: string
  company: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  website: string
  taxId: string
  ntn: string
  industry: string
  contactPerson: string
  imageUrl: string | null
  notes: string
  createdAt: Date
  createdBy: string
  status: string
} | null) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    company: row.company || "",
    email: row.email || "",
    phone: row.phone || "",
    address: row.address || "",
    city: row.city || "",
    country: row.country || "",
    website: row.website || "",
    taxId: row.taxId || "",
    ntn: row.ntn || "",
    industry: row.industry || "",
    contactPerson: row.contactPerson || "",
    imageUrl: row.imageUrl || null,
    notes: row.notes || "",
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy || "",
    status: row.status || "active",
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim()
  if (!id) {
    return NextResponse.json({ error: "Order id required" }, { status: 400 })
  }

  const order = await prisma.erpOrder.findUnique({ where: { id } })
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const source = String(order.source || "").trim().toLowerCase()
  const isPos =
    source === "branch_pos" || (order.notes || "").includes("Branch POS ·")
  if (!isPos) {
    return NextResponse.json({ error: "Not a POS order" }, { status: 400 })
  }

  const [client, branch] = await Promise.all([
    order.clientId
      ? prisma.erpClient.findUnique({ where: { id: order.clientId } })
      : Promise.resolve(null),
    order.branchId
      ? prisma.erpBranch.findUnique({
          where: { id: order.branchId },
          select: { id: true, name: true, code: true },
        })
      : Promise.resolve(null),
  ])

  const items = asItems(order.items)
  const sellAmount = items.length > 0 ? getPosOrderSellAmount({ items }) : Number(order.total) || 0
  const companyAmount = getPosOrderCompanyAmount({ items })
  const profit = getPosOrderProfit({ items })

  const productUrls = Array.isArray(order.fulfillmentProductImageUrls)
    ? (order.fulfillmentProductImageUrls as string[])
    : []

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      clientId: order.clientId,
      clientName: order.clientName,
      items,
      subtotal: order.subtotal,
      taxPercent: order.taxPercent,
      tax: order.tax,
      transportCost: order.transportCost,
      transportLabel: order.transportLabel,
      otherCost: order.otherCost,
      otherCostLabel: order.otherCostLabel,
      shipping: order.shipping,
      discount: order.discount,
      total: order.total,
      status: order.status,
      notes: order.notes,
      createdAt:
        order.createdAt instanceof Date
          ? order.createdAt.toISOString()
          : String(order.createdAt),
      createdBy: order.createdBy,
      deliveryAddress: order.deliveryAddress,
      deliveryDate: order.deliveryDate,
      dispatcher: order.dispatcher,
      pdfUrl: order.pdfUrl,
      payments: Array.isArray(order.payments) ? order.payments : [],
      paymentTerms: order.paymentTerms,
      creditApprovedAt: order.creditApprovedAt,
      creditApprovedBy: order.creditApprovedBy,
      creditNote: order.creditNote,
      fulfillmentDispatcher: order.fulfillmentDispatcher,
      fulfillmentReceiverName: order.fulfillmentReceiverName,
      fulfillmentReceiverCnic: order.fulfillmentReceiverCnic,
      fulfillmentVehicleNumber: order.fulfillmentVehicleNumber,
      fulfillmentDate: order.fulfillmentDate,
      fulfillmentReceiverImageUrl: order.fulfillmentReceiverImageUrl,
      fulfillmentReceiverCnicImageUrl: order.fulfillmentReceiverCnicImageUrl,
      fulfillmentVehicleImageUrl: order.fulfillmentVehicleImageUrl,
      fulfillmentProductImageUrls: productUrls,
      fulfillmentSerialAllocations: Array.isArray(order.fulfillmentSerialAllocations)
        ? order.fulfillmentSerialAllocations
        : [],
      branchId: order.branchId,
      source: order.source,
      returnPayments: Array.isArray(order.returnPayments) ? order.returnPayments : [],
      returnLines: Array.isArray(order.returnLines) ? order.returnLines : [],
      returnedAt: order.returnedAt,
      returnReason: order.returnReason,
      sellAmount,
      companyAmount,
      profit,
    },
    client: mapClient(client),
    branch: branch
      ? { id: branch.id, name: branch.name, code: branch.code }
      : null,
  })
}
