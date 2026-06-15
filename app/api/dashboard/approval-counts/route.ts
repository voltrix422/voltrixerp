import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { PERSONAL_LEDGER_MARKER, PERSONAL_LEDGER_PURPOSE } from "@/lib/petty-cash-personal"

export async function GET() {
  try {
    const [crmOrders, purchaseOrders, transfers, pettyRequests, pettyReceipts] = await Promise.all([
      prisma.erpOrder.count({ where: { status: "pending_approval" } }),
      prisma.erpPurchaseOrder.count({ where: { status: "sent_to_admin" } }),
      prisma.erpBranchTransferRequest.count({ where: { status: "pending" } }),
      prisma.erpPettyCashAllocation.count({
        where: {
          status: "pending",
          NOT: [
            { purpose: PERSONAL_LEDGER_PURPOSE },
            { notes: { contains: PERSONAL_LEDGER_MARKER } },
          ],
        },
      }),
      prisma.erpPettyCashReceipt.count({ where: { status: "pending" } }),
    ])

    const pettyCash = pettyRequests + pettyReceipts

    return NextResponse.json({
      crmOrders,
      purchaseOrders,
      transfers,
      pettyCash,
      total: crmOrders + purchaseOrders + transfers + pettyCash,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
