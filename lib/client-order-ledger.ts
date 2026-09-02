import type { Client } from "@/lib/crm"
import { getCrmItemsTotalQtyLabel, getCrmLineQtyLabels } from "@/lib/crm-line-items-summary"
import {
  aggregateOrderPaymentStats,
  isDeliveredFullyPaidOrder,
  isPartiallyPaidOrder,
  type OrderPaymentAggregate,
} from "@/lib/order-payment-stats"
import {
  getOrderAmountPaid,
  getOrderCreditBalance,
  getOrderNetSalesValue,
  getPaymentSubmissionStatus,
  hasOutstandingCredit,
  isOrderOnCredit,
  isOrderReturned,
  STATUS_LABELS,
  type Order,
} from "@/lib/orders"

export type LedgerClientRef = {
  id: string
  name: string
  company: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  ntn: string
  contactPerson: string
}

export type ClientLedgerOrderRow = {
  orderNumber: string
  date: string
  status: string
  qtyLabel: string
  items: string
  billed: number
  paid: number
  balance: number
  paymentLabel: string
  createdBy: string
  notes: string
}

export type ClientLedgerPaymentRow = {
  date: string
  orderNumber: string
  type: string
  method: string
  amount: number
  status: string
  notes: string
}

export type ClientLedgerPayload = {
  client: LedgerClientRef
  generatedBy: string
  generatedAt: string
  stats: OrderPaymentAggregate
  fullyPaidCount: number
  partialCount: number
  onCreditCount: number
  notCreditCount: number
  orders: ClientLedgerOrderRow[]
  payments: ClientLedgerPaymentRow[]
}

const NAME_PREFIX = "name:"

export function ledgerClientNameKey(name: string) {
  return `${NAME_PREFIX}${name.trim().toLowerCase()}`
}

export function isNameLedgerClientId(id: string) {
  return id.startsWith(NAME_PREFIX)
}

export function clientToLedgerRef(client: Client): LedgerClientRef {
  return {
    id: client.id,
    name: client.name,
    company: client.company || "",
    email: client.email || "",
    phone: client.phone || "",
    address: client.address || "",
    city: client.city || "",
    country: client.country || "",
    ntn: client.ntn || client.taxId || "",
    contactPerson: client.contactPerson || "",
  }
}

export function listLedgerClients(clients: Client[], orders: Order[]): LedgerClientRef[] {
  const byId = new Map<string, LedgerClientRef>()
  for (const client of clients) {
    byId.set(client.id, clientToLedgerRef(client))
  }
  const knownNames = new Set(clients.map((c) => c.name.trim().toLowerCase()).filter(Boolean))

  for (const order of orders) {
    if (order.clientId && byId.has(order.clientId)) continue
    const name = (order.clientName || "").trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (knownNames.has(key)) continue
    const id = ledgerClientNameKey(name)
    if (byId.has(id)) continue
    byId.set(id, {
      id,
      name,
      company: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      ntn: "",
      contactPerson: "",
    })
    knownNames.add(key)
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}

export function findLedgerClient(clients: LedgerClientRef[], id: string): LedgerClientRef | null {
  return clients.find((c) => c.id === id) || null
}

export function orderBelongsToClient(order: Order, client: Pick<LedgerClientRef, "id" | "name">): boolean {
  if (isNameLedgerClientId(client.id)) {
    return (order.clientName || "").trim().toLowerCase() === client.name.trim().toLowerCase()
  }
  if (order.clientId) return order.clientId === client.id
  return (order.clientName || "").trim().toLowerCase() === client.name.trim().toLowerCase()
}

export function clientLedgerPaymentLabel(order: Order): string {
  if (isOrderReturned(order)) return "Returned"
  const paid = getOrderAmountPaid(order)
  const balance = getOrderCreditBalance(order)
  if (balance <= 0.004) return "Fully Paid"
  if (isPartiallyPaidOrder(order) || (paid > 0.004 && balance > 0.004)) {
    return hasOutstandingCredit(order) ? "Partial · Credit" : "Partial"
  }
  if (hasOutstandingCredit(order)) return "On Credit"
  if (!isOrderOnCredit(order)) return "Not Credit"
  return "Outstanding"
}

function formatDate(iso?: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString("en-GB")
}

function itemsSummary(order: Order): string {
  const names = (order.items || [])
    .map((i) => i.description?.trim())
    .filter(Boolean)
  if (!names.length) return "—"
  return names.slice(0, 4).join(" · ") + (names.length > 4 ? "…" : "")
}

function qtySummary(order: Order): string {
  const total = getCrmItemsTotalQtyLabel(order.items)
  const lines = getCrmLineQtyLabels(order.items)
  if (lines.length <= 1) return total
  return `${total} (${lines.join(" + ")})`
}

function paymentStatusLabel(status: string) {
  if (status === "pending_approval") return "Pending"
  if (status === "draft") return "Draft"
  if (status === "approved") return "Approved"
  return status
}

export function buildClientLedgerPayload(
  client: LedgerClientRef,
  orders: Order[],
  generatedBy: string,
): ClientLedgerPayload {
  const sorted = [...orders].sort((a, b) => {
    const da = new Date(a.createdAt).getTime()
    const db = new Date(b.createdAt).getTime()
    return db - da
  })
  const stats = aggregateOrderPaymentStats(sorted)
  const orderRows: ClientLedgerOrderRow[] = sorted.map((order) => ({
    orderNumber: order.orderNumber || "—",
    date: formatDate(order.createdAt),
    status: STATUS_LABELS[order.status] || order.status,
    qtyLabel: qtySummary(order),
    items: itemsSummary(order),
    billed: getOrderNetSalesValue(order),
    paid: getOrderAmountPaid(order),
    balance: getOrderCreditBalance(order),
    paymentLabel: clientLedgerPaymentLabel(order),
    createdBy: order.createdBy || "",
    notes: (order.notes || "").trim(),
  }))

  const payments: ClientLedgerPaymentRow[] = []
  for (const order of sorted) {
    for (const payment of order.payments || []) {
      payments.push({
        date: formatDate(payment.date || payment.createdAt),
        orderNumber: order.orderNumber || "—",
        type: payment.proofOnly ? "Proof only" : "Payment",
        method: payment.method || "—",
        amount: Number(payment.amount) || 0,
        status: payment.proofOnly
          ? "Proof"
          : paymentStatusLabel(getPaymentSubmissionStatus(payment, order.status)),
        notes: (payment.notes || "").trim(),
      })
    }
    for (const refund of order.returnPayments || []) {
      payments.push({
        date: formatDate(refund.date || refund.createdAt),
        orderNumber: order.orderNumber || "—",
        type: "Refund",
        method: refund.method || "—",
        amount: Number(refund.amount) || 0,
        status: "Paid out",
        notes: (refund.notes || "").trim(),
      })
    }
    for (const cashback of order.cashbackPayments || []) {
      payments.push({
        date: formatDate(cashback.date || cashback.createdAt),
        orderNumber: order.orderNumber || "—",
        type: cashback.source === "other" ? "Cashback (other)" : "Cashback",
        method: cashback.method || "—",
        amount: Number(cashback.amount) || 0,
        status: "Paid out",
        notes: (cashback.notes || "").trim(),
      })
    }
  }
  payments.sort((a, b) => {
    const da = a.date.localeCompare(b.date)
    if (da) return da
    return a.orderNumber.localeCompare(b.orderNumber)
  })

  return {
    client,
    generatedBy: generatedBy.trim() || "CRM",
    generatedAt: new Date().toLocaleString("en-PK"),
    stats,
    fullyPaidCount: sorted.filter(isDeliveredFullyPaidOrder).length,
    partialCount: sorted.filter(isPartiallyPaidOrder).length,
    onCreditCount: sorted.filter(hasOutstandingCredit).length,
    notCreditCount: sorted.filter((o) => !isOrderOnCredit(o) && !isOrderReturned(o)).length,
    orders: orderRows,
    payments,
  }
}

export function slugLedgerClientName(name: string) {
  return name.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "client"
}
