/**
 * One-shot: remove test alerts and duplicate petty-cash "pending review"
 * rows that paired with "awaiting approval" for the same user/message.
 */
const { PrismaClient } = require("@prisma/client")

async function main() {
  const prisma = new PrismaClient()
  try {
    const test = await prisma.erpNotification.deleteMany({
      where: {
        OR: [
          { title: "Test notification" },
          { title: { contains: "test alert", mode: "insensitive" } },
          { message: { contains: "sent a test alert", mode: "insensitive" } },
        ],
      },
    })

    const pendingReview = await prisma.erpNotification.findMany({
      where: {
        OR: [
          { title: { endsWith: "pending review" } },
          { title: { contains: "pending review" } },
        ],
      },
      select: { id: true, userId: true, title: true, message: true, createdAt: true },
    })

    const toDelete = []
    for (const n of pendingReview) {
      const twinTitle = n.title.replace(/pending review$/i, "awaiting approval").trim()
      const twin = await prisma.erpNotification.findFirst({
        where: {
          userId: n.userId,
          message: n.message,
          title: twinTitle,
          id: { not: n.id },
          createdAt: {
            gte: new Date(n.createdAt.getTime() - 60 * 60 * 1000),
            lte: new Date(n.createdAt.getTime() + 60 * 60 * 1000),
          },
        },
        select: { id: true },
      })
      if (twin) toDelete.push(n.id)
    }

    let dupes = { count: 0 }
    if (toDelete.length) {
      dupes = await prisma.erpNotification.deleteMany({
        where: { id: { in: [...new Set(toDelete)] } },
      })
    }

    console.log(
      JSON.stringify({
        ok: true,
        deletedTest: test.count,
        deletedDuplicatePendingReview: dupes.count,
      }),
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
