import { prisma } from "@/lib/db"

export const DEFAULT_INVESTOR_EMAIL = "investor@voltrix.com"
export const DEFAULT_INVESTOR_PASSWORD = "Investor@2026"

/** Create the default investor login if none exists yet. Never overwrites an existing password. */
export async function ensureDefaultInvestorUser() {
  const existingInvestor = await prisma.erpUser.findFirst({
    where: { role: { equals: "investor", mode: "insensitive" } },
  })
  if (existingInvestor) return existingInvestor

  const emailTaken = await prisma.erpUser.findFirst({
    where: { email: { equals: DEFAULT_INVESTOR_EMAIL, mode: "insensitive" } },
  })
  if (emailTaken) return emailTaken

  try {
    return await prisma.erpUser.create({
      data: {
        id: "investor-portal-default",
        name: "Investor",
        email: DEFAULT_INVESTOR_EMAIL,
        password: DEFAULT_INVESTOR_PASSWORD,
        role: "investor",
        modules: ["dashboard", "crm"],
        jobTitle: "investor",
        location: "",
        baseSalary: 0,
        commissionPercent: 0,
      },
    })
  } catch {
    return prisma.erpUser.findFirst({
      where: { email: { equals: DEFAULT_INVESTOR_EMAIL, mode: "insensitive" } },
    })
  }
}
