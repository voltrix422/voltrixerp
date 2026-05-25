import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { computeInvoiceLines, postInvoice } from "@/lib/accounting/posting"

export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get("type")
  const invoices = await prisma.acctInvoice.findMany({
    where: type ? { invoiceType: type } : {},
    orderBy: { invoiceDate: "desc" },
    include: { lines: true },
    take: 200,
  })
  const partners = await prisma.acctPartner.findMany()
  const pmap = Object.fromEntries(partners.map(p => [p.id, p.name]))
  return NextResponse.json(
    invoices.map(i => ({ ...i, partnerName: pmap[i.partnerId] ?? "" }))
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.action === "post" && body.id) {
    try {
      const inv = await postInvoice(body.id)
      return NextResponse.json(inv)
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 })
    }
  }

  const lines = body.lines ?? []
  const computed = await computeInvoiceLines(lines)
  const inv = await prisma.acctInvoice.create({
    data: {
      invoiceType: String(body.invoiceType),
      partnerId: String(body.partnerId),
      journalId: String(body.journalId),
      invoiceDate: new Date(body.invoiceDate),
      dueDate: new Date(body.dueDate ?? body.invoiceDate),
      paymentTermId: String(body.paymentTermId ?? ""),
      amountUntaxed: computed.amountUntaxed,
      amountTax: computed.amountTax,
      amountTotal: computed.amountTotal,
      amountResidual: computed.amountTotal,
      narration: String(body.narration ?? ""),
      createdBy: String(body.createdBy ?? ""),
      lines: {
        create: computed.lines.map(l => ({
          productName: l.productName ?? "",
          accountCode: l.accountCode,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxId: l.taxId ?? "",
          subtotal: l.subtotal,
        })),
      },
    },
    include: { lines: true },
  })
  return NextResponse.json(inv)
}
