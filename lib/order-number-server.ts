import { prisma } from "@/lib/db"

const ORD_PAD = 5

export function parseOrderNumberSeq(orderNumber: string): number | null {
  const match = orderNumber.trim().match(/^ORD-(\d+)$/i)
  if (!match) return null
  const seq = Number.parseInt(match[1], 10)
  return Number.isFinite(seq) ? seq : null
}

export function formatOrderNumber(seq: number): string {
  return `ORD-${String(seq).padStart(ORD_PAD, "0")}`
}

export async function getMaxOrderNumberSeq(): Promise<number> {
  const orders = await prisma.erpOrder.findMany({
    select: { orderNumber: true },
  })

  let max = 0
  for (const order of orders) {
    const seq = parseOrderNumberSeq(order.orderNumber)
    if (seq != null && seq > max) max = seq
  }
  return max
}

/** Assign the next unused ORD-##### based on the highest existing sequence. */
export async function generateNextOrderNumber(): Promise<string> {
  let seq = (await getMaxOrderNumberSeq()) + 1

  while (seq < 1_000_000) {
    const candidate = formatOrderNumber(seq)
    const exists = await prisma.erpOrder.findFirst({
      where: { orderNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
    seq += 1
  }

  return `ORD-${Date.now()}`
}

/** Renumber duplicate order numbers (keeps the oldest record per number). */
export async function repairDuplicateOrderNumbers(): Promise<number> {
  const orders = await prisma.erpOrder.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, orderNumber: true },
  })

  const groups = new Map<string, Array<{ id: string; orderNumber: string }>>()
  for (const order of orders) {
    const key = order.orderNumber.trim()
    const list = groups.get(key) ?? []
    list.push(order)
    groups.set(key, list)
  }

  let fixed = 0
  let maxSeq = await getMaxOrderNumberSeq()

  for (const group of groups.values()) {
    if (group.length <= 1) continue
    for (let i = 1; i < group.length; i++) {
      maxSeq += 1
      const newNumber = formatOrderNumber(maxSeq)
      await prisma.erpOrder.update({
        where: { id: group[i].id },
        data: { orderNumber: newNumber },
      })
      await prisma.erpOrderFulfillmentHistory.updateMany({
        where: { orderId: group[i].id },
        data: { orderNumber: newNumber },
      })
      fixed += 1
    }
  }

  return fixed
}
