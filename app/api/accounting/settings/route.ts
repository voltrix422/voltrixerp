import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const settings = await prisma.acctSettings.findUnique({ where: { id: "default" } })
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const settings = await prisma.acctSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      companyName: String(body.companyName ?? "Voltrix Batteries"),
      currency: String(body.currency ?? "PKR"),
      fiscalYearStart: Number(body.fiscalYearStart ?? 7),
      lockDate: body.lockDate ? new Date(body.lockDate) : null,
      invoiceTerms: String(body.invoiceTerms ?? ""),
    },
    update: {
      companyName: body.companyName,
      currency: body.currency,
      fiscalYearStart: body.fiscalYearStart,
      lockDate: body.lockDate ? new Date(body.lockDate) : body.lockDate === null ? null : undefined,
      invoiceTerms: body.invoiceTerms,
    },
  })
  return NextResponse.json(settings)
}
