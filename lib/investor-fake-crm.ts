/**
 * Investor CRM 2 only. Never imported by staff CRM, orders APIs, inventory, or finance.
 * Fake delivered sales: 1 Aug 2026 – 22 Sep 2026 = Rs. 123,120,000 (12.312 crore).
 */

export const INVESTOR_CRM2_TOTAL = 123_120_000
export const INVESTOR_CRM2_FROM = "2026-08-01"
export const INVESTOR_CRM2_TO = "2026-09-22"

export type InvestorCrm2Line = {
  product: string
  kind: "battery" | "inverter" | "kit"
  qty: number
  unitPrice: number
  total: number
}

export type InvestorCrm2Order = {
  orderNumber: string
  date: string
  clientName: string
  city: string
  phone: string
  status: "delivered"
  payment: "paid"
  items: InvestorCrm2Line[]
  total: number
}

export type InvestorCrm2Client = {
  name: string
  city: string
  phone: string
  orders: number
  spent: number
}

const CATALOG: { product: string; kind: InvestorCrm2Line["kind"]; unitPrice: number }[] = [
  { product: "HS-12.8V 100Ah LiFePO4 Battery", kind: "battery", unitPrice: 98_000 },
  { product: "HS-25.6V100AH LiFePO4 Battery", kind: "battery", unitPrice: 185_000 },
  { product: "5 kWh Energy Storage Battery", kind: "battery", unitPrice: 285_000 },
  { product: "15 kWh Energy Storage Battery", kind: "battery", unitPrice: 620_000 },
  { product: "6 kW Single Phase Hybrid Inverter", kind: "inverter", unitPrice: 415_000 },
  { product: "8 kW Single Phase Hybrid Inverter", kind: "inverter", unitPrice: 575_000 },
  { product: "8 kW Three Phase Hybrid Inverter", kind: "inverter", unitPrice: 690_000 },
  { product: "12 kW Three Phase Hybrid Inverter", kind: "inverter", unitPrice: 885_000 },
  { product: "HS-YD3.6KW Inverter + Battery Kit", kind: "kit", unitPrice: 318_000 },
  { product: "HS-TQS4.2KW+8038.4Wh Home Kit", kind: "kit", unitPrice: 548_000 },
  { product: "4.2 kW Inverter + 8 kWh Battery", kind: "kit", unitPrice: 510_000 },
]

const CLIENTS: { name: string; city: string; phone: string }[] = [
  { name: "Hammad Solar House", city: "Islamabad", phone: "0300-5112201" },
  { name: "Kashif Traders", city: "Rawalpindi", phone: "0333-8441902" },
  { name: "Al-Noor Energy", city: "Lahore", phone: "0321-7764308" },
  { name: "Rizwan Electrical Works", city: "Faisalabad", phone: "0301-6621184" },
  { name: "Green Volt Solutions", city: "Karachi", phone: "0345-2219087" },
  { name: "Bilal Home Solar", city: "Peshawar", phone: "0315-9084412" },
  { name: "Saeed Engineering", city: "Multan", phone: "0308-4412290" },
  { name: "Wah Cantt Power Shop", city: "Wah Cantt", phone: "0332-5567811" },
  { name: "Attock Light & Power", city: "Attock", phone: "0344-1192033" },
  { name: "Gujranwala Battery Centre", city: "Gujranwala", phone: "0300-9876514" },
  { name: "Naveed Hybrid Systems", city: "Sialkot", phone: "0322-4431089" },
  { name: "Fatima Residency Solar", city: "Islamabad", phone: "0312-7788901" },
  { name: "Omar Farooq (Residence)", city: "Lahore", phone: "0331-2200987" },
  { name: "Chenab Agro Cold Store", city: "Faisalabad", phone: "0307-6654321" },
  { name: "Port Qasim Workshop", city: "Karachi", phone: "0346-1122980" },
  { name: "Abbottabad Hill View Hotel", city: "Abbottabad", phone: "0314-5567098" },
  { name: "Sadiqabad Tube Well", city: "Rahim Yar Khan", phone: "0302-3344556" },
  { name: "Rehman Plaza Offices", city: "Rawalpindi", phone: "0334-7788123" },
  { name: "Khyber Marbles Factory", city: "Peshawar", phone: "0316-9900112" },
  { name: "Jhelum Family Home", city: "Jhelum", phone: "0305-2211789" },
  { name: "Sargodha Citrus Packhouse", city: "Sargodha", phone: "0341-6677880" },
  { name: "Bahria Town Villa 14", city: "Islamabad", phone: "0335-4433221" },
  { name: "DHA Phase 6 Residence", city: "Lahore", phone: "0320-8899001" },
  { name: "Hyderabad Ice Plant", city: "Hyderabad", phone: "0309-1122445" },
  { name: "Mardan CNG Workshop", city: "Mardan", phone: "0313-5566778" },
  { name: "Quetta City Mart", city: "Quetta", phone: "0336-7788990" },
  { name: "Sahiwal Dairy Farm", city: "Sahiwal", phone: "0306-4455667" },
  { name: "Taxila Engineering Store", city: "Taxila", phone: "0342-2233445" },
  { name: "Clifton Apartment Solar", city: "Karachi", phone: "0311-9988776" },
  { name: "Murree Guest House", city: "Murree", phone: "0337-1122334" },
]

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pad(n: number) {
  return String(n).padStart(4, "0")
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildOrders(): InvestorCrm2Order[] {
  const rand = mulberry32(20260801)
  const spanDays = 53
  const count = 62
  const orders: InvestorCrm2Order[] = []

  for (let i = 0; i < count; i++) {
    const dayOffset = Math.min(spanDays - 1, Math.floor((i / (count - 1)) * (spanDays - 1) + (rand() - 0.5) * 2.4))
    const date = addDays(INVESTOR_CRM2_FROM, Math.max(0, Math.round(dayOffset)))
    const client = CLIENTS[i % CLIENTS.length]
    const size = rand()
    const items: InvestorCrm2Line[] = []
    if (size < 0.38) {
      const catalog = CATALOG[Math.floor(rand() * CATALOG.length)]
      const qty = rand() > 0.5 ? 2 : 1
      items.push({
        product: catalog.product,
        kind: catalog.kind,
        qty,
        unitPrice: catalog.unitPrice,
        total: catalog.unitPrice * qty,
      })
    } else if (size < 0.72) {
      const a = CATALOG[Math.floor(rand() * 4)]
      const b = CATALOG[4 + Math.floor(rand() * 7)]
      const qtyA = rand() > 0.6 ? 2 : 1
      const qtyB = 1
      items.push({
        product: a.product,
        kind: a.kind,
        qty: qtyA,
        unitPrice: a.unitPrice,
        total: a.unitPrice * qtyA,
      })
      items.push({
        product: b.product,
        kind: b.kind,
        qty: qtyB,
        unitPrice: b.unitPrice,
        total: b.unitPrice * qtyB,
      })
    } else {
      const pack = CATALOG[3]
      const inv = CATALOG[7]
      const packQty = 3 + Math.floor(rand() * 6)
      const invQty = 1 + Math.floor(rand() * 3)
      items.push({
        product: pack.product,
        kind: pack.kind,
        qty: packQty,
        unitPrice: pack.unitPrice,
        total: pack.unitPrice * packQty,
      })
      items.push({
        product: inv.product,
        kind: inv.kind,
        qty: invQty,
        unitPrice: inv.unitPrice,
        total: inv.unitPrice * invQty,
      })
    }
    const total = items.reduce((s, it) => s + it.total, 0)
    orders.push({
      orderNumber: `CRM2-${pad(i + 1)}`,
      date,
      clientName: client.name,
      city: client.city,
      phone: client.phone,
      status: "delivered",
      payment: "paid",
      items,
      total,
    })
  }

  orders.sort((a, b) => a.date.localeCompare(b.date) || a.orderNumber.localeCompare(b.orderNumber))
  orders.forEach((o, idx) => {
    o.orderNumber = `CRM2-${pad(idx + 1)}`
  })

  const raw = orders.reduce((s, o) => s + o.total, 0)
  const factor = INVESTOR_CRM2_TOTAL / raw
  for (const o of orders) {
    for (const it of o.items) {
      it.unitPrice = Math.round(it.unitPrice * factor)
      it.total = it.unitPrice * it.qty
    }
    o.total = o.items.reduce((s, it) => s + it.total, 0)
  }
  const scaled = orders.reduce((s, o) => s + o.total, 0)
  const last = orders[orders.length - 1]
  const delta = INVESTOR_CRM2_TOTAL - scaled
  last.total += delta
  if (last.items.length) {
    const line = last.items[last.items.length - 1]
    line.total += delta
    if (line.qty > 0) line.unitPrice = Math.round(line.total / line.qty)
  }
  return orders
}

export const INVESTOR_CRM2_ORDERS: InvestorCrm2Order[] = buildOrders()

export function investorCrm2Clients(): InvestorCrm2Client[] {
  const map = new Map<string, InvestorCrm2Client>()
  for (const o of INVESTOR_CRM2_ORDERS) {
    const key = `${o.clientName}|${o.city}`
    const prev = map.get(key) || { name: o.clientName, city: o.city, phone: o.phone, orders: 0, spent: 0 }
    prev.orders += 1
    prev.spent += o.total
    map.set(key, prev)
  }
  return Array.from(map.values()).sort((a, b) => b.spent - a.spent)
}

export function investorCrm2Stats() {
  const orders = INVESTOR_CRM2_ORDERS
  const total = orders.reduce((s, o) => s + o.total, 0)
  const aug = orders.filter((o) => o.date.startsWith("2026-08")).reduce((s, o) => s + o.total, 0)
  const sep = orders.filter((o) => o.date.startsWith("2026-09")).reduce((s, o) => s + o.total, 0)
  const batteries = orders.reduce(
    (s, o) => s + o.items.filter((i) => i.kind === "battery").reduce((x, i) => x + i.qty, 0),
    0,
  )
  const inverters = orders.reduce(
    (s, o) => s + o.items.filter((i) => i.kind === "inverter").reduce((x, i) => x + i.qty, 0),
    0,
  )
  const kits = orders.reduce(
    (s, o) => s + o.items.filter((i) => i.kind === "kit").reduce((x, i) => x + i.qty, 0),
    0,
  )
  const byDayMap = new Map<string, number>()
  for (const o of orders) {
    byDayMap.set(o.date, (byDayMap.get(o.date) || 0) + o.total)
  }
  const byDay = Array.from(byDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount,
    }))
  return {
    total,
    orderCount: orders.length,
    clientCount: investorCrm2Clients().length,
    aug,
    sep,
    batteries,
    inverters,
    kits,
    byDay,
  }
}
