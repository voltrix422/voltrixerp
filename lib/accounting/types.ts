export type AccountType =
  | "asset" | "liability" | "equity" | "income" | "expense"
  | "receivable" | "payable" | "bank" | "cash" | "other"

export type JournalType = "sale" | "purchase" | "bank" | "cash" | "general"
export type PartnerType = "customer" | "vendor" | "both"
export type MoveState = "draft" | "posted" | "cancelled"
export type InvoiceType = "out_invoice" | "in_invoice" | "out_refund" | "in_refund"
export type PaymentType = "inbound" | "outbound"

export interface InvoiceLineInput {
  productName?: string
  accountCode: string
  quantity?: number
  unitPrice: number
  taxId?: string
}

export interface MoveLineInput {
  accountId: string
  name: string
  debit?: number
  credit?: number
  partnerId?: string
  analyticCode?: string
}
