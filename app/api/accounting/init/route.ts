import { NextResponse } from "next/server"
import { seedAccountingModule } from "@/lib/accounting/seed"

export async function POST() {
  try {
    const result = await seedAccountingModule()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
