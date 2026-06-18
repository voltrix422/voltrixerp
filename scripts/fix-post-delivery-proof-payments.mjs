import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function paymentStatus(payment, orderStatus) {
  if (payment.submissionStatus) return payment.submissionStatus
  if (orderStatus === "delivered") return "approved"
  return "draft"
}

function reconcilePayments(order) {
  if (order.status !== "delivered") return order.payments || []

  const sorted = [...(order.payments || [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  let balancePaid = 0
  const total = Number(order.total) || 0

  return sorted.map((payment) => {
    const next = { ...payment }
    if (next.proofOnly) {
      next.amount = 0
      return next
    }

    const status = paymentStatus(next, order.status)
    const counts = status === "pending_approval" || status === "approved"
    if (!counts) return next

    if (balancePaid >= total - 0.004) {
      next.proofOnly = true
      next.amount = 0
      return next
    }

    if (Number(next.amount) > total + 0.004 && balancePaid > 0.004) {
      next.proofOnly = true
      next.amount = 0
      return next
    }

    balancePaid += Number(next.amount) || 0
    if (balancePaid > total + 0.004) {
      balancePaid -= Number(next.amount) || 0
      next.proofOnly = true
      next.amount = 0
    }
    return next
  })
}

function paymentsChanged(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after)
}

function balanceTotal(payments, orderStatus) {
  return payments
    .filter((p) => {
      if (p.proofOnly) return false
      const s = paymentStatus(p, orderStatus)
      return s === "pending_approval" || s === "approved"
    })
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
}

async function main() {
  const orders = await prisma.erpOrder.findMany({
    where: { status: "delivered" },
    select: { id: true, orderNumber: true, total: true, status: true, payments: true },
  })

  let fixed = 0

  for (const order of orders) {
    const before = Array.isArray(order.payments) ? order.payments : []
    const after = reconcilePayments(order)
    if (!paymentsChanged(before, after)) continue

    await prisma.erpOrder.update({
      where: { id: order.id },
      data: { payments: after },
    })

    const paid = balanceTotal(after, order.status)
    console.log(
      `Fixed ${order.orderNumber}: total paid now PKR ${paid.toLocaleString()} (order total PKR ${Number(order.total).toLocaleString()})`,
    )
    fixed += 1
  }

  console.log(fixed === 0 ? "No delivered orders needed fixing." : `Updated ${fixed} delivered order(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
