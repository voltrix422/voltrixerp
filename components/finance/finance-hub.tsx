"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { ArrowRight, Loader2, RefreshCw, ChevronDown, X, Download, FileSpreadsheet, Scale, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadFinanceOverviewPdf } from "@/lib/finance-report-pdf"
import { downloadFinanceSalesReportPdf } from "@/lib/generate-finance-sales-report-pdf"
import { downloadFinanceSalesReportExcel } from "@/lib/generate-finance-sales-report-excel"
import {
  downloadFinanceOperatingExpensesExcel,
  downloadFinanceOperatingExpensesPdf,
} from "@/lib/generate-finance-operating-expenses-report"
import { downloadIfrsFinancialStatementsPdf } from "@/lib/generate-ifrs-financial-statements-pdf"
import type { FinanceOrderRow, FinancePosRow } from "@/lib/finance-report-details"
import type { OrderPaymentAggregate, OrderPaymentPeriodBreakdown } from "@/lib/order-payment-stats"
import {
  type MoneyOutDetailLine,
  type MoneyOutDetailsPayload,
} from "@/lib/finance-money-out-details"
import { useAuth } from "@/components/auth-provider"

type OrderPaymentsPayload = {
  allTime: OrderPaymentAggregate
  inPeriod: OrderPaymentPeriodBreakdown
}

type Breakdown = {
  moneyIn: {
    clientPayments: number
    posSales: number
    incomeRecords: number
    loans: number
    loansReceived?: number
    loanRecoveries?: number
  }
  moneyOut: {
    expenses: number
    loansGiven?: number
    loanRepayments?: number
    salaries: number
    localPurchases: number
    purchaseLedger: number
    purchaseLedgerPurchases?: number
    purchaseLedgerRents?: number
    importedPurchases: number
    importShipments: number
    importPsw?: number
    importCharges?: number
    importChargesCombined?: number
    pettyCash: number
    advances: number
    supplierAdvances?: number
    salaryAdvances?: number
    cashback: number
    clientRefunds?: number
    fuelPetrol?: number
  }
}

type Summary = {
  moneyIn: number
  moneyOut: number
  netCashFlow: number
  breakdown?: Breakdown
}

type ToggleKey =
  | "clientPayments"
  | "posSales"
  | "incomeRecords"
  | "loans"
  | "loansGiven"
  | "expenses"
  | "salaries"
  | "purchaseLedger"
  | "pettyCash"
  | "importCharges"
  | "cashback"
  | "clientRefunds"
  | "fuelPetrol"

type ToggleDef = {
  key: ToggleKey
  label: string
  side: "in" | "out"
  defaultOn: boolean
}

const TOGGLES: ToggleDef[] = [
  { key: "clientPayments", label: "Client payments", side: "in", defaultOn: true },
  { key: "posSales", label: "POS sales", side: "in", defaultOn: true },
  { key: "incomeRecords", label: "Income records", side: "in", defaultOn: true },
  { key: "loans", label: "Loans taken / returned to us", side: "in", defaultOn: true },
  { key: "expenses", label: "Expenses", side: "out", defaultOn: true },
  { key: "loansGiven", label: "Loans given / repayments", side: "out", defaultOn: true },
  { key: "salaries", label: "Salaries (payroll)", side: "out", defaultOn: true },
  { key: "purchaseLedger", label: "Purchase ledger (purchases + rents)", side: "out", defaultOn: true },
  { key: "fuelPetrol", label: "Petrol / fuel", side: "out", defaultOn: true },
  { key: "pettyCash", label: "Petty cash", side: "out", defaultOn: true },
  { key: "importCharges", label: "Imported purchases (PSW + charges)", side: "out", defaultOn: true },
  { key: "cashback", label: "Cashback", side: "out", defaultOn: true },
  { key: "clientRefunds", label: "Client refunds", side: "out", defaultOn: true },
]

function fmt(n: number, decimals = 0) {
  return `PKR ${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

const PERIODS = [
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "year", label: "This year" },
]

function emptyBreakdown(): Breakdown {
  return {
    moneyIn: { clientPayments: 0, posSales: 0, incomeRecords: 0, loans: 0, loansReceived: 0, loanRecoveries: 0 },
    moneyOut: {
      expenses: 0,
      loansGiven: 0,
      loanRepayments: 0,
      salaries: 0,
      localPurchases: 0,
      purchaseLedger: 0,
      purchaseLedgerPurchases: 0,
      purchaseLedgerRents: 0,
      importedPurchases: 0,
      importShipments: 0,
      importPsw: 0,
      importCharges: 0,
      importChargesCombined: 0,
      pettyCash: 0,
      advances: 0,
      cashback: 0,
      clientRefunds: 0,
      fuelPetrol: 0,
    },
  }
}

function amountFor(b: Breakdown, key: ToggleKey): number {
  if (key === "loans") return b.moneyIn.loans
  if (key in b.moneyIn) return (b.moneyIn[key as keyof Breakdown["moneyIn"]] as number) || 0
  if (key === "purchaseLedger") return b.moneyOut.purchaseLedger
  if (key === "fuelPetrol") return b.moneyOut.fuelPetrol ?? 0
  if (key === "importCharges") return b.moneyOut.importChargesCombined ?? 0
  if (key === "loansGiven") return (b.moneyOut.loansGiven ?? 0) + (b.moneyOut.loanRepayments ?? 0)
  return (b.moneyOut[key as keyof Breakdown["moneyOut"]] as number) || 0
}

function buildMoneyOutDisplayRows(
  b: Breakdown["moneyOut"],
  details?: MoneyOutDetailsPayload | null,
) {
  const rows: { label: string; amount: number; details?: MoneyOutDetailLine[] }[] = []
  if (b.expenses > 0.004) {
    rows.push({
      label: "Expenses",
      amount: b.expenses,
      details: details?.expenses,
    })
  }
  const loansGiven = b.loansGiven ?? 0
  const loanRepayments = b.loanRepayments ?? 0
  const loanOutDetails = details?.loansGiven || []
  if (loansGiven > 0.004) {
    rows.push({
      label: "Loans given",
      amount: loansGiven,
      details: loanOutDetails.filter((l) => (l.sublabel || "").includes("Loan given")),
    })
  }
  if (loanRepayments > 0.004) {
    rows.push({
      label: "Loan repayments",
      amount: loanRepayments,
      details: loanOutDetails.filter((l) => (l.sublabel || "").includes("Returned by us")),
    })
  }
  if (b.salaries > 0.004) {
    rows.push({
      label: "Salaries",
      amount: b.salaries,
      details: details?.salaries,
    })
  }
  const salaryAdvances = b.salaryAdvances ?? 0
  if (salaryAdvances > 0.004) {
    rows.push({
      label: "Salary advances",
      amount: salaryAdvances,
      details: details?.salaryAdvances,
    })
  }

  const ledgerPurchases = b.purchaseLedgerPurchases ?? b.purchaseLedger
  const ledgerRents = b.purchaseLedgerRents ?? 0
  if (ledgerPurchases > 0.004) {
    rows.push({
      label: "Purchases (ledger)",
      amount: ledgerPurchases,
      details: details?.purchaseLedgerPurchases,
    })
  }
  if (ledgerRents > 0.004) {
    rows.push({
      label: "Rents (ledger)",
      amount: ledgerRents,
      details: details?.purchaseLedgerRents,
    })
  }
  const fuelPetrol = b.fuelPetrol ?? 0
  if (fuelPetrol > 0.004) {
    rows.push({
      label: "Petrol / fuel",
      amount: fuelPetrol,
      details: details?.fuelPetrol,
    })
  }
  if (b.pettyCash > 0.004) {
    rows.push({
      label: "Petty cash (approved)",
      amount: b.pettyCash,
      details: details?.pettyCash,
    })
  }

  const importPsw = b.importPsw ?? 0
  const importCharges = b.importCharges ?? 0
  if (importPsw > 0.004) {
    rows.push({
      label: "Import · PSW duties",
      amount: importPsw,
      details: details?.importPsw,
    })
  }
  if (importCharges > 0.004) {
    rows.push({
      label: "Import · charges",
      amount: importCharges,
      details: details?.importCharges,
    })
  }

  const clientRefunds = b.clientRefunds ?? 0
  if (clientRefunds > 0.004) {
    rows.push({
      label: "Client refunds",
      amount: clientRefunds,
      details: details?.clientRefunds,
    })
  }
  if (b.cashback > 0.004) {
    rows.push({
      label: "Cashback",
      amount: b.cashback,
      details: details?.cashback,
    })
  }
  return rows
}

function ToggleChip({
  on,
  label,
  amount,
  onClick,
}: {
  on: boolean
  label: string
  amount?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-colors cursor-pointer ${
        on
          ? "border-[hsl(var(--foreground))]/40 bg-[hsl(var(--muted))]/30"
          : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] opacity-60"
      }`}
    >
      <span className={`h-1 w-1 rounded-full ${on ? "bg-[hsl(var(--foreground))]" : "bg-[hsl(var(--muted-foreground))]"}`} />
      {label}
      {amount != null && amount > 0.004 && (
        <span className="tabular-nums opacity-70">{fmt(amount, 0)}</span>
      )}
    </button>
  )
}

function BreakdownTable({
  rows,
  total,
  onOpenDetails,
  tooltipSide = "left",
}: {
  rows: { label: string; value: string; details?: MoneyOutDetailLine[] }[]
  total: string
  onOpenDetails?: (row: { label: string; value: string; details: MoneyOutDetailLine[] }) => void
  tooltipSide?: "left" | "right"
}) {
  return (
    <div className="w-full rounded-md border overflow-visible">
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {rows.map((row, i) => {
            const hasDetails = (row.details?.length ?? 0) > 0
            const detailCount = row.details?.length ?? 0
            return (
              <tr key={row.label} className={`group/row ${i > 0 ? "border-t" : ""}`}>
                <td className="relative pl-2.5 pr-2 py-1.5 align-middle">
                  {hasDetails ? (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDetails?.({
                          label: row.label,
                          value: row.value,
                          details: row.details || [],
                        })
                      }
                      className="text-left text-[hsl(var(--muted-foreground))] cursor-pointer underline decoration-dotted decoration-[hsl(var(--muted-foreground))]/50 underline-offset-2 hover:text-[hsl(var(--foreground))]"
                      title="Hover for preview · click for full detail"
                    >
                      {row.label}
                    </button>
                  ) : (
                    <span className="text-[hsl(var(--muted-foreground))]">{row.label}</span>
                  )}
                  {hasDetails && (
                    <div
                      role="tooltip"
                      className={`pointer-events-none absolute top-full z-[60] mt-1.5 hidden group-hover/row:block w-[min(34rem,calc(100vw-1.5rem))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl p-3.5 ${
                        tooltipSide === "right" ? "right-0 left-auto" : "left-0"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-2.5 pb-2 border-b">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{row.label}</p>
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                            {detailCount} item{detailCount === 1 ? "" : "s"} · click row for full detail
                          </p>
                        </div>
                        <p className="text-sm font-bold tabular-nums shrink-0">{row.value}</p>
                      </div>
                      <ul className="space-y-0 max-h-[22rem] overflow-y-auto divide-y">
                        {row.details!.map((d) => (
                          <li key={d.id} className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
                            <span className="min-w-0">
                              <span className="block text-[13px] font-semibold text-[hsl(var(--foreground))] leading-snug">
                                {d.label}
                              </span>
                              {d.sublabel ? (
                                <span className="block text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 leading-snug">
                                  {d.sublabel}
                                </span>
                              ) : null}
                              {d.date ? (
                                <span className="block text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{d.date}</span>
                              ) : null}
                            </span>
                            <span className="text-[13px] tabular-nums font-semibold shrink-0 pt-0.5">{fmt(d.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </td>
                <td className="pl-2 pr-2.5 py-1.5 tabular-nums font-semibold text-right align-middle whitespace-nowrap">
                  {row.value}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-[hsl(var(--muted))]/20">
            <td className="pl-2.5 pr-2 py-1.5 font-semibold align-middle">Total</td>
            <td className="pl-2 pr-2.5 py-1.5 tabular-nums font-bold text-right align-middle whitespace-nowrap">
              {total}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function MoneyOutDetailsModal({
  title,
  totalLabel,
  details,
  onClose,
}: {
  title: string
  totalLabel: string
  details: MoneyOutDetailLine[]
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const total = details.reduce((s, d) => s + (Number(d.amount) || 0), 0)
  if (!mounted) return null

  function toggleRow(id: string) {
    setOpenIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-5">
      <button type="button" className="absolute inset-0 bg-black/40 cursor-pointer" aria-label="Close" onClick={onClose} />
      <div className="relative w-full sm:max-w-5xl lg:max-w-6xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-xl">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-3.5 border-b shrink-0">
          <div className="min-w-0">
            <p className="text-base font-semibold truncate">{title}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {details.length} shipment{details.length === 1 ? "" : "s"} · {totalLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))]/40 cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 sm:px-6 py-3 space-y-2.5">
          {details.map(d => {
            const open = !!openIds[d.id]
            const hasItems = (d.items?.length ?? 0) > 0
            return (
              <div key={d.id} className="rounded-lg border overflow-hidden">
                <div className="flex items-stretch gap-0 bg-[hsl(var(--muted))]/15">
                  <button
                    type="button"
                    onClick={() => hasItems && toggleRow(d.id)}
                    className={`flex-1 min-w-0 px-3.5 sm:px-4 py-3.5 flex items-start justify-between gap-4 text-left ${
                      hasItems ? "cursor-pointer hover:bg-[hsl(var(--muted))]/25" : "cursor-default"
                    }`}
                  >
                    <div className="min-w-0 flex items-start gap-2.5">
                      {hasItems ? (
                        <ChevronDown
                          className={`h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${
                            open ? "" : "-rotate-90"
                          }`}
                        />
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[hsl(var(--foreground))]">{d.label}</p>
                        {d.sublabel ? (
                          <p className="text-[13px] text-[hsl(var(--muted-foreground))] mt-0.5 leading-snug">{d.sublabel}</p>
                        ) : null}
                        {d.date ? (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5">{d.date}</p>
                        ) : null}
                        {hasItems && !open ? (
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                            {d.items!.length} line{d.items!.length === 1 ? "" : "s"} · click to expand
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-[15px] font-semibold tabular-nums shrink-0 pt-0.5">{fmt(d.amount)}</p>
                  </button>
                  {d.href ? (
                    <Link
                      href={d.href}
                      onClick={onClose}
                      className="shrink-0 border-l px-4 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/30 cursor-pointer"
                      title="Open detail"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Detail
                    </Link>
                  ) : null}
                </div>
                {open && hasItems && (
                  <ul className="divide-y border-t">
                    {d.items!.map((item, idx) => (
                      <li
                        key={`${d.id}-item-${idx}`}
                        className="px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-4 text-sm"
                      >
                        <span className="text-[hsl(var(--muted-foreground))] min-w-0 pl-6">{item.label}</span>
                        <span className="tabular-nums font-medium shrink-0">{fmt(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
        <div className="border-t px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0 bg-[hsl(var(--muted))]/10">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-base font-bold tabular-nums">{fmt(total)}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function FinanceHub({
  embedded: _embedded,
  dateFrom = "",
  dateTo = "",
  onDateFromChange,
  onDateToChange,
  period: periodProp,
  onPeriodChange,
}: {
  embedded?: boolean
  dateFrom?: string
  dateTo?: string
  onDateFromChange?: (value: string) => void
  onDateToChange?: (value: string) => void
  period?: string
  onPeriodChange?: (id: string) => void
}) {
  const [periodLocal, setPeriodLocal] = useState("month")
  const period = periodProp ?? periodLocal
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const [pdfBusy, setPdfBusy] = useState(false)
  const [salesExportBusy, setSalesExportBusy] = useState<"pdf" | "excel" | null>(null)
  const [showSalesReport, setShowSalesReport] = useState(false)
  const [salesIncludeCrm, setSalesIncludeCrm] = useState(true)
  const [salesIncludePos, setSalesIncludePos] = useState(true)
  const [opexExportBusy, setOpexExportBusy] = useState<"pdf" | "excel" | null>(null)
  const [showOpexReport, setShowOpexReport] = useState(false)
  const [opexIncludePetty, setOpexIncludePetty] = useState(true)
  const [opexIncludeLedger, setOpexIncludeLedger] = useState(true)
  const [opexIncludeSalaries, setOpexIncludeSalaries] = useState(true)
  const [ifrsBusy, setIfrsBusy] = useState(false)
  const [showIfrs, setShowIfrs] = useState(false)
  const [error, setError] = useState("")
  const [periodLabel, setPeriodLabel] = useState("This month")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [orderPayments, setOrderPayments] = useState<OrderPaymentsPayload | null>(null)
  const [includeOutstanding, setIncludeOutstanding] = useState(false)
  const [moneyOutDetails, setMoneyOutDetails] = useState<MoneyOutDetailsPayload | null>(null)
  const [moneyInDetails, setMoneyInDetails] = useState<{
    posSales?: MoneyOutDetailLine[]
    clientOrders?: MoneyOutDetailLine[]
    loans?: MoneyOutDetailLine[]
  } | null>(null)
  const [crmOrders, setCrmOrders] = useState<FinanceOrderRow[]>([])
  const [posSaleRows, setPosSaleRows] = useState<FinancePosRow[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [moneyInOpen, setMoneyInOpen] = useState(false)
  const [moneyOutOpen, setMoneyOutOpen] = useState(false)
  const [detailsModal, setDetailsModal] = useState<{
    label: string
    value: string
    details: MoneyOutDetailLine[]
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (dateFrom || dateTo) {
        if (dateFrom) params.set("from", dateFrom)
        if (dateTo) params.set("to", dateTo)
      } else {
        params.set("period", period)
      }
      const res = await fetch(`/api/finance/overview?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setPeriodLabel(data.periodLabel || "This month")
      setSummary(data.summary)
      setOrderPayments(data.orderPayments ?? null)
      setMoneyOutDetails(data.moneyOutDetails ?? null)
      setMoneyInDetails(data.moneyInDetails ?? null)
      // Sales cash uses orders created in range; money-in PDF uses data.orders (payment dates).
      setCrmOrders(
        Array.isArray(data.ordersCreated)
          ? data.ordersCreated
          : Array.isArray(data.orders)
            ? data.orders
            : [],
      )
      setPosSaleRows(Array.isArray(data.posSales) ? data.posSales : [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [period, dateFrom, dateTo])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const breakdown = summary?.breakdown ?? emptyBreakdown()

  const moneyOutDisplayRows = useMemo(
    () => buildMoneyOutDisplayRows(breakdown.moneyOut, moneyOutDetails),
    [breakdown.moneyOut, moneyOutDetails],
  )
  const moneyInDisplayRows = useMemo(() => {
    const rows: { label: string; amount: number; details?: MoneyOutDetailLine[] }[] = []
    const mi = breakdown.moneyIn
    if (mi.clientPayments > 0.004) {
      rows.push({
        label: "Client payments",
        amount: mi.clientPayments,
        details: moneyInDetails?.clientOrders,
      })
    }
    if (mi.posSales > 0.004) {
      rows.push({
        label: "POS sales",
        amount: mi.posSales,
        details: moneyInDetails?.posSales,
      })
    }
    if (mi.incomeRecords > 0.004) rows.push({ label: "Income records", amount: mi.incomeRecords })
    const received = mi.loansReceived ?? (mi.loans - (mi.loanRecoveries ?? 0))
    const recovered = mi.loanRecoveries ?? 0
    if (received > 0.004 || recovered > 0.004) {
      const loanLines = moneyInDetails?.loans || []
      if (received > 0.004) {
        rows.push({
          label: "Loans taken",
          amount: received,
          details: loanLines.filter((l) => (l.sublabel || "").includes("Loan received")),
        })
      }
      if (recovered > 0.004) {
        rows.push({
          label: "Returned to us",
          amount: recovered,
          details: loanLines.filter((l) => (l.sublabel || "").includes("Returned to us")),
        })
      }
    }
    return rows
  }, [breakdown.moneyIn, moneyInDetails])

  const moneyInAll = useMemo(
    () => TOGGLES.filter((t) => t.side === "in").reduce((s, t) => s + amountFor(breakdown, t.key), 0),
    [breakdown],
  )
  const moneyOutAll = useMemo(
    () => TOGGLES.filter((t) => t.side === "out").reduce((s, t) => s + amountFor(breakdown, t.key), 0),
    [breakdown],
  )
  const net = moneyInAll - moneyOutAll

  async function downloadPdf() {
    setPdfBusy(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom || dateTo) {
        if (dateFrom) params.set("from", dateFrom)
        if (dateTo) params.set("to", dateTo)
      } else {
        params.set("period", period)
      }
      const res = await fetch(`/api/finance/overview?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load report")
      await downloadFinanceOverviewPdf(data, { dateFrom, dateTo })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPdfBusy(false)
    }
  }

  async function downloadSalesReport(format: "pdf" | "excel") {
    if (!salesIncludeCrm && !salesIncludePos) {
      setError("Select CRM orders and/or POS sales for the sales report.")
      return
    }
    setSalesExportBusy(format)
    setError("")
    const opts = {
      includeCrm: salesIncludeCrm,
      includePos: salesIncludePos,
      periodLabel,
      dateFrom,
      dateTo,
      exportedBy: user?.name || "Finance",
    }
    try {
      if (format === "excel") {
        await downloadFinanceSalesReportExcel(crmOrders, posSaleRows, opts)
      } else {
        await downloadFinanceSalesReportPdf(crmOrders, posSaleRows, opts)
      }
      setShowSalesReport(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSalesExportBusy(null)
    }
  }

  async function downloadIfrsStatements() {
    setIfrsBusy(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (dateFrom || dateTo) {
        if (dateFrom) params.set("from", dateFrom)
        if (dateTo) params.set("to", dateTo)
      } else {
        params.set("period", period)
      }
      const res = await fetch(`/api/finance/overview?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load IFRS statements")
      let priorData: Record<string, unknown> | null = null
      let priorPeriodLabel = "Prior period"
      if (!dateFrom && !dateTo && period === "month") {
        const priorRes = await fetch("/api/finance/overview?period=last_month")
        if (priorRes.ok) {
          priorData = await priorRes.json()
          priorPeriodLabel = String((priorData as { periodLabel?: string }).periodLabel || "Last month")
        }
      }
      await downloadIfrsFinancialStatementsPdf(data, {
        dateFrom,
        dateTo,
        exportedBy: user?.name || "Finance",
        priorData,
        priorPeriodLabel,
      })
      setShowIfrs(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIfrsBusy(false)
    }
  }

  async function downloadOpexReport(format: "pdf" | "excel") {
    if (!opexIncludePetty && !opexIncludeLedger && !opexIncludeSalaries) {
      setError("Select at least one source for the operating expenses report.")
      return
    }
    setOpexExportBusy(format)
    setError("")
    const payload = {
      pettyCash: moneyOutDetails?.pettyCash || [],
      purchaseLedgerPurchases: moneyOutDetails?.purchaseLedgerPurchases || [],
      purchaseLedgerRents: moneyOutDetails?.purchaseLedgerRents || [],
      salaries: moneyOutDetails?.salaries || [],
    }
    const opts = {
      includePettyCash: opexIncludePetty,
      includePurchaseLedger: opexIncludeLedger,
      includeSalaries: opexIncludeSalaries,
      periodLabel,
      dateFrom,
      dateTo,
      exportedBy: user?.name || "Finance",
    }
    try {
      if (format === "excel") {
        await downloadFinanceOperatingExpensesExcel(payload, opts)
      } else {
        await downloadFinanceOperatingExpensesPdf(payload, opts)
      }
      setShowOpexReport(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOpexExportBusy(null)
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border p-4 text-center space-y-2">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{error}</p>
        <Button size="sm" variant="outline" onClick={load}>Retry</Button>
      </div>
    )
  }

  if (!summary || !orderPayments) return null

  const periodReceived = orderPayments.inPeriod.approvedInPeriod
  const outstanding = orderPayments.allTime.totalOutstanding
  const returnedOrderCount = orderPayments.allTime.returnedCount
  const activeOrderCount = orderPayments.allTime.orderCount
  const displayTotal = periodReceived + (includeOutstanding ? outstanding : 0)

  const filtersActiveLabel =
    dateFrom || dateTo
      ? `${dateFrom || "…"} → ${dateTo || "…"}`
      : PERIODS.find((p) => p.id === period)?.label || periodLabel

  return (
    <div className={`space-y-3 max-w-5xl ${loading ? "opacity-60" : ""}`}>
      {/* Filter icon — Apple-style, closed by default */}
      <div className="flex items-center justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`h-8 w-8 inline-flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
              filtersOpen
                ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))] border-transparent"
                : "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/40"
            }`}
            aria-label="Filters and reports"
            title={`Filters · ${filtersActiveLabel}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          {filtersOpen && (
            <div className="absolute right-0 top-full mt-2 z-40 w-[min(20.5rem,calc(100vw-1.5rem))] rounded-2xl border bg-[hsl(var(--card))] shadow-xl p-3 space-y-2.5">
              <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] px-0.5">{filtersActiveLabel}</p>
              <div className="flex rounded-xl border p-0.5 bg-[hsl(var(--muted))]/15">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => (onPeriodChange ? onPeriodChange(p.id) : setPeriodLocal(p.id))}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-[10px] transition-colors cursor-pointer ${
                      period === p.id && !dateFrom && !dateTo
                        ? "bg-[#1faca6] text-white shadow-sm"
                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange?.(e.target.value)}
                  className="h-8 rounded-xl border bg-[hsl(var(--background))] px-2 text-[11px] flex-1 min-w-0 cursor-pointer"
                />
                <span className="text-[9px] text-[hsl(var(--muted-foreground))] shrink-0">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange?.(e.target.value)}
                  className="h-8 rounded-xl border bg-[hsl(var(--background))] px-2 text-[11px] flex-1 min-w-0 cursor-pointer"
                />
              </div>
              <div className="grid grid-cols-5 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-1 gap-0.5 text-[9px] rounded-xl"
                  onClick={() => setShowSalesReport(true)}
                  disabled={loading}
                  title="Sales cash report"
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  Sales
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-1 gap-0.5 text-[9px] rounded-xl"
                  onClick={() => setShowOpexReport(true)}
                  disabled={loading}
                  title="Operating expenses"
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  Exp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-1 gap-0.5 text-[9px] rounded-xl"
                  onClick={() => setShowIfrs(true)}
                  disabled={loading}
                  title="IFRS statements"
                >
                  <Scale className="h-3 w-3" />
                  IFRS
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-1 gap-0.5 text-[9px] rounded-xl"
                  onClick={() => void downloadPdf()}
                  disabled={pdfBusy}
                >
                  {pdfBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-1 gap-0.5 text-[9px] rounded-xl"
                  onClick={load}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Sync
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSalesReport &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
            onClick={() => {
              if (!salesExportBusy) setShowSalesReport(false)
            }}
          >
            <div
              className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div>
                  <p className="text-sm font-semibold">Sales cash report</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                    Choose sources · {periodLabel} · PDF or Excel
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!!salesExportBusy}
                  onClick={() => setShowSalesReport(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-[hsl(var(--muted))]/20">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={salesIncludeCrm}
                    onChange={(e) => setSalesIncludeCrm(e.target.checked)}
                  />
                  <span>
                    <span className="text-sm font-medium block">CRM orders</span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {crmOrders.length} order{crmOrders.length === 1 ? "" : "s"} created in range · total, received &amp; credit
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-[hsl(var(--muted))]/20">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={salesIncludePos}
                    onChange={(e) => setSalesIncludePos(e.target.checked)}
                  />
                  <span>
                    <span className="text-sm font-medium block">POS sales</span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {posSaleRows.length} sale{posSaleRows.length === 1 ? "" : "s"} · total, received &amp; credit
                    </span>
                  </span>
                </label>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  CRM active totals exclude returned orders. Returns and cashback are separate sections. Excel: Combined · CRM active · CRM returns · POS. Same date range as Overview.
                </p>
              </div>
              <div className="flex flex-col gap-2 px-4 py-3 border-t bg-[hsl(var(--muted))]/10">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    disabled={!!salesExportBusy || (!salesIncludeCrm && !salesIncludePos)}
                    onClick={() => void downloadSalesReport("excel")}
                  >
                    {salesExportBusy === "excel" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    {salesExportBusy === "excel" ? "Building…" : "Download Excel"}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-1.5 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
                    disabled={!!salesExportBusy || (!salesIncludeCrm && !salesIncludePos)}
                    onClick={() => void downloadSalesReport("pdf")}
                  >
                    {salesExportBusy === "pdf" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {salesExportBusy === "pdf" ? "Building…" : "Download PDF"}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-8 text-xs"
                  disabled={!!salesExportBusy}
                  onClick={() => setShowSalesReport(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showOpexReport &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
            onClick={() => {
              if (!opexExportBusy) setShowOpexReport(false)
            }}
          >
            <div
              className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div>
                  <p className="text-sm font-semibold">Operating expenses</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                    Petty cash · Purchase ledger · Salaries · {periodLabel}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!!opexExportBusy}
                  onClick={() => setShowOpexReport(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-[hsl(var(--muted))]/20">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={opexIncludePetty}
                    onChange={(e) => setOpexIncludePetty(e.target.checked)}
                  />
                  <span>
                    <span className="text-sm font-medium block">Petty cash (approved)</span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {(moneyOutDetails?.pettyCash || []).length} receipt
                      {(moneyOutDetails?.pettyCash || []).length === 1 ? "" : "s"} ·{" "}
                      {fmt(
                        (moneyOutDetails?.pettyCash || []).reduce(
                          (s, r) => s + (Number(r.amount) || 0),
                          0,
                        ),
                      )}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-[hsl(var(--muted))]/20">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={opexIncludeLedger}
                    onChange={(e) => setOpexIncludeLedger(e.target.checked)}
                  />
                  <span>
                    <span className="text-sm font-medium block">Purchase ledger</span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      Purchases + rents paid in period ·{" "}
                      {fmt(
                        [...(moneyOutDetails?.purchaseLedgerPurchases || []), ...(moneyOutDetails?.purchaseLedgerRents || [])].reduce(
                          (s, r) => s + (Number(r.amount) || 0),
                          0,
                        ),
                      )}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-[hsl(var(--muted))]/20">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={opexIncludeSalaries}
                    onChange={(e) => setOpexIncludeSalaries(e.target.checked)}
                  />
                  <span>
                    <span className="text-sm font-medium block">Salaries (payroll)</span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {(moneyOutDetails?.salaries || []).length} slip
                      {(moneyOutDetails?.salaries || []).length === 1 ? "" : "s"} ·{" "}
                      {fmt(
                        (moneyOutDetails?.salaries || []).reduce(
                          (s, r) => s + (Number(r.amount) || 0),
                          0,
                        ),
                      )}
                    </span>
                  </span>
                </label>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  Salary advances are excluded — they settle into payroll. Same date range as Overview.
                </p>
              </div>
              <div className="flex flex-col gap-2 px-4 py-3 border-t bg-[hsl(var(--muted))]/10">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    disabled={
                      !!opexExportBusy ||
                      (!opexIncludePetty && !opexIncludeLedger && !opexIncludeSalaries)
                    }
                    onClick={() => void downloadOpexReport("excel")}
                  >
                    {opexExportBusy === "excel" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    {opexExportBusy === "excel" ? "Building…" : "Download Excel"}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-1.5 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
                    disabled={
                      !!opexExportBusy ||
                      (!opexIncludePetty && !opexIncludeLedger && !opexIncludeSalaries)
                    }
                    onClick={() => void downloadOpexReport("pdf")}
                  >
                    {opexExportBusy === "pdf" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {opexExportBusy === "pdf" ? "Building…" : "Download PDF"}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-8 text-xs"
                  disabled={!!opexExportBusy}
                  onClick={() => setShowOpexReport(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showIfrs &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
            onClick={() => {
              if (!ifrsBusy) setShowIfrs(false)
            }}
          >
            <div
              className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div>
                  <p className="text-sm font-semibold">IFRS financial statements</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                    IAS 1 · IAS 7 · IFRS 15 · {periodLabel}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={ifrsBusy}
                  onClick={() => setShowIfrs(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 space-y-2 text-[12px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                <p>
                  The PDF is a complete set under <strong className="text-[hsl(var(--foreground))]">IAS 1.10</strong> (IFRS Accounting Standards):
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Statement of financial position as at period end</li>
                  <li>Statement of profit or loss and other comprehensive income</li>
                  <li>Statement of changes in equity</li>
                  <li>Statement of cash flows (IAS 7 direct method)</li>
                  <li>Notes — material accounting policies and explanations</li>
                </ul>
                <p className="text-[10px]">
                  Same date range as Overview. This month also fills a prior-period column (IAS 1.38). These are IFRS-presented management accounts from Voltrix, not a statutory audit pack.
                </p>
              </div>
              <div className="flex flex-col gap-2 px-4 py-3 border-t bg-[hsl(var(--muted))]/10">
                <Button
                  type="button"
                  className="w-full gap-1.5 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
                  disabled={ifrsBusy}
                  onClick={() => void downloadIfrsStatements()}
                >
                  {ifrsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {ifrsBusy ? "Building…" : "Download IFRS PDF"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-8 text-xs"
                  disabled={ifrsBusy}
                  onClick={() => setShowIfrs(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Hero: In / Out / Net — click In/Out to open detail */}
      <section className="grid grid-cols-3 gap-px rounded-xl border overflow-hidden bg-[hsl(var(--border))] shadow-sm">
        <button
          type="button"
          onClick={() => {
            setMoneyInOpen(true)
            setMoneyOutOpen(false)
          }}
          className={`bg-[hsl(var(--card))] px-3 py-3 sm:px-4 text-left transition-colors cursor-pointer hover:bg-emerald-500/[0.04] ${
            moneyInOpen ? "ring-1 ring-inset ring-emerald-500/30" : ""
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-medium">Money in</p>
          <p className="text-base sm:text-lg font-bold tabular-nums leading-tight mt-0.5 text-emerald-800 dark:text-emerald-300">
            {fmt(moneyInAll)}
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{periodLabel}</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setMoneyOutOpen(true)
            setMoneyInOpen(false)
          }}
          className={`bg-[hsl(var(--card))] px-3 py-3 sm:px-4 text-left transition-colors cursor-pointer hover:bg-rose-500/[0.04] ${
            moneyOutOpen ? "ring-1 ring-inset ring-rose-500/30" : ""
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide text-rose-700 dark:text-rose-400 font-medium">Money out</p>
          <p className="text-base sm:text-lg font-bold tabular-nums leading-tight mt-0.5 text-rose-800 dark:text-rose-300">
            {fmt(moneyOutAll)}
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">Paid costs</p>
        </button>
        <div className="bg-[hsl(var(--card))] px-3 py-3 sm:px-4">
          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-medium">Net</p>
          <p
            className={`text-base sm:text-lg font-bold tabular-nums leading-tight mt-0.5 ${
              net >= 0
                ? "text-emerald-800 dark:text-emerald-300"
                : "text-rose-800 dark:text-rose-300"
            }`}
          >
            {fmt(net)}
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
            {net >= 0 ? "Surplus" : "Deficit"}
          </p>
        </div>
      </section>

      {/* Money in + Money out side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <section className="rounded-lg border bg-[hsl(var(--card))] overflow-visible min-w-0">
          <button
            type="button"
            onClick={() => setMoneyInOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-emerald-500/[0.04] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400 transition-transform ${moneyInOpen ? "" : "-rotate-90"}`}
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-emerald-800 dark:text-emerald-300">Money in</span>
                <span className="block text-[10px] text-[hsl(var(--muted-foreground))] truncate">{periodLabel}</span>
              </span>
            </span>
            <span className="text-xs font-bold tabular-nums text-emerald-800 dark:text-emerald-300 shrink-0">
              {fmt(moneyInAll)}
            </span>
          </button>
          {moneyInOpen && (
            <div className="px-3 pb-3 pt-1 border-t space-y-2.5">
              <div className="rounded-md border overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b bg-[hsl(var(--muted))]/10">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold">Client receipts</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                      CRM · {activeOrderCount} active
                      {returnedOrderCount > 0 ? ` · +${returnedOrderCount} returned` : ""}
                    </p>
                  </div>
                  <Link
                    href="/crm?tab=orders"
                    className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
                  >
                    CRM <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="p-2 space-y-2">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{periodLabel} received</p>
                      <p className="text-base font-bold tabular-nums leading-none mt-0.5">{fmt(displayTotal, 0)}</p>
                    </div>
                    <ToggleChip
                      on={includeOutstanding}
                      label="+ Outstanding"
                      amount={outstanding}
                      onClick={() => setIncludeOutstanding((v) => !v)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <div className="rounded border px-1.5 py-1">
                      <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Period</p>
                      <p className="text-[10px] font-semibold tabular-nums mt-0.5">{fmt(periodReceived, 0)}</p>
                    </div>
                    <div className="rounded border px-1.5 py-1">
                      <p className="text-[9px] text-[hsl(var(--muted-foreground))]">All-time</p>
                      <p className="text-[10px] font-semibold tabular-nums mt-0.5">{fmt(orderPayments.allTime.totalReceived, 0)}</p>
                    </div>
                    <div className="rounded border px-1.5 py-1">
                      <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Due</p>
                      <p className="text-[10px] font-semibold tabular-nums mt-0.5 text-amber-700 dark:text-amber-400">
                        {fmt(outstanding, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {moneyInDisplayRows.length > 0 && (
                <BreakdownTable
                  rows={moneyInDisplayRows.map((r) => ({
                    label: r.label,
                    value: fmt(r.amount),
                    details: r.details,
                  }))}
                  total={fmt(moneyInAll)}
                  onOpenDetails={setDetailsModal}
                />
              )}

            </div>
          )}
        </section>

        <section className="rounded-lg border bg-[hsl(var(--card))] overflow-visible min-w-0">
          <button
            type="button"
            onClick={() => setMoneyOutOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-rose-500/[0.04] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-rose-700 dark:text-rose-400 transition-transform ${moneyOutOpen ? "" : "-rotate-90"}`}
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-rose-800 dark:text-rose-300">Money out</span>
                <span className="block text-[10px] text-[hsl(var(--muted-foreground))] truncate">Paid · {periodLabel}</span>
              </span>
            </span>
            <span className="text-xs font-bold tabular-nums text-rose-700 dark:text-rose-400 shrink-0">
              {fmt(moneyOutAll)}
            </span>
          </button>
          {moneyOutOpen && (
            <div className="px-3 pb-3 pt-1 border-t overflow-visible">
              <BreakdownTable
                rows={moneyOutDisplayRows.map((r) => ({
                  label: r.label,
                  value: fmt(r.amount),
                  details: r.details,
                }))}
                total={fmt(moneyOutAll)}
                onOpenDetails={setDetailsModal}
                tooltipSide="right"
              />
            </div>
          )}
        </section>
      </div>

      {detailsModal && (
        <MoneyOutDetailsModal
          title={detailsModal.label}
          totalLabel={detailsModal.value}
          details={detailsModal.details}
          onClose={() => setDetailsModal(null)}
        />
      )}
    </div>
  )
}
