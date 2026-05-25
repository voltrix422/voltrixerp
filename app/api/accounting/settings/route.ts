import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAcctApi } from "@/lib/accounting/api-route"

const DEFAULTS = {
  id: "default",
  companyName: "Voltrix Batteries",
  currency: "PKR",
  fiscalYearStart: 7,
  lockDate: null as Date | null,
  invoiceTerms: "Payment due within terms. Bank transfer preferred.",
  seededAt: null as Date | null,
}

export async function GET() {
  return withAcctApi(async () => {
    const settings = await prisma.acctSettings.findUnique({ where: { id: "default" } })
    return NextResponse.json(settings ?? DEFAULTS)
  })
}

export async function PATCH(req: NextRequest) {
  return withAcctApi(async () => {
    const body = await req.json()
    const settings = await prisma.acctSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        companyName: String(body.companyName ?? DEFAULTS.companyName),
        currency: String(body.currency ?? DEFAULTS.currency),
        fiscalYearStart: Number(body.fiscalYearStart ?? DEFAULTS.fiscalYearStart),
        lockDate: body.lockDate ? new Date(body.lockDate) : null,
        invoiceTerms: String(body.invoiceTerms ?? ""),
        seededAt: new Date(),
      },
      update: {
        companyName: body.companyName != null ? String(body.companyName) : undefined,
        currency: body.currency != null ? String(body.currency) : undefined,
        fiscalYearStart: body.fiscalYearStart != null ? Number(body.fiscalYearStart) : undefined,
        lockDate:
          body.lockDate === null || body.lockDate === ""
            ? null
            : body.lockDate
              ? new Date(body.lockDate)
              : undefined,
        invoiceTerms: body.invoiceTerms != null ? String(body.invoiceTerms) : undefined,
      },
    })
    return NextResponse.json(settings)
  })
}
