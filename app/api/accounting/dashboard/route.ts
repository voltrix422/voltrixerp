import { NextResponse } from "next/server"
import { dashboardStats } from "@/lib/accounting/reports"
import { isAccountingSeeded } from "@/lib/accounting/seed"
import { withAcctApi } from "@/lib/accounting/api-route"

export async function GET() {
  return withAcctApi(async () => {
    const seeded = await isAccountingSeeded()
    if (!seeded) {
      return NextResponse.json({ seeded: false, stats: null })
    }
    const stats = await dashboardStats()
    return NextResponse.json({ seeded: true, stats })
  })
}
