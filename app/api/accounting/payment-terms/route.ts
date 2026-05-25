import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAcctApi } from "@/lib/accounting/api-route"

export async function GET() {
  return withAcctApi(async () => {
    return NextResponse.json(await prisma.acctPaymentTerm.findMany())
  })
}
