"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
        on
          ? "bg-black/[0.06] text-[#1d1d1f] dark:bg-white/12 dark:text-[hsl(var(--foreground))]"
          : "bg-black/[0.03] text-[#aeaeb2] dark:bg-white/5"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-[#1a9f9a]" : "bg-[#aeaeb2]"}`} />
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
}: {
  rows: { label: string; value: string; details?: MoneyOutDetailLine[] }[]
  total: string
  onOpenDetails?: (row: { label: string; value: string; details: MoneyOutDetailLine[] }) => void
  tooltipSide?: "left" | "right"
}) {
  const [hover, setHover] = useState<{
    label: string
    value: string
    details: MoneyOutDetailLine[]
    x: number
    y: number
  } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearHide() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  function scheduleHide() {
    clearHide()
    hideTimer.current = setTimeout(() => setHover(null), 120)
  }

  function showPreview(
    e: React.MouseEvent,
    row: { label: string; value: string; details: MoneyOutDetailLine[] },
  ) {
    clearHide()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const width = Math.min(420, window.innerWidth - 24)
    const pad = 12
    let x = rect.left
    if (x + width > window.innerWidth - pad) x = window.innerWidth - width - pad
    if (x < pad) x = pad
    let y = rect.bottom + 8
    const maxH = Math.min(360, window.innerHeight - 24)
    if (y + Math.min(280, maxH) > window.innerHeight - pad) {
      y = Math.max(pad, rect.top - 8 - Math.min(280, maxH))
    }
    setHover({ ...row, x, y })
  }

  useEffect(() => () => clearHide(), [])

  return (
    <div className="w-full rounded-[14px] bg-[#f5f5f7] dark:bg-black/20 overflow-hidden">
      <table className="w-full border-collapse text-[12px]">
        <tbody>
          {rows.map((row, i) => {
            const hasDetails = (row.details?.length ?? 0) > 0
            return (
              <tr key={row.label} className={i > 0 ? "border-t border-black/[0.05] dark:border-white/8" : ""}>
                <td className="pl-3.5 pr-2 py-2.5 align-middle">
                  {hasDetails ? (
                    <button
                      type="button"
                      onMouseEnter={(e) =>
                        showPreview(e, {
                          label: row.label,
                          value: row.value,
                          details: row.details || [],
                        })
                      }
                      onMouseLeave={scheduleHide}
                      onClick={() =>
                        onOpenDetails?.({
                          label: row.label,
                          value: row.value,
                          details: row.details || [],
                        })
                      }
                      className="text-left text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-[hsl(var(--foreground))] transition-colors"
                      title="Hover for preview · click for full detail"
                    >
                      {row.label}
                    </button>
                  ) : (
                    <span className="text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))]">{row.label}</span>
                  )}
                </td>
                <td className="pl-2 pr-3.5 py-2.5 tabular-nums font-semibold text-right align-middle whitespace-nowrap text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                  {row.value}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-black/[0.08] dark:border-white/10">
            <td className="pl-3.5 pr-2 py-2.5 font-semibold align-middle text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Total</td>
            <td className="pl-2 pr-3.5 py-2.5 tabular-nums font-bold text-right align-middle whitespace-nowrap text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              {total}
            </td>
          </tr>
        </tfoot>
      </table>

      {hover &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[90] pointer-events-none w-[min(420px,calc(100vw-24px))] max-h-[min(360px,calc(100vh-24px))] overflow-hidden rounded-[14px] border border-black/[0.08] bg-white/95 dark:bg-[hsl(var(--card))]/95 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.16)]"
            style={{ left: hover.x, top: hover.y }}
            onMouseEnter={clearHide}
            onMouseLeave={scheduleHide}
          >
            <div className="flex items-baseline justify-between gap-3 px-3.5 pt-3 pb-2 border-b border-black/[0.06]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">{hover.label}</p>
                <p className="text-[11px] text-[#86868b] mt-0.5">
                  {hover.details.length} item{hover.details.length === 1 ? "" : "s"} · click row for full detail
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums shrink-0">{hover.value}</p>
            </div>
            <ul className="max-h-[min(280px,calc(100vh-96px))] overflow-y-auto divide-y divide-black/[0.05] px-3.5">
              {hover.details.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))] leading-snug">
                      {d.label}
                    </span>
                    {d.sublabel ? (
                      <span className="block text-[11px] text-[#86868b] mt-0.5 leading-snug">{d.sublabel}</span>
                    ) : null}
                    {d.date ? (
                      <span className="block text-[10px] text-[#aeaeb2] mt-1">{d.date}</span>
                    ) : null}
                  </span>
                  <span className="text-[13px] tabular-nums font-semibold shrink-0 pt-0.5">{fmt(d.amount)}</span>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
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
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px] cursor-pointer"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[84vh] flex flex-col overflow-hidden rounded-t-[20px] sm:rounded-[20px] border border-black/[0.08] bg-white/95 dark:bg-[hsl(var(--card))]/95 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 shrink-0">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
              {title}
            </p>
            <p className="text-[12px] text-[#86868b] mt-1">
              {details.length} item{details.length === 1 ? "" : "s"} · {totalLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10 text-[#86868b] hover:bg-black/[0.08] cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-3 pb-3 space-y-1.5">
          {details.map((d) => {
            const open = !!openIds[d.id]
            const hasItems = (d.items?.length ?? 0) > 0
            return (
              <div
                key={d.id}
                className="rounded-[14px] bg-[#f5f5f7] dark:bg-black/20 overflow-hidden"
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => hasItems && toggleRow(d.id)}
                    className={`flex-1 min-w-0 px-3.5 py-3 flex items-start justify-between gap-3 text-left ${
                      hasItems ? "cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]" : "cursor-default"
                    }`}
                  >
                    <div className="min-w-0 flex items-start gap-2.5">
                      {hasItems ? (
                        <ChevronDown
                          className={`h-3.5 w-3.5 mt-1 shrink-0 text-[#aeaeb2] transition-transform ${
                            open ? "" : "-rotate-90"
                          }`}
                        />
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                          {d.label}
                        </p>
                        {d.sublabel ? (
                          <p className="text-[11px] text-[#86868b] mt-0.5 leading-snug truncate">{d.sublabel}</p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {d.date ? (
                            <span className="inline-flex rounded-full bg-white dark:bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#86868b]">
                              {d.date}
                            </span>
                          ) : null}
                          {hasItems ? (
                            <span className="inline-flex rounded-full bg-white dark:bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#86868b]">
                              {d.items!.length} line{d.items!.length === 1 ? "" : "s"}
                              {!open ? " · expand" : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <p className="text-[13px] font-semibold tabular-nums shrink-0 pt-0.5 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                      {fmt(d.amount)}
                    </p>
                  </button>
                  {d.href ? (
                    <Link
                      href={d.href}
                      onClick={onClose}
                      className="shrink-0 px-3.5 flex items-center justify-center text-[#0071e3] hover:bg-black/[0.03] cursor-pointer"
                      title="Open detail"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
                {open && hasItems && (
                  <ul className="mx-2.5 mb-2.5 rounded-[12px] bg-white dark:bg-white/5 overflow-hidden divide-y divide-black/[0.04]">
                    {d.items!.map((item, idx) => (
                      <li
                        key={`${d.id}-item-${idx}`}
                        className="px-3 py-2.5 flex items-center justify-between gap-3 text-[12px]"
                      >
                        <span className="text-[#6e6e73] min-w-0 truncate">{item.label}</span>
                        <span className="tabular-nums font-semibold shrink-0 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                          {fmt(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        <div className="border-t border-black/[0.06] px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Total</span>
          <span className="text-[15px] font-bold tabular-nums tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            {fmt(total)}
          </span>
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
  const filtersRef = useRef<HTMLDivElement>(null)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number; notch: "top" | "left" } | null>(null)
  const [detailsModal, setDetailsModal] = useState<{
    label: string
    value: string
    details: MoneyOutDetailLine[]
  } | null>(null)

  function placeFilterPanel() {
    const btn = filterBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const panelW = Math.min(328, window.innerWidth - 24)
    const panelH = 300
    const pad = 12
    const spaceRight = window.innerWidth - rect.right - pad
    // Prefer floating to the right in empty space; otherwise below, right-aligned to the button.
    if (spaceRight >= panelW + 8) {
      setFilterPos({
        top: Math.min(rect.top, window.innerHeight - panelH - pad),
        left: rect.right + 10,
        notch: "left",
      })
      return
    }
    let left = rect.right - panelW
    if (left < pad) left = pad
    let top = rect.bottom + 12
    if (top + panelH > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - panelH - 12)
    }
    setFilterPos({ top, left, notch: "top" })
  }

  useEffect(() => {
    if (!filtersOpen) {
      setFilterPos(null)
      return
    }
    placeFilterPanel()
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (filtersRef.current?.contains(t) || filterBtnRef.current?.contains(t)) return
      setFiltersOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false)
    }
    function onReposition() {
      placeFilterPanel()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("resize", onReposition)
    window.addEventListener("scroll", onReposition, true)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", onReposition)
      window.removeEventListener("scroll", onReposition, true)
    }
  }, [filtersOpen])

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

  const filterButton = (
    <button
      ref={filterBtnRef}
      type="button"
      onClick={() => setFiltersOpen((v) => !v)}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
        filtersOpen
          ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
          : "text-[#86868b] hover:bg-black/[0.05] dark:hover:bg-white/10 hover:text-[#1d1d1f]"
      }`}
      aria-label="Filters and reports"
      aria-expanded={filtersOpen}
      title={`Filters · ${filtersActiveLabel}`}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  )

  const filterPopover =
    filtersOpen &&
    filterPos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={filtersRef}
        className="fixed z-[95] w-[min(20.5rem,calc(100vw-1.5rem))] rounded-[16px] border border-black/[0.08] bg-white/95 dark:bg-[hsl(var(--card))]/95 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.18)] p-3 space-y-2.5"
        style={{ top: filterPos.top, left: filterPos.left }}
      >
        <span
          aria-hidden
          className={
            filterPos.notch === "left"
              ? "pointer-events-none absolute top-4 -left-1.5 h-3 w-3 rotate-45 rounded-[2px] border-b border-l border-black/[0.08] bg-white dark:bg-[hsl(var(--card))]"
              : "pointer-events-none absolute -top-1.5 right-4 h-3 w-3 rotate-45 rounded-[2px] border-l border-t border-black/[0.08] bg-white dark:bg-[hsl(var(--card))]"
          }
        />
        <div className="flex items-center justify-between gap-2 px-0.5 relative">
          <p className="text-[11px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            Filters
          </p>
          <p className="text-[10px] text-[#86868b] truncate">{filtersActiveLabel}</p>
        </div>
        <div className="flex rounded-[10px] bg-black/[0.06] dark:bg-white/10 p-[3px]">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => (onPeriodChange ? onPeriodChange(p.id) : setPeriodLocal(p.id))}
              className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-[8px] transition-all duration-200 cursor-pointer ${
                period === p.id && !dateFrom && !dateTo
                  ? "bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[#6e6e73] hover:text-[#1d1d1f] dark:hover:text-[hsl(var(--foreground))]"
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
            className="h-8 rounded-xl border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2 text-[11px] flex-1 min-w-0 cursor-pointer"
          />
          <span className="text-[9px] text-[#86868b] shrink-0">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange?.(e.target.value)}
            className="h-8 rounded-xl border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2 text-[11px] flex-1 min-w-0 cursor-pointer"
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
      </div>,
      document.body,
    )

  return (
    <div className={`space-y-4 ${loading ? "opacity-60" : ""}`}>
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

      {/* Hero: In / Out / Net + filter — one card under tabs */}
      <section className="rounded-[18px] border border-black/[0.04] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-visible relative z-20">
        <div className="flex items-start">
          <div className="grid flex-1 grid-cols-3 divide-x divide-black/[0.06] dark:divide-[hsl(var(--border))] min-w-0">
            <button
              type="button"
              onClick={() => {
                setMoneyInOpen(true)
                setMoneyOutOpen(false)
              }}
              className={`px-4 py-4 sm:px-5 text-left transition-colors cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] rounded-l-[18px] ${
                moneyInOpen ? "bg-black/[0.02] dark:bg-white/[0.04]" : ""
              }`}
            >
              <p className="text-[11px] font-medium text-[#86868b]">Money in</p>
              <p className="text-[20px] sm:text-[22px] font-bold tracking-tight tabular-nums leading-none mt-2 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                {fmt(moneyInAll)}
              </p>
              <p className="text-[11px] text-[#aeaeb2] mt-2 truncate">{periodLabel}</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setMoneyOutOpen(true)
                setMoneyInOpen(false)
              }}
              className={`px-4 py-4 sm:px-5 text-left transition-colors cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${
                moneyOutOpen ? "bg-black/[0.02] dark:bg-white/[0.04]" : ""
              }`}
            >
              <p className="text-[11px] font-medium text-[#86868b]">Money out</p>
              <p className="text-[20px] sm:text-[22px] font-bold tracking-tight tabular-nums leading-none mt-2 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                {fmt(moneyOutAll)}
              </p>
              <p className="text-[11px] text-[#aeaeb2] mt-2 truncate">Paid costs</p>
            </button>
            <div className="px-4 py-4 sm:px-5 pr-2 sm:pr-3">
              <p className="text-[11px] font-medium text-[#86868b]">Net</p>
              <p className="text-[20px] sm:text-[22px] font-bold tracking-tight tabular-nums leading-none mt-2 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                {fmt(net)}
              </p>
              <p className="text-[11px] text-[#aeaeb2] mt-2 truncate">
                {net >= 0 ? "Surplus" : "Deficit"}
              </p>
            </div>
          </div>
          <div className="shrink-0 self-start pt-3 pr-3 pl-1">
            {filterButton}
          </div>
        </div>
        {filterPopover}
      </section>

      {/* Money in + Money out side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <section className="rounded-[18px] border border-black/[0.04] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-hidden min-w-0">
          <button
            type="button"
            onClick={() => setMoneyInOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-[#86868b] transition-transform ${moneyInOpen ? "" : "-rotate-90"}`}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Money in</span>
                <span className="block text-[11px] text-[#86868b] truncate">{periodLabel}</span>
              </span>
            </span>
            <span className="text-[13px] font-bold tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shrink-0">
              {fmt(moneyInAll)}
            </span>
          </button>
          {moneyInOpen && (
            <div className="px-4 pb-4 pt-1 border-t border-black/[0.05] dark:border-white/8 space-y-3">
              <div className="rounded-[14px] bg-[#f5f5f7] dark:bg-black/20 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Client receipts</p>
                    <p className="text-[11px] text-[#86868b] truncate">
                      CRM · {activeOrderCount} active
                      {returnedOrderCount > 0 ? ` · +${returnedOrderCount} returned` : ""}
                    </p>
                  </div>
                  <Link
                    href="/crm?tab=orders"
                    className="text-[11px] font-medium text-[#0071e3] hover:opacity-80 inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
                  >
                    CRM <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="px-3.5 pb-3 space-y-3">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#86868b]">{periodLabel} received</p>
                      <p className="text-[22px] font-bold tracking-tight tabular-nums leading-none mt-1 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                        {fmt(displayTotal, 0)}
                      </p>
                    </div>
                    <ToggleChip
                      on={includeOutstanding}
                      label="+ Outstanding"
                      amount={outstanding}
                      onClick={() => setIncludeOutstanding((v) => !v)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="rounded-[10px] bg-white dark:bg-white/5 px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">Period</p>
                      <p className="text-[11px] font-semibold tabular-nums mt-1 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                        {fmt(periodReceived, 0)}
                      </p>
                    </div>
                    <div className="rounded-[10px] bg-white dark:bg-white/5 px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">All-time</p>
                      <p className="text-[11px] font-semibold tabular-nums mt-1 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                        {fmt(orderPayments.allTime.totalReceived, 0)}
                      </p>
                    </div>
                    <div className="rounded-[10px] bg-white dark:bg-white/5 px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">Due</p>
                      <p className="text-[11px] font-semibold tabular-nums mt-1 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
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

        <section className="rounded-[18px] border border-black/[0.04] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-hidden min-w-0">
          <button
            type="button"
            onClick={() => setMoneyOutOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-[#86868b] transition-transform ${moneyOutOpen ? "" : "-rotate-90"}`}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Money out</span>
                <span className="block text-[11px] text-[#86868b] truncate">Paid · {periodLabel}</span>
              </span>
            </span>
            <span className="text-[13px] font-bold tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shrink-0">
              {fmt(moneyOutAll)}
            </span>
          </button>
          {moneyOutOpen && (
            <div className="px-4 pb-4 pt-1 border-t border-black/[0.05] dark:border-white/8">
              <BreakdownTable
                rows={moneyOutDisplayRows.map((r) => ({
                  label: r.label,
                  value: fmt(r.amount),
                  details: r.details,
                }))}
                total={fmt(moneyOutAll)}
                onOpenDetails={setDetailsModal}
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
