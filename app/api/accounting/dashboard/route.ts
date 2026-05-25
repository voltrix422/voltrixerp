import { NextResponse } from "next/server"
import { dashboardStats } from "@/lib/accounting/reports"
import { isAccountingSeeded } from "@/lib/accounting/seed"

export async function GET() {
  const seeded = await isAccountingSeeded()
  if (!seeded) return NextResponse.json({ seeded: false })
  const stats = await dashboardStats()
  return NextResponse.json({ seeded: true, stats })
}
