import type { Order } from "@/lib/orders"

export type InvoiceClientProfile = {
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
}

export function invoiceClientFromRecord(
  record: Record<string, unknown> | null | undefined,
): InvoiceClientProfile | null {
  if (!record) return null
  return {
    name: String(record.name ?? "").trim(),
    company: String(record.company ?? "").trim(),
    email: String(record.email ?? "").trim(),
    phone: String(record.phone ?? "").trim(),
    address: String(record.address ?? "").trim(),
    city: String(record.city ?? "").trim(),
    country: String(record.country ?? "").trim(),
    website: String(record.website ?? "").trim(),
    taxId: String(record.taxId ?? "").trim(),
    ntn: String(record.ntn ?? "").trim(),
    industry: String(record.industry ?? "").trim(),
    contactPerson: String(record.contactPerson ?? "").trim(),
  }
}

export type InvoiceClientDetailRow = { label: string; value: string }

export function buildInvoiceClientDetailRows(
  order: Pick<Order, "clientName" | "deliveryAddress">,
  client: InvoiceClientProfile | null,
): InvoiceClientDetailRow[] {
  const rows: InvoiceClientDetailRow[] = []
  const push = (label: string, value?: string) => {
    const v = value?.trim()
    if (v) rows.push({ label, value: v })
  }

  const deliveryAddr = order.deliveryAddress?.trim()
  const clientAddr = client?.address?.trim()
  if (deliveryAddr) push("Delivery address", deliveryAddr)
  else if (clientAddr) push("Address", clientAddr)

  const cityCountry = [client?.city, client?.country].filter(Boolean).join(", ")
  if (cityCountry) push("City", cityCountry)

  push("Focal person", client?.contactPerson)
  push("Phone", client?.phone)
  push("Email", client?.email)
  push("NTN", client?.ntn)
  push("Tax ID", client?.taxId)
  if (
    client?.company &&
    client.company.trim().toLowerCase() !== (order.clientName || "").trim().toLowerCase()
  ) {
    push("Company", client.company)
  }
  push("Industry", client?.industry)
  push("Website", client?.website)

  return rows
}

/** MODEL column: product name on first line, model code on second when they differ. */
export function formatInvoiceModelCell(description: string, model: string | null): string {
  const name = description?.trim() || ""
  const code = model?.trim() || ""
  if (code && name && code.toLowerCase() !== name.toLowerCase()) {
    return `${name}\n${code}`
  }
  return code || name || "—"
}

export function invoiceModelDisplayLines(description: string, model: string | null): {
  name: string
  code: string | null
} {
  const name = description?.trim() || model?.trim() || "—"
  const code = model?.trim() || null
  if (!code || code.toLowerCase() === name.toLowerCase()) {
    return { name, code: null }
  }
  return { name, code }
}
