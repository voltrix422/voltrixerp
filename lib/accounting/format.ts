export function fmtMoney(n: number, currency = "PKR") {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
