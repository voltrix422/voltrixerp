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

export type PosAdminOrderDetail = {
  order: {
    id: string
    orderNumber: string
    clientId: string
    clientName: string
    items: Array<{
      id: string
      description: string
      qty: number
      unit: string
      unitPrice: number
      companyPrice?: number
      model?: string
      inventoryItemId?: string
      isCustom?: boolean
    }>
    subtotal: number
    taxPercent: number
    tax: number
    transportCost: number
    transportLabel: string
    otherCost: number
    otherCostLabel: string
    shipping: number
    discount: number
    total: number
    status: string
    notes: string
    createdAt: string
    createdBy: string
    deliveryAddress: string
    deliveryDate: string
    dispatcher?: string | null
    pdfUrl?: string | null
    payments: Array<{
      id: string
      amount: number
      method: string
      date: string
      notes: string
      proofUrl?: string
      proofUrls?: string[]
      createdAt: string
      createdBy: string
      submissionStatus?: string
      proofOnly?: boolean
    }>
    paymentTerms: string
    creditApprovedAt?: string | null
    creditApprovedBy?: string | null
    creditNote?: string | null
    fulfillmentDispatcher?: string | null
    fulfillmentReceiverName?: string | null
    fulfillmentReceiverCnic?: string | null
    fulfillmentVehicleNumber?: string | null
    fulfillmentDate?: string | null
    fulfillmentReceiverImageUrl?: string | null
    fulfillmentReceiverCnicImageUrl?: string | null
    fulfillmentVehicleImageUrl?: string | null
    fulfillmentProductImageUrls: string[]
    fulfillmentSerialAllocations: unknown[]
    branchId?: string | null
    source?: string | null
    returnPayments: Array<{
      id: string
      amount: number
      method: string
      date: string
      notes: string
      proofUrl?: string
      proofUrls?: string[]
      createdAt: string
      createdBy: string
    }>
    returnLines: unknown[]
    returnedAt?: string | null
    returnReason?: string | null
    sellAmount: number
    companyAmount: number
    profit: number
  }
  client: {
    id: string
    name: string
    company: string
    email: string
    phone: string
    address: string
    city: string
    country: string
    website: string
    taxId: string
    ntn: string
    industry: string
    contactPerson: string
    imageUrl: string | null
    notes: string
    createdAt: string
    createdBy: string
    status: string
  } | null
  branch: { id: string; name: string; code: string } | null
}

export async function getPosAdminOrderDetail(orderId: string): Promise<PosAdminOrderDetail | null> {
  const res = await fetch(`/api/db/pos/admin-order?id=${encodeURIComponent(orderId)}`)
  if (!res.ok) return null
  return res.json()
}
