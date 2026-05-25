import { prisma } from "@/lib/db"

export async function nextSequence(id: string, prefix: string): Promise<string> {
  const row = await prisma.acctSequence.upsert({
    where: { id },
    create: { id, prefix, nextNum: 1 },
    update: { nextNum: { increment: 1 } },
  })
  const num = row.nextNum
  const year = new Date().getFullYear()
  return `${prefix}/${year}/${String(num).padStart(5, "0")}`
}
