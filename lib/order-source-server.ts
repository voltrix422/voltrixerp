import { prisma } from "@/lib/db"
import type { Order } from "@/lib/orders"

export async function getOrderSourcePdfLabelServer(
  order: Pick<Order, "ownerUserId" | "createdBy">
) {
  if (order.ownerUserId) {
    const owner = await prisma.erpUser.findUnique({
      where: { id: order.ownerUserId },
      select: { role: true },
    })
    if (owner?.role === "sales_agent") {
      return `Sales agent · ${order.createdBy || "—"}`
    }
  }
  const name = order.createdBy?.trim()
  if (name) return `Created by · ${name}`
  return "CRM"
}
