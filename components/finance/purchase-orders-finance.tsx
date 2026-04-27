"use client"
import { FinalizedOrdersTab } from "@/components/finance/finalized-orders-tab"

interface PurchaseOrdersFinanceProps {
  search: string
  dateFrom: string
  dateTo: string
}

export function PurchaseOrdersFinance({ search, dateFrom, dateTo }: PurchaseOrdersFinanceProps) {
  return <FinalizedOrdersTab search={search} dateFrom={dateFrom} dateTo={dateTo} />
}
