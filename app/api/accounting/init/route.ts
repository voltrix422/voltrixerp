import { NextResponse } from "next/server"
import { seedAccountingModule } from "@/lib/accounting/seed"
import { withAcctApi } from "@/lib/accounting/api-route"

export async function POST() {
  return withAcctApi(async () => {
    const result = await seedAccountingModule()
    return NextResponse.json(result)
  })
}
