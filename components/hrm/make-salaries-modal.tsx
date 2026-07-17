"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Save, CheckCircle2, Copy, Download } from "lucide-react"
import {
  computeBatchSalaryFigures,
  monthDateBounds,
  periodStartForJoinDate,
} from "@/lib/hrm-salary-calc"
import {
  downloadPayrollSummaryPdf,
  downloadSalarySlipPdf,
  monthLabel,
  currentPayrollMonth,
  type PayrollSummaryRow,
} from "@/lib/generate-salary-slip-pdf"
import { recoverSalaryAdvances } from "@/lib/hrm-salary-advances"
import { downloadMakeSalariesExcel } from "@/lib/hrm-excel-export"

export type MakeSalariesStaff = {
  id: string
  name: string
  role: string
  department: string
  salary: number
  tax_amount?: number
  tax_enabled?: boolean
  currency: string
  join_date: string
  status: "active" | "inactive"
  bank_name?: string
  bank_account_number?: string
  bank_account_title?: string
}

type SalaryRow = {
  staffId: string
  staffName: string
  role: string
  department: string
  currency: string
  monthlySalary: number
  taxAmount: number
  taxEnabled: boolean
  included: boolean
  periodFrom: string
  periodTo: string
  bankName: string
  bankAccountNumber: string
  bankAccountTitle: string
}

type ExistingSlip = {
  id?: string
  staffLocalId?: string | null
  staffName?: string
  month?: string
  status?: string
  periodStart?: string | null
  periodEnd?: string | null
  baseSalary?: number
  netSalary?: number
  adjustments?: unknown
}

function buildRows(
  staff: MakeSalariesStaff[],
  month: string,
  existing: ExistingSlip[],
): SalaryRow[] {
  const bounds = monthDateBounds(month)
  return staff
    .filter((s) => s.status === "active" && s.salary > 0)
    .map((s) => {
      const saved =
        existing.find((slip) => slip.staffLocalId === s.id) ||
        existing.find(
          (slip) =>
            String(slip.staffName || "").trim().toLowerCase() === s.name.trim().toLowerCase(),
        )
      return {
        staffId: s.id,
        staffName: s.name,
        role: s.role,
        department: s.department,
        currency: s.currency || "PKR",
        monthlySalary: s.salary,
        taxAmount: Number(s.tax_amount) || 0,
        included: true,
        periodFrom: saved?.periodStart || periodStartForJoinDate(month, s.join_date),
        periodTo: saved?.periodEnd || bounds.to,
        bankName: s.bank_name || "",
        bankAccountNumber: s.bank_account_number || "",
        bankAccountTitle: s.bank_account_title || "",
      }
    })
}

export function MakeSalariesModal({
  staff,
  advanceByStaff,
  existingSlips,
  initialMonth,
  recoveredBy,
  onClose,
  onSaved,
}: {
  staff: MakeSalariesStaff[]
  advanceByStaff: Record<string, number>
  existingSlips: ExistingSlip[]
  initialMonth?: string
  recoveredBy: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const [month, setMonth] = useState(() => initialMonth || currentPayrollMonth())
  const [rows, setRows] = useState<SalaryRow[]>(() => buildRows(staff, month, existingSlips))
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  useEffect(() => {
    if (initialMonth) setMonth(initialMonth)
  }, [initialMonth])

  useEffect(() => {
    const monthSlips = existingSlips.filter((s) => s.month === month)
    setRows(buildRows(staff, month, monthSlips))
  }, [month, staff, existingSlips])

  const finalizedNames = useMemo(() => {
    return new Set(
      existingSlips
        .filter((s) => s.month === month && String(s.status || "finalized") === "finalized")
        .map((s) => String(s.staffName || "").trim().toLowerCase()),
    )
  }, [existingSlips, month])

  const computed = useMemo(() => {
    return rows.map((row) => {
      const advance = advanceByStaff[row.staffId] || 0
      const figures =
        row.periodFrom && row.periodTo && row.periodTo >= row.periodFrom
          ? computeBatchSalaryFigures(
              row.monthlySalary,
              row.periodFrom,
              row.periodTo,
              advance,
              row.taxAmount,
              row.taxEnabled,
            )
          : {
              baseSalary: 0,
              adjustments: [],
              netSalary: 0,
              proRateDescription: "",
              payPeriodText: "",
            }
      return { row, advance, figures }
    })
  }, [rows, advanceByStaff])

  const includedRows = computed.filter((c) => c.row.included)
  const selectableRows = computed.filter(
    (c) => !finalizedNames.has(c.row.staffName.trim().toLowerCase()),
  )
  const allSelectableIncluded =
    selectableRows.length > 0 && selectableRows.every((c) => c.row.included)
  const totalNet = includedRows.reduce((sum, c) => sum + c.figures.netSalary, 0)
  const currency = includedRows[0]?.row.currency || "PKR"
  const draftCount = existingSlips.filter((s) => s.month === month && s.status === "draft").length

  function updateRow(staffId: string, patch: Partial<SalaryRow>) {
    setRows((prev) => prev.map((r) => (r.staffId === staffId ? { ...r, ...patch } : r)))
  }

  function applyMonthBounds() {
    const bounds = monthDateBounds(month)
    setRows((prev) =>
      prev.map((row) => {
        const member = staff.find((s) => s.id === row.staffId)
        return {
          ...row,
          periodFrom: member ? periodStartForJoinDate(month, member.join_date) : bounds.from,
          periodTo: bounds.to,
        }
      }),
    )
  }

  function setAllIncluded(included: boolean) {
    setRows((prev) =>
      prev.map((row) => {
        if (finalizedNames.has(row.staffName.trim().toLowerCase())) return row
        return { ...row, included }
      }),
    )
  }

  function handleExportExcel() {
    if (includedRows.length === 0) {
      alert("Select at least one employee to export.")
      return
    }
    setExportingExcel(true)
    try {
      const count = downloadMakeSalariesExcel(
        month,
        includedRows.map(({ row, advance, figures }) => ({
          staffName: row.staffName,
          role: row.role,
          department: row.department,
          bankName: row.bankName,
          bankAccountTitle: row.bankAccountTitle,
          bankAccountNumber: row.bankAccountNumber,
          periodFrom: row.periodFrom,
          periodTo: row.periodTo,
          payPeriodText: figures.payPeriodText,
          contractSalary: row.monthlySalary,
          payableSalary: figures.baseSalary,
          advanceDeduction: advance,
          netSalary: figures.netSalary,
          currency: row.currency,
        })),
        recoveredBy,
      )
      alert(`Exported ${count} employee${count === 1 ? "" : "s"} to Excel.`)
    } finally {
      setExportingExcel(false)
    }
  }

  async function saveSlips(status: "draft" | "finalized") {
    const selected = computed.filter((c) => c.row.included)
    if (selected.length === 0) {
      alert("Select at least one employee.")
      return
    }

    for (const { row, figures } of selected) {
      if (!row.periodFrom || !row.periodTo || row.periodTo < row.periodFrom) {
        alert(`Invalid pay period for ${row.staffName}.`)
        return
      }
      if (status === "finalized" && finalizedNames.has(row.staffName.trim().toLowerCase())) {
        alert(`${row.staffName} already has a finalized salary for ${monthLabel(month)}.`)
        return
      }
    }

    const generatedDate = new Date().toISOString()
    const saved: PayrollSummaryRow[] = []

    for (const { row, figures, advance } of selected) {
      const payload = {
        staffLocalId: row.staffId,
        staffName: row.staffName,
        staffRole: row.role,
        staffDepartment: row.department,
        month,
        periodStart: row.periodFrom,
        periodEnd: row.periodTo,
        baseSalary: figures.baseSalary,
        currency: row.currency,
        adjustments: figures.adjustments,
        netSalary: figures.netSalary,
        status,
        generatedDate,
        bankName: row.bankName,
        bankAccountNumber: row.bankAccountNumber,
        bankAccountTitle: row.bankAccountTitle,
      }

      const response = await fetch("/api/hrm/salary-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (response.status === 409) {
        throw new Error(`${row.staffName} already has a finalized slip for ${monthLabel(month)}.`)
      }
      if (!response.ok) {
        throw new Error(`Failed to save salary for ${row.staffName}`)
      }

      if (status === "finalized" && advance > 0) {
        await recoverSalaryAdvances({
          staffId: row.staffId,
          month,
          recoveredBy,
        })
      }

      saved.push({
        staffName: row.staffName,
        staffRole: row.role,
        periodText: figures.payPeriodText,
        baseSalary: figures.baseSalary,
        netSalary: figures.netSalary,
        currency: row.currency,
        advanceDeducted: advance,
        bankName: row.bankName,
        bankAccountNumber: row.bankAccountNumber,
        bankAccountTitle: row.bankAccountTitle,
        status,
      })
    }

    return saved
  }

  async function handleSaveDraftAndExport() {
    setSaving(true)
    try {
      const saved = await saveSlips("draft")
      if (!saved) return

      await downloadPayrollSummaryPdf(month, saved, { isDraft: true })

      for (let i = 0; i < saved.length; i++) {
        const { row, figures } = includedRows[i]
        await downloadSalarySlipPdf(
          {
            staffName: row.staffName,
            staffRole: row.role,
            staffDepartment: row.department,
            month,
            baseSalary: figures.baseSalary,
            currency: row.currency,
            adjustments: figures.adjustments,
            netSalary: figures.netSalary,
            generatedDate: new Date().toISOString(),
            payPeriodText: figures.payPeriodText,
            isDraft: true,
            bankName: row.bankName,
            bankAccountNumber: row.bankAccountNumber,
            bankAccountTitle: row.bankAccountTitle,
          },
          `Salary-Draft-${row.staffName.replace(/\s+/g, "-")}-${month}.pdf`,
        )
        await new Promise((r) => setTimeout(r, 350))
      }

      await onSaved()
      alert(`Saved ${saved.length} salary draft${saved.length === 1 ? "" : "s"} and exported PDFs.`)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save salary drafts.")
    } finally {
      setSaving(false)
    }
  }

  async function handleFinalize() {
    if (!confirm(`Finalize salaries for ${monthLabel(month)}? Advances will be marked recovered.`)) return
    setFinalizing(true)
    try {
      const saved = await saveSlips("finalized")
      if (!saved) return
      await downloadPayrollSummaryPdf(month, saved)
      await onSaved()
      alert(`Finalized ${saved.length} salary record${saved.length === 1 ? "" : "s"} for ${monthLabel(month)}.`)
      onClose()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to finalize salaries.")
    } finally {
      setFinalizing(false)
    }
  }

  function copyAccountNumber(accountNumber: string) {
    if (!accountNumber.trim()) return
    void navigator.clipboard.writeText(accountNumber.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[98vw] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Make Salaries</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Uncheck employees to exclude them from export and payroll. Set pay period per employee, auto-deduct advances.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex flex-wrap items-center gap-3 shrink-0">
          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))] block mb-1">Payroll month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
            />
          </div>
          <Button type="button" size="sm" variant="outline" className="h-9 mt-5" onClick={applyMonthBounds}>
            Reset all to full month
          </Button>
          <div className="flex items-center gap-2 mt-5">
            <Button type="button" size="sm" variant="ghost" className="h-9 text-xs" onClick={() => setAllIncluded(true)}>
              Select all
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-9 text-xs" onClick={() => setAllIncluded(false)}>
              Exclude all
            </Button>
          </div>
          {draftCount > 0 && (
            <Badge variant="outline" className="mt-5 text-amber-700 border-amber-300 bg-amber-50">
              {draftCount} draft{draftCount === 1 ? "" : "s"} saved for this month
            </Badge>
          )}
          <div className="ml-auto text-right mt-1">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Selected total net</p>
            <p className="text-lg font-bold text-[hsl(var(--foreground))]">
              {currency} {totalNet.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="overflow-auto p-4">
          <table className="w-full min-w-[1280px]">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] text-left">
                <th className="px-2 py-2 text-xs font-medium w-10" title="Include in export & payroll">
                  <input
                    type="checkbox"
                    checked={allSelectableIncluded}
                    onChange={(e) => setAllIncluded(e.target.checked)}
                    className="h-4 w-4 rounded"
                    aria-label="Select all employees"
                  />
                </th>
                <th className="px-2 py-2 text-xs font-medium min-w-[140px]">Employee</th>
                <th className="px-2 py-2 text-xs font-medium min-w-[110px]">Bank</th>
                <th className="px-2 py-2 text-xs font-medium min-w-[120px]">Account title</th>
                <th className="px-2 py-2 text-xs font-medium min-w-[120px]">Account #</th>
                <th className="px-2 py-2 text-xs font-medium">From</th>
                <th className="px-2 py-2 text-xs font-medium">To</th>
                <th className="px-2 py-2 text-xs font-medium text-right">Contract</th>
                <th className="px-2 py-2 text-xs font-medium text-right">Payable</th>
                <th className="px-2 py-2 text-xs font-medium text-right">Advance</th>
                <th className="px-2 py-2 text-xs font-medium text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {computed.map(({ row, advance, figures }) => {
                const isFinalized = finalizedNames.has(row.staffName.trim().toLowerCase())
                return (
                  <tr
                    key={row.staffId}
                    className={`border-b border-[hsl(var(--border))] ${!row.included ? "opacity-50" : ""}`}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={row.included}
                        disabled={isFinalized}
                        onChange={(e) => updateRow(row.staffId, { included: e.target.checked })}
                        className="h-4 w-4 rounded"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <p className="text-sm font-medium">{row.staffName}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{row.role}</p>
                      {isFinalized && (
                        <Badge variant="success" className="text-[10px] mt-1">
                          Paid
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-[hsl(var(--foreground))]">
                      {row.bankName || <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                    </td>
                    <td className="px-2 py-2 text-xs text-[hsl(var(--foreground))]">
                      {row.bankAccountTitle || <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs tabular-nums text-[hsl(var(--foreground))]">
                          {row.bankAccountNumber || "—"}
                        </span>
                        {row.bankAccountNumber && (
                          <button
                            type="button"
                            title="Copy account number"
                            onClick={() => copyAccountNumber(row.bankAccountNumber)}
                            className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-[hsl(var(--muted))]/40 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={row.periodFrom}
                        disabled={!row.included || isFinalized}
                        onChange={(e) => updateRow(row.staffId, { periodFrom: e.target.value })}
                        className="h-8 w-[132px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={row.periodTo}
                        disabled={!row.included || isFinalized}
                        onChange={(e) => updateRow(row.staffId, { periodTo: e.target.value })}
                        className="h-8 w-[132px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
                      />
                    </td>
                    <td className="px-2 py-2 text-right text-sm tabular-nums">
                      {row.currency} {row.monthlySalary.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right text-sm tabular-nums">
                      {row.currency} {figures.baseSalary.toLocaleString()}
                      {figures.proRateDescription && figures.proRateDescription !== "Full month" && (
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {figures.proRateDescription}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right text-sm tabular-nums text-red-600">
                      {advance > 0 ? `− ${row.currency} ${advance.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums">
                      {row.currency} {figures.netSalary.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[hsl(var(--border))] px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xl">
            Uncheck any employee to exclude from Excel, PDF, and payroll. {includedRows.length} of {computed.length} selected.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={saving || finalizing || exportingExcel || includedRows.length === 0}
              onClick={handleExportExcel}
            >
              <Download className="h-4 w-4" />
              {exportingExcel ? "Exporting…" : "Export Excel"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={saving || finalizing}
              onClick={handleSaveDraftAndExport}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save draft & export PDF"}
            </Button>
            <Button
              className="gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
              disabled={saving || finalizing}
              onClick={handleFinalize}
            >
              <CheckCircle2 className="h-4 w-4" />
              {finalizing ? "Finalizing…" : "Finalize payroll"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
