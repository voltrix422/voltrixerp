import { NextRequest, NextResponse } from "next/server"
import {
  profitAndLoss,
  balanceSheet,
  generalLedger,
  agedBalances,
} from "@/lib/accounting/reports"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const report = searchParams.get("report")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const accountId = searchParams.get("accountId")
  const fromDate = from ? new Date(from) : undefined
  const toDate = to ? new Date(to + "T23:59:59") : undefined

  try {
    switch (report) {
      case "pnl":
        return NextResponse.json(await profitAndLoss(fromDate, toDate))
      case "balance_sheet":
        return NextResponse.json(await balanceSheet(toDate))
      case "general_ledger":
        return NextResponse.json(await generalLedger(accountId ?? undefined, fromDate, toDate))
      case "aged_receivable":
        return NextResponse.json(await agedBalances("receivable"))
      case "aged_payable":
        return NextResponse.json(await agedBalances("payable"))
      default:
        return NextResponse.json({ error: "Unknown report" }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
