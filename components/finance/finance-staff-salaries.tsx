"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, FileText, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import {
  downloadSalarySlipPdf,
  monthLabel,
  type SalarySlipAdjustment,
} from "@/lib/generate-salary-slip-pdf"
import { getStaff, type Staff } from "@/lib/staff"
import {
  fetchSalarySlips,
  fmtPayroll,
  netFromPayrollParts,
  saveSalarySlip,
  type SavedSalarySlip,
} from "@/lib/payroll-types"

type RowAdjust = { bonus: string; deduct: string; bonusLabel: string; deductLabel: string }

function buildAdjustments(row: RowAdjust): SalarySlipAdjustment[] {
  const list: SalarySlipAdjustment[] = []
  const bonus = Number(row.bonus)
  if (row.bonus.trim() && Number.isFinite(bonus) && bonus > 0) {
    list.push({
      id: `bonus-${Date.now()}`,
      type: "add",
      amount: String(bonus),
      label: row.bonusLabel.trim() || "Bonus / allowance",
    })
  }
  const deduct = Number(row.deduct)
  if (row.deduct.trim() && Number.isFinite(deduct) && deduct > 0) {
    list.push({
      id: `deduct-${Date.now()}`,
      type: "deduct",
      amount: String(deduct),
      label: row.deductLabel.trim() || "Deduction",
    })
  }
  return list
}

export function FinanceStaffSalaries({ payrollMonth }: { payrollMonth: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [staff, setStaff] = useState<Staff[]>([])
  const [slips, setSlips] = useState<SavedSalarySlip[]>([])
  const [adjustments, setAdjustments] = useState<Record<string, RowAdjust>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [staffList, slipList] = await Promise.all([
        getStaff(),
        fetchSalarySlips({ staffCategory: "hrm", month: payrollMonth }),
      ])
      setStaff(staffList.filter((s) => s.status === "active"))
      setSlips(slipList)
    } catch (e) {
      toast({
        title: "Failed to load staff payroll",
        message: e instanceof Error ? e.message : undefined,
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }, [payrollMonth, toast])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    const slipByUser = new Map(slips.filter((s) => s.userId).map((s) => [s.userId!, s]))
    const slipByName = new Map(slips.map((s) => [s.staffName.toLowerCase(), s]))
    return staff.map((member) => ({
      member,
      slip: slipByUser.get(member.id) ?? slipByName.get(member.name.toLowerCase()) ?? null,
    }))
  }, [staff, slips])

  const pendingCount = rows.filter((r) => !r.slip).length
  const paidCount = rows.filter((r) => r.slip).length
  const totalPayroll = rows.reduce((s, r) => {
    if (r.slip) return s + r.slip.netSalary
    const adj = buildAdjustments(
      adjustments[r.member.id] ?? { bonus: "", deduct: "", bonusLabel: "", deductLabel: "" },
    )
    return s + netFromPayrollParts(r.member.salary, 0, adj)
  }, 0)

  function getRowAdjust(staffId: string): RowAdjust {
    return (
      adjustments[staffId] ?? { bonus: "", deduct: "", bonusLabel: "", deductLabel: "" }
    )
  }

  function patchAdjust(staffId: string, patch: Partial<RowAdjust>) {
    setAdjustments((prev) => ({
      ...prev,
      [staffId]: { ...getRowAdjust(staffId), ...patch },
    }))
  }

  async function generateForRow(
    row: (typeof rows)[0],
    downloadPdf = true,
    skipToast = false,
  ) {
    if (row.slip) {
      if (downloadPdf) {
        await downloadSalarySlipPdf({
          ...row.slip,
          adjustments: row.slip.adjustments ?? [],
          generatedDate: row.slip.generatedDate,
        })
      }
      return
    }

    setGenerating(row.member.id)
    try {
      const member = row.member
      const currency = member.currency || "PKR"
      const extraAdj = buildAdjustments(getRowAdjust(member.id))
      const netSalary = netFromPayrollParts(member.salary, 0, extraAdj)

      const payload = {
        userId: member.id,
        staffName: member.name,
        staffRole: member.role,
        staffDepartment: member.department || "General",
        staffCategory: "hrm",
        month: payrollMonth,
        baseSalary: member.salary,
        currency,
        adjustments: extraAdj,
        netSalary,
        generatedDate: new Date().toISOString(),
        bankName: member.bankName ?? "",
        bankAccountNumber: member.bankAccountNumber ?? "",
        bankAccountTitle: member.bankAccountTitle ?? "",
      }

      const saved = await saveSalarySlip(payload)
      if (downloadPdf) {
        await downloadSalarySlipPdf({
          ...payload,
          generatedDate: saved.generatedDate ?? payload.generatedDate,
        })
      }
      if (!skipToast) {
        toast({
          title: "Salary slip generated",
          message: `${member.name} — ${monthLabel(payrollMonth)}`,
          type: "success",
        })
      }
      await load()
    } catch (e) {
      if ((e as Error).message.includes("already exists")) {
        await load()
      }
      toast({
        title: "Could not generate slip",
        message: e instanceof Error ? e.message : undefined,
        type: "error",
      })
      throw e
    } finally {
      setGenerating(null)
    }
  }

  async function generateAllPending() {
    const pending = rows.filter((r) => !r.slip)
    if (pending.length === 0) {
      toast({ title: "All staff slips already generated for this month", type: "success" })
      return
    }
    setBulkRunning(true)
    let ok = 0
    for (const row of pending) {
      try {
        await generateForRow(row, false, true)
        ok += 1
      } catch {
        // continue
      }
    }
    setBulkRunning(false)
    toast({
      title: "Bulk payroll complete",
      message: `${ok} of ${pending.length} salary slips created`,
      type: ok === pending.length ? "success" : "warning",
    })
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button
          size="sm"
          className="cursor-pointer bg-[#1faca6] hover:bg-[#1a9a95] text-white"
          disabled={bulkRunning || pendingCount === 0}
          onClick={() => void generateAllPending()}
        >
          {bulkRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <FileText className="h-4 w-4 mr-1" />
              Generate all staff ({pendingCount})
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active staff", value: String(rows.length) },
          { label: "Slips generated", value: `${paidCount}/${rows.length}` },
          { label: "Pending", value: String(pendingCount) },
          { label: "Est. payroll", value: fmtPayroll(totalPayroll) },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border p-3 bg-[hsl(var(--card))]">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {k.label}
            </p>
            <p className="text-lg font-semibold mt-0.5 tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading staff…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No active staff in HRM. Add employees under the HRM module first.
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-[hsl(var(--muted))]/40 text-left text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold text-right">Base salary</th>
                <th className="px-4 py-3 font-semibold">Bonus / deduction</th>
                <th className="px-4 py-3 font-semibold text-right">Net (est.)</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const adj = getRowAdjust(row.member.id)
                const extraAdj = buildAdjustments(adj)
                const currency = row.member.currency || "PKR"
                const netEst =
                  row.slip?.netSalary ??
                  netFromPayrollParts(row.member.salary, 0, extraAdj)

                return (
                  <tr key={row.member.id} className="hover:bg-[hsl(var(--muted))]/10">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.member.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {row.member.role} · {row.member.department}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtPayroll(row.member.salary, currency)}
                    </td>
                    <td className="px-4 py-3">
                      {row.slip ? (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          <input
                            type="number"
                            min={0}
                            placeholder="+ Bonus"
                            title="Bonus amount"
                            className="w-20 h-7 rounded border px-1.5 text-xs"
                            value={adj.bonus}
                            onChange={(e) =>
                              patchAdjust(row.member.id, { bonus: e.target.value })
                            }
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="− Deduct"
                            title="Deduction amount"
                            className="w-20 h-7 rounded border px-1.5 text-xs"
                            value={adj.deduct}
                            onChange={(e) =>
                              patchAdjust(row.member.id, { deduct: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {fmtPayroll(netEst, currency)}
                    </td>
                    <td className="px-4 py-3">
                      {row.slip ? (
                        <Badge className="bg-green-500/10 text-green-700 border-green-200">
                          Slip saved
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 cursor-pointer"
                        disabled={generating === row.member.id}
                        onClick={() => void generateForRow(row, true)}
                      >
                        {generating === row.member.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : row.slip ? (
                          <>
                            <Download className="h-3.5 w-3.5 mr-1" />
                            PDF
                          </>
                        ) : (
                          <>
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            Generate
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
