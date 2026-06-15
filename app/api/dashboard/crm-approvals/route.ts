import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  APPROVED_ORDER_STATUSES,
  PENDING_APPROVAL_STATUS,
} from "@/lib/order-approval-statuses"

const APPROVED_LIST_LIMIT = 150

export async function GET() {
  try {
    const [pending, approved, approvedTotal] = await Promise.all([
      prisma.erpOrder.findMany({
        where: { status: PENDING_APPROVAL_STATUS },
        orderBy: { createdAt: "desc" },
      }),
      prisma.erpOrder.findMany({
        where: { status: { in: [...APPROVED_ORDER_STATUSES] } },
        orderBy: { createdAt: "desc" },
        take: APPROVED_LIST_LIMIT,
      }),
      prisma.erpOrder.count({
        where: { status: { in: [...APPROVED_ORDER_STATUSES] } },
      }),
    ])

    return NextResponse.json({
      pending,
      approved,
      counts: {
        pending: pending.length,
        approved: approvedTotal,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
