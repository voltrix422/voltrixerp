/**
 * Investor CRM 2 only. Never imported by staff CRM, orders APIs, inventory, or finance.
 * Fake delivered sales using the same unit prices as CRM Product Prices (dealership / wholesale / retail).
 * Period: 1 Jul 2026 – 2 Oct 2026 · target ≈ Rs. 125,000,000 (12.5 crore).
 */

const INVESTOR_CRM2_TARGET = 125_000_000
export const INVESTOR_CRM2_FROM = "2026-07-01"
export const INVESTOR_CRM2_TO = "2026-10-02"

export type InvestorCrm2Line = {
  product: string
  kind: "battery" | "inverter"
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

type PriceTier = { retail: number; wholesale: number; dealership: number }

/** Mirrors CRM → Product Prices (only SKUs with a sellable price). */
const CATALOG: {
  product: string
  kind: InvestorCrm2Line["kind"]
  model: string
  prices: PriceTier
}[] = [
  {
    product: "15.6 KWh Battery Storage",
    kind: "battery",
    model: "MAN-15-6-KWH-BATTERY-STORAGE",
    prices: { retail: 620_000, wholesale: 580_000, dealership: 560_000 },
  },
  {
    product: "12 kW Three Phase Hybrid Inverter",
    kind: "inverter",
    model: "MAN-12KW-3-PHASE-HYBRID-INVE",
    prices: { retail: 520_000, wholesale: 460_000, dealership: 435_000 },
  },
  {
    product: "8 kW Three Phase Hybrid Inverter",
    kind: "inverter",
    model: "MAN-8-KW-THREE-PHASE-HYBRID-",
    prices: { retail: 440_000, wholesale: 410_000, dealership: 385_000 },
  },
  {
    product: "8 kW Hybrid Inverter",
    kind: "inverter",
    model: "MAN-8-KW-HYBRID-INVERTER",
    prices: { retail: 300_000, wholesale: 256_000, dealership: 244_000 },
  },
  {
    product: "6 kW Hybrid Inverter",
    kind: "inverter",
    model: "MAN-6-KW-HYBRID-INVERTER",
    prices: { retail: 230_000, wholesale: 210_000, dealership: 200_000 },
  },
  {
    product: "INVERTER (HS-TQS4.2KW)",
    kind: "inverter",
    model: "MAN-INVERTER-HS-TQS4-2KW",
    prices: { retail: 440_000, wholesale: 420_000, dealership: 390_000 },
  },
  {
    product: "8 KWh Lithium Iron Phosphate Battery",
    kind: "battery",
    model: "MAN-8-KWH-LITHIUM-IRON-PHOSP",
    prices: { retail: 300_000, wholesale: 300_000, dealership: 300_000 },
  },
  {
    product: "LITHIUM IRON PHOSPHATE BATTERY (HS-BG5000W)",
    kind: "battery",
    model: "MAN-LITHIUM-IRON-PHOSPHATE-B",
    prices: { retail: 230_000, wholesale: 220_000, dealership: 210_000 },
  },
  {
    product: "HS-25.6V100AH",
    kind: "battery",
    model: "MAN-HS-25-6V100AH",
    prices: { retail: 110_000, wholesale: 110_000, dealership: 110_000 },
  },
  {
    product: "LITHIUM IRON PHOSPHATE BATTERY (HS-TL100Ah 12.8V)",
    kind: "battery",
    model: "MAN-LITHIUM-IRON-PHOSPHATE-B-1",
    prices: { retail: 63_000, wholesale: 60_000, dealership: 57_000 },
  },
]

const BATTERIES = CATALOG.filter((c) => c.kind === "battery")
const INVERTERS = CATALOG.filter((c) => c.kind === "inverter")

type ClientTier = "dealership" | "wholesale" | "retail"

const CLIENTS: { name: string; city: string; phone: string; tier: ClientTier }[] = [
  { name: "Hammad Solar House", city: "Islamabad", phone: "0300-5112201", tier: "dealership" },
  { name: "Kashif Traders", city: "Rawalpindi", phone: "0333-8441902", tier: "dealership" },
  { name: "Al-Noor Energy", city: "Lahore", phone: "0321-7764308", tier: "dealership" },
  { name: "Rizwan Electrical Works", city: "Faisalabad", phone: "0301-6621184", tier: "wholesale" },
  { name: "Green Volt Solutions", city: "Karachi", phone: "0345-2219087", tier: "dealership" },
  { name: "Bilal Home Solar", city: "Peshawar", phone: "0315-9084412", tier: "wholesale" },
  { name: "Saeed Engineering", city: "Multan", phone: "0308-4412290", tier: "dealership" },
  { name: "Wah Cantt Power Shop", city: "Wah Cantt", phone: "0332-5567811", tier: "dealership" },
  { name: "Attock Light & Power", city: "Attock", phone: "0344-1192033", tier: "wholesale" },
  { name: "Gujranwala Battery Centre", city: "Gujranwala", phone: "0300-9876514", tier: "dealership" },
  { name: "Naveed Hybrid Systems", city: "Sialkot", phone: "0322-4431089", tier: "dealership" },
  { name: "Fatima Residency Solar", city: "Islamabad", phone: "0312-7788901", tier: "wholesale" },
  { name: "Omar Farooq (Residence)", city: "Lahore", phone: "0331-2200987", tier: "retail" },
  { name: "Chenab Agro Cold Store", city: "Faisalabad", phone: "0307-6654321", tier: "wholesale" },
  { name: "Port Qasim Workshop", city: "Karachi", phone: "0346-1122980", tier: "dealership" },
  { name: "Abbottabad Hill View Hotel", city: "Abbottabad", phone: "0314-5567098", tier: "retail" },
  { name: "Sadiqabad Tube Well", city: "Rahim Yar Khan", phone: "0302-3344556", tier: "wholesale" },
  { name: "Rehman Plaza Offices", city: "Rawalpindi", phone: "0334-7788123", tier: "wholesale" },
  { name: "Khyber Marbles Factory", city: "Peshawar", phone: "0316-9900112", tier: "dealership" },
  { name: "Jhelum Family Home", city: "Jhelum", phone: "0305-2211789", tier: "retail" },
  { name: "Sargodha Citrus Packhouse", city: "Sargodha", phone: "0341-6677880", tier: "wholesale" },
  { name: "Bahria Town Villa 14", city: "Islamabad", phone: "0335-4433221", tier: "retail" },
  { name: "DHA Phase 6 Residence", city: "Lahore", phone: "0320-8899001", tier: "retail" },
  { name: "Hyderabad Ice Plant", city: "Hyderabad", phone: "0309-1122445", tier: "wholesale" },
  { name: "Mardan CNG Workshop", city: "Mardan", phone: "0313-5566778", tier: "dealership" },
  { name: "Quetta City Mart", city: "Quetta", phone: "0336-7788990", tier: "wholesale" },
  { name: "Sahiwal Dairy Farm", city: "Sahiwal", phone: "0306-4455667", tier: "wholesale" },
  { name: "Taxila Engineering Store", city: "Taxila", phone: "0342-2233445", tier: "dealership" },
  { name: "Clifton Apartment Solar", city: "Karachi", phone: "0311-9988776", tier: "retail" },
  { name: "Murree Guest House", city: "Murree", phone: "0337-1122334", tier: "retail" },
  { name: "Gulberg Solar Point", city: "Lahore", phone: "0324-6611220", tier: "dealership" },
  { name: "I-9 Industrial Power", city: "Islamabad", phone: "0301-7788992", tier: "dealership" },
  { name: "Sukkur Cold Chain", city: "Sukkur", phone: "0315-4455661", tier: "wholesale" },
  { name: "Swat Valley Resort", city: "Mingora", phone: "0345-9900113", tier: "retail" },
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

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T12:00:00`).getTime()
  const b = new Date(`${to}T12:00:00`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

function unitPriceFor(catalog: (typeof CATALOG)[number], tier: ClientTier) {
  if (tier === "dealership" && catalog.prices.dealership > 0) return catalog.prices.dealership
  if (tier === "wholesale" && catalog.prices.wholesale > 0) return catalog.prices.wholesale
  return catalog.prices.retail
}

function lineFrom(
  catalog: (typeof CATALOG)[number],
  qty: number,
  tier: ClientTier,
): InvestorCrm2Line {
  const unitPrice = unitPriceFor(catalog, tier)
  return {
    product: catalog.product,
    kind: catalog.kind,
    qty,
    unitPrice,
    total: unitPrice * qty,
  }
}

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length)]
}

function buildBasket(rand: () => number, tier: ClientTier, size: "small" | "mid" | "large"): InvestorCrm2Line[] {
  if (size === "small") {
    const bat = pick(rand, [CATALOG[7], CATALOG[8], CATALOG[9], CATALOG[6]])
    const qty =
      bat.product.includes("HS-25") || bat.product.includes("12.8V")
        ? 1 + Math.floor(rand() * 2)
        : 1
    return [lineFrom(bat, qty, tier)]
  }
  if (size === "mid") {
    const bat = pick(rand, [CATALOG[0], CATALOG[6], CATALOG[7]])
    const inv = pick(rand, INVERTERS)
    const batQty = bat === CATALOG[0] ? 1 + Math.floor(rand() * 2) : 1
    return [lineFrom(bat, batQty, tier), lineFrom(inv, 1, tier)]
  }
  const packQty = 3 + Math.floor(rand() * 3) // 3–5
  const invQty = 1 + Math.floor(rand() * 2) // 1–2
  return [lineFrom(CATALOG[0], packQty, tier), lineFrom(CATALOG[1], invQty, tier)]
}

function buildOrders(): InvestorCrm2Order[] {
  const rand = mulberry32(20260711)
  const spanDays = daysBetween(INVESTOR_CRM2_FROM, INVESTOR_CRM2_TO) + 1
  const orders: InvestorCrm2Order[] = []

  // Staged generation: July ~1.2 Cr, then Aug–Oct to reach 12.5 Cr with exact CRM unit prices.
  const stages: { fromDay: number; days: number; count: number; largeShare: number }[] = [
    { fromDay: 0, days: 31, count: 12, largeShare: 0.1 }, // July ~1+ Cr
    { fromDay: 31, days: 31, count: 26, largeShare: 0.32 }, // August
    { fromDay: 62, days: 30, count: 28, largeShare: 0.34 }, // September
    { fromDay: 92, days: 2, count: 5, largeShare: 0.4 }, // Oct 1–2
  ]

  let seq = 0
  for (const stage of stages) {
    for (let i = 0; i < stage.count; i++) {
      const dayOffset = stage.fromDay + Math.floor(rand() * stage.days)
      const date = addDays(INVESTOR_CRM2_FROM, Math.min(spanDays - 1, dayOffset))
      const client = CLIENTS[seq % CLIENTS.length]
      const roll = rand()
      const size: "small" | "mid" | "large" =
        roll < stage.largeShare ? "large" : roll < stage.largeShare + 0.45 ? "mid" : "small"
      const items = buildBasket(rand, client.tier, size)
      const total = items.reduce((s, it) => s + it.total, 0)
      orders.push({
        orderNumber: `CRM2-${pad(++seq)}`,
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
  }

  orders.sort((a, b) => a.date.localeCompare(b.date) || a.orderNumber.localeCompare(b.orderNumber))
  orders.forEach((o, idx) => {
    o.orderNumber = `CRM2-${pad(idx + 1)}`
  })

  let sum = orders.reduce((s, o) => s + o.total, 0)

  // Trim oversized book from the end (prefer removing late large packs) while keeping July.
  while (sum > INVESTOR_CRM2_TARGET + 300_000 && orders.length > 40) {
    const idx = orders.length - 1
    if (orders[idx].date.startsWith("2026-07") && orders.filter((o) => o.date.startsWith("2026-07")).length <= 8) {
      break
    }
    sum -= orders[idx].total
    orders.pop()
  }

  // Top up with a few mid/large exact-price orders (not dozens of tiny lines).
  let guard = 0
  while (sum < INVESTOR_CRM2_TARGET - 560_000 && guard < 25) {
    guard++
    const remaining = INVESTOR_CRM2_TARGET - sum
    const client = pick(rand, CLIENTS)
    const useLarge = remaining > 2_500_000 && rand() > 0.4
    const items = useLarge
      ? buildBasket(rand, client.tier, "large")
      : buildBasket(rand, client.tier, "mid")
    const total = items.reduce((s, it) => s + it.total, 0)
    if (total > remaining + 100_000) {
      const smallItems = buildBasket(rand, client.tier, "small")
      const smallTotal = smallItems.reduce((s, it) => s + it.total, 0)
      if (smallTotal > remaining) break
      const day = 70 + Math.floor(rand() * 24)
      orders.push({
        orderNumber: `CRM2-TEMP`,
        date: addDays(INVESTOR_CRM2_FROM, Math.min(spanDays - 1, day)),
        clientName: client.name,
        city: client.city,
        phone: client.phone,
        status: "delivered",
        payment: "paid",
        items: smallItems,
        total: smallTotal,
      })
      sum += smallTotal
      continue
    }
    const day = 55 + Math.floor(rand() * 38)
    orders.push({
      orderNumber: `CRM2-TEMP`,
      date: addDays(INVESTOR_CRM2_FROM, Math.min(spanDays - 1, day)),
      clientName: client.name,
      city: client.city,
      phone: client.phone,
      status: "delivered",
      payment: "paid",
      items,
      total,
    })
    sum += total
  }

  orders.sort((a, b) => a.date.localeCompare(b.date) || a.clientName.localeCompare(b.clientName))
  orders.forEach((o, idx) => {
    o.orderNumber = `CRM2-${pad(idx + 1)}`
  })

  // Exact finish with dealership TL100Ah (57,000) units — never alter unit prices.
  sum = orders.reduce((s, o) => s + o.total, 0)
  let gap = INVESTOR_CRM2_TARGET - sum
  const small = CATALOG[9]
  const smallPrice = unitPriceFor(small, "dealership")
  const last = orders[orders.length - 1]
  if (last && gap > 0 && smallPrice > 0) {
    const qty = Math.floor(gap / smallPrice)
    if (qty > 0) {
      const extra = lineFrom(small, qty, "dealership")
      last.items.push(extra)
      last.total += extra.total
      gap -= extra.total
    }
  }

  return orders
}

export const INVESTOR_CRM2_ORDERS: InvestorCrm2Order[] = buildOrders()

export const INVESTOR_CRM2_TOTAL = INVESTOR_CRM2_ORDERS.reduce((s, o) => s + o.total, 0)

export function investorCrm2Clients(): InvestorCrm2Client[] {
  const map = new Map<string, InvestorCrm2Client>()
  for (const o of INVESTOR_CRM2_ORDERS) {
    const key = `${o.clientName}|${o.city}`
    const prev = map.get(key) || {
      name: o.clientName,
      city: o.city,
      phone: o.phone,
      orders: 0,
      spent: 0,
    }
    prev.orders += 1
    prev.spent += o.total
    map.set(key, prev)
  }
  return Array.from(map.values()).sort((a, b) => b.spent - a.spent)
}

export function investorCrm2Stats() {
  const orders = INVESTOR_CRM2_ORDERS
  const total = orders.reduce((s, o) => s + o.total, 0)
  const jul = orders.filter((o) => o.date.startsWith("2026-07")).reduce((s, o) => s + o.total, 0)
  const aug = orders.filter((o) => o.date.startsWith("2026-08")).reduce((s, o) => s + o.total, 0)
  const sep = orders.filter((o) => o.date.startsWith("2026-09")).reduce((s, o) => s + o.total, 0)
  const oct = orders.filter((o) => o.date.startsWith("2026-10")).reduce((s, o) => s + o.total, 0)
  const batteries = orders.reduce(
    (s, o) => s + o.items.filter((i) => i.kind === "battery").reduce((x, i) => x + i.qty, 0),
    0,
  )
  const inverters = orders.reduce(
    (s, o) => s + o.items.filter((i) => i.kind === "inverter").reduce((x, i) => x + i.qty, 0),
    0,
  )
  const kits = 0
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
    jul,
    aug,
    sep,
    oct,
    batteries,
    inverters,
    kits,
    byDay,
  }
}
