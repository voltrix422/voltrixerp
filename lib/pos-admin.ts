export type PosAdminTerminal = {
  id: string
  name: string
  code: string
  location: string
  isActive: boolean
}

export type PosAdminOrderBrief = {
  id: string
  orderNumber: string
  clientName: string
  status: string
  total: number
  sellAmount: number
  companyAmount: number
  profit: number
  itemCount: number
  notes: string
  branchId: string | null
  createdAt: string
  createdBy: string
  deliveryDate: string
  fulfillmentDate: string
  paymentTerms: string
  branchName?: string
}

export type PosAdminReceiptBrief = {
  id: string
  receiptNumber: string
  terminalId: string
  terminalName: string
  total: number
  subtotal: number
  discount: number
  tax: number
  paymentMethod: string
  cashierName: string
  customerName: string
  notes: string
  branchId: string | null
  itemCount: number
  createdAt: string
  branchName?: string
}

export type PosAdminBranchSummary = {
  branchId: string
  branchName: string
  branchCode: string
  terminalCount: number
  terminals: PosAdminTerminal[]
  orderCount: number
  deliveredCount: number
  openCount: number
  cancelledCount: number
  orderSellTotal: number
  orderCompanyTotal: number
  orderProfitTotal: number
  receiptCount: number
  receiptTotal: number
  combinedSaleTotal: number
  stockSkuCount: number
  stockQty: number
  orders?: PosAdminOrderBrief[]
  receipts?: PosAdminReceiptBrief[]
}

export type PosAdminCombined = {
  branchCount: number
  terminalCount: number
  orderCount: number
  deliveredCount: number
  openCount: number
  cancelledCount: number
  orderSellTotal: number
  orderCompanyTotal: number
  orderProfitTotal: number
  receiptCount: number
  receiptTotal: number
  combinedSaleTotal: number
  stockSkuCount: number
  stockQty: number
}

export type PosAdminSummary = {
  from: string
  to: string
  combined: PosAdminCombined
  byBranch: PosAdminBranchSummary[]
  recentOrders: PosAdminOrderBrief[]
  recentReceipts: PosAdminReceiptBrief[]
}

export async function getPosAdminSummary(params: {
  from: string
  to: string
  branchId?: string
  detail?: boolean
}): Promise<PosAdminSummary | null> {
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
  })
  if (params.branchId) qs.set("branchId", params.branchId)
  if (params.detail) qs.set("detail", "1")

  const res = await fetch(`/api/db/pos/admin-summary?${qs}`)
  if (!res.ok) return null
  return res.json()
}

export function formatPosPkr(amount: number): string {
  return `PKR ${(amount ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}
