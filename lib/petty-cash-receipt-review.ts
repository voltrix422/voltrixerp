import { prisma } from "@/lib/db"

export type PettyCashReceiptStatus = "pending" | "approved" | "rejected"

export function normalizePettyCashReceiptStatus(
  value: unknown,
): PettyCashReceiptStatus | null {
  const status = String(value || "")
    .trim()
    .toLowerCase()
  if (status === "pending" || status === "approved" || status === "rejected") {
    return status
  }
  return null
}

/** Resolve admin reviewer from session id and/or display name. */
export async function resolvePettyCashReviewer(
  reviewedById?: string | null,
  reviewedBy?: string | null,
) {
  const id = reviewedById?.trim()
  if (id) {
    const byId = await prisma.erpUser.findUnique({
      where: { id },
      select: { id: true, role: true, name: true },
    })
    if (byId && (byId.role === "superadmin" || byId.role === "admin")) {
      return byId
    }
  }

  const name = reviewedBy?.trim()
  if (name) {
    const byName = await prisma.erpUser.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        role: { in: ["superadmin", "admin"] },
      },
      select: { id: true, role: true, name: true },
    })
    if (byName) return byName
  }

  return null
}
