import { prisma } from "@/lib/db"

export const DEFAULT_INVESTOR_EMAIL = "investor@voltrix.com"
export const DEFAULT_INVESTOR_PASSWORD = "Investor@2026"

const NAMED_INVESTORS = [
  {
    id: "investor-asif-razzak",
    name: "Mr. Asif Razzak",
    email: "asif@voltrix.com",
    password: "Asif@2026",
  },
  {
    id: "investor-saqib-razzak",
    name: "Saqib Razzak",
    email: "saqib@voltrix.com",
    password: "Saqib@2026",
  },
  {
    id: "investor-tauseef-shah",
    name: "Tauseef Shah",
    email: "tauseef@voltrix.com",
    password: "Tauseef@2026",
  },
] as const

async function ensureNamedInvestor(inv: (typeof NAMED_INVESTORS)[number]) {
  const existing = await prisma.erpUser.findFirst({
    where: { email: { equals: inv.email, mode: "insensitive" } },
  })
  if (existing) return existing
  try {
    return await prisma.erpUser.create({
      data: {
        id: inv.id,
        name: inv.name,
        email: inv.email,
        password: inv.password,
        role: "investor",
        modules: ["dashboard", "crm"],
        jobTitle: "investor",
        location: "",
        baseSalary: 0,
        commissionPercent: 0,
        investorInvestment: 0,
        investorRoiPercent: 0,
        investorRoiPeriod: "annual",
      },
    })
  } catch {
    return prisma.erpUser.findFirst({
      where: { email: { equals: inv.email, mode: "insensitive" } },
    })
  }
}

/** Create the three named investor logins if missing. Never overwrites an existing password. */
export async function ensureDefaultInvestorUser() {
  for (const inv of NAMED_INVESTORS) {
    await ensureNamedInvestor(inv)
  }
}
