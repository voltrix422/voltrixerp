import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const ORDER_NUMBER = "ORD-00035"
const WRONG_AMOUNT = 11111111111
const CORRECT_AMOUNT = 0.1

async function main() {
  const order = await prisma.erpOrder.findFirst({
    where: { orderNumber: ORDER_NUMBER },
  })

  if (!order) {
    console.error(`Order ${ORDER_NUMBER} not found`)
    process.exit(1)
  }

  const payments = Array.isArray(order.payments) ? [...order.payments] : []
  let updated = false

  const nextPayments = payments.map((p) => {
    const payment = p
    const amount = Number(payment.amount)
    const date = String(payment.date || "")
    const isWrongPayment =
      Math.abs(amount - WRONG_AMOUNT) < 1 ||
      (date.startsWith("2026-06-18") && amount > 1_000_000)

    if (!updated && isWrongPayment && amount !== CORRECT_AMOUNT) {
      updated = true
      console.log(
        `Fixing payment ${payment.id}: PKR ${amount.toLocaleString()} → PKR ${CORRECT_AMOUNT}`,
      )
      return { ...payment, amount: CORRECT_AMOUNT }
    }
    return payment
  })

  if (!updated) {
    console.log("No matching payment found to fix.")
    console.log("Current payments:", JSON.stringify(payments, null, 2))
    process.exit(1)
  }

  await prisma.erpOrder.update({
    where: { id: order.id },
    data: { payments: nextPayments },
  })

  const totalPaid = nextPayments
    .filter((p) => {
      const status = p.submissionStatus
      return !status || status === "approved" || status === "pending_approval"
    })
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  console.log(`Done. ${ORDER_NUMBER} total paid is now PKR ${totalPaid.toLocaleString()}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
