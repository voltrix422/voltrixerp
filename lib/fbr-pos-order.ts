import { prisma } from "@/lib/db"
import { isBranchPosOrderSource } from "@/lib/branch-pos-order-stock-server"
import { fbrNotConfiguredReason, getFbrConfig } from "@/lib/fbr-config"
import {
  buildFbrSaleInvoicePayload,
  postFbrSaleInvoice,
} from "@/lib/fbr-digital-invoice"
import { normalizeFbrStatus } from "@/lib/fbr-status"
import type { OrderItem } from "@/lib/orders"

type FbrOrderRow = {
  id: string
  orderNumber: string
  clientId: string
  clientName: string
  deliveryAddress: string
  createdAt: Date
  items: unknown
  subtotal: number
  tax: number
  taxPercent: number
  total: number
  transportCost: number
  otherCost: number
  shipping: number
  source: string | null
  fbrStatus: string
  fbrInvoiceNumber: string
  fbrQr: string
  fbrError: string
  fbrPostedAt: Date | null
}

function toFbrOrderRow(row: unknown): FbrOrderRow | null {
  if (!row || typeof row !== "object") return null
  const r = row as Record<string, unknown>
  const createdAt = r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt ?? ""))
  return {
    id: String(r.id ?? ""),
    orderNumber: String(r.orderNumber ?? ""),
    clientId: String(r.clientId ?? ""),
    clientName: String(r.clientName ?? ""),
    deliveryAddress: String(r.deliveryAddress ?? ""),
    createdAt,
    items: r.items,
    subtotal: Number(r.subtotal) || 0,
    tax: Number(r.tax) || 0,
    taxPercent: Number(r.taxPercent) || 0,
    total: Number(r.total) || 0,
    transportCost: Number(r.transportCost) || 0,
    otherCost: Number(r.otherCost) || 0,
    shipping: Number(r.shipping) || 0,
    source: (r.source as string | null) ?? null,
    fbrStatus: String(r.fbrStatus ?? ""),
    fbrInvoiceNumber: String(r.fbrInvoiceNumber ?? ""),
    fbrQr: String(r.fbrQr ?? ""),
    fbrError: String(r.fbrError ?? ""),
    fbrPostedAt: r.fbrPostedAt ? new Date(r.fbrPostedAt as string | Date) : null,
  }
}

async function saveFbrFields(
  orderId: string,
  data: {
    fbrStatus: string
    fbrInvoiceNumber?: string
    fbrQr?: string
    fbrError?: string
    fbrPostedAt?: Date | null
  },
): Promise<FbrOrderRow> {
  return toFbrOrderRow(
    await prisma.erpOrder.update({
      where: { id: orderId },
      data: {
        fbrStatus: data.fbrStatus,
        fbrInvoiceNumber: data.fbrInvoiceNumber ?? "",
        fbrQr: data.fbrQr ?? "",
        fbrError: data.fbrError ?? "",
        fbrPostedAt: data.fbrPostedAt === undefined ? undefined : data.fbrPostedAt,
      } as never,
    }),
  ) as FbrOrderRow
}

/**
 * Post a Branch POS order to FBR Digital Invoicing.
 * Never throws to the caller for FBR/network errors — those are stored on the order.
 * Does not change order totals. Old orders are left blank unless retry is requested.
 */
export async function postBranchPosOrderToFbr(orderId: string): Promise<FbrOrderRow | null> {
  const order = toFbrOrderRow(await prisma.erpOrder.findUnique({ where: { id: orderId } }))
  if (!order) return null
  if (!isBranchPosOrderSource(order.source)) {
    throw new Error("FBR posting is only enabled for Branch POS orders.")
  }
  if (normalizeFbrStatus(order.fbrStatus) === "sent" && order.fbrInvoiceNumber) {
    return order
  }

  await saveFbrFields(order.id, {
    fbrStatus: "pending",
    fbrError: "",
    fbrInvoiceNumber: order.fbrInvoiceNumber,
    fbrQr: order.fbrQr,
  })

  const config = getFbrConfig()
  if (!config.configured) {
    return saveFbrFields(order.id, {
      fbrStatus: "pending",
      fbrError: fbrNotConfiguredReason(config),
      fbrInvoiceNumber: "",
      fbrQr: "",
    })
  }

  const items = Array.isArray(order.items) ? (order.items as OrderItem[]) : []
  const taxable = items.filter(
    (item) =>
      !item.isFreeItem &&
      Math.max(0, Number(item.qty) || 0) > 0 &&
      Math.max(0, Number(item.unitPrice) || 0) > 0,
  )
  if (taxable.length === 0) {
    return saveFbrFields(order.id, {
      fbrStatus: "failed",
      fbrError: "No taxable items to send to FBR",
      fbrInvoiceNumber: "",
      fbrQr: "",
      fbrPostedAt: new Date(),
    })
  }

  const client = order.clientId
    ? await prisma.erpClient.findUnique({
        where: { id: order.clientId },
        select: { name: true, company: true, ntn: true, address: true, city: true },
      })
    : null

  const payload = buildFbrSaleInvoicePayload(
    {
      clientName: order.clientName,
      deliveryAddress: order.deliveryAddress || "",
      createdAt: Number.isNaN(order.createdAt.getTime())
        ? new Date().toISOString()
        : order.createdAt.toISOString(),
      items,
      subtotal: order.subtotal,
      tax: order.tax,
      taxPercent: order.taxPercent,
      total: order.total,
      transportCost: order.transportCost,
      otherCost: order.otherCost,
      shipping: order.shipping,
    },
    client,
    config,
  )

  const result = await postFbrSaleInvoice(payload, config)
  if (result.ok) {
    return saveFbrFields(order.id, {
      fbrStatus: "sent",
      fbrInvoiceNumber: result.invoiceNumber,
      fbrQr: result.qr || result.invoiceNumber,
      fbrError: "",
      fbrPostedAt: new Date(),
    })
  }

  return saveFbrFields(order.id, {
    fbrStatus: "failed",
    fbrInvoiceNumber: "",
    fbrQr: "",
    fbrError: result.error || "FBR rejected this invoice",
    fbrPostedAt: new Date(),
  })
}
