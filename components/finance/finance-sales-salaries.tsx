"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import {
  Download,
  FileText,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import {
  downloadSalarySlipPdf,
  monthDateRange,
  monthLabel,
  type SalarySlipAdjustment,
} from "@/lib/generate-salary-slip-pdf"
import { fetchSalesAgents, JOB_TITLE_LABELS, type SalesAgentProfile } from "@/lib/sales-agents"
import type { CommissionSummary } from "@/lib/sales-agents"

type SavedSlip = {
  id: string
  userId: string | null
  staffName: string
  staffRole: string
  staffDepartment: string
  staffCategory: string
  month: string
  baseSalary: number
  currency: string
  adjustments: SalarySlipAdjustment[]
  netSalary: number
  generatedDate: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountTitle?: string
}

type AgentRow = {
  agent: SalesAgentProfile
  commission: number
  deliveredCount: number
  totalSales: number
  slip: SavedSlip | null
}

function fmt(n: number, currency = "PKR") {
  return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function netFromParts(base: number, commission: number, extras: SalarySlipAdjustment[]) {
  let net = base + commission
  for (const adj of extras) {
    const n = Number(adj.amount) || 0
    net += adj.type === "deduct" ? -n : n
  }
  return Math.max(0, net)
}

export function FinanceSalesSalaries({ payrollMonth }: { payrollMonth: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [agents, setAgents] = useState<SalesAgentProfile[]>([])
  const [commissions, setCommissions] = useState<CommissionSummary[]>([])
  const [slips, setSlips] = useState<SavedSlip[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = monthDateRange(payrollMonth)
      const [agentList, commRes, slipRes] = await Promise.all([
        fetchSalesAgents({ withStats: true }),
        fetch(`/api/sales/commissions?from=${from}&to=${to}`).then((r) => r.json()),
        fetch(
          `/api/hrm/salary-slips?staffCategory=sales&month=${encodeURIComponent(payrollMonth)}`,
        ).then((r) => r.json()),
      ])
      setAgents(agentList)
      setCommissions(Array.isArray(commRes) ? commRes : [])
      setSlips(Array.isArray(slipRes) ? slipRes : [])
    } catch (e) {
      toast({
        title: "Failed to load sales payroll",
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

  const rows: AgentRow[] = useMemo(() => {
    const commById = new Map(commissions.map((c) => [c.agentId, c]))
    const slipByUser = new Map(
      slips.filter((s) => s.userId).map((s) => [s.userId!, s]),
    )
    const slipByName = new Map(slips.map((s) => [s.staffName.toLowerCase(), s]))

    return agents.map((agent) => {
      const comm = commById.get(agent.id)
      const slip =
        slipByUser.get(agent.id) ?? slipByName.get(agent.name.toLowerCase()) ?? null
      return {
        agent,
        commission: comm?.commissionEarned ?? 0,
        deliveredCount: comm?.deliveredOrderCount ?? 0,
        totalSales: comm?.totalSales ?? 0,
        slip,
      }
    })
  }, [agents, commissions, slips])

  const pendingCount = rows.filter((r) => !r.slip).length
  const paidCount = rows.filter((r) => r.slip).length
  const totalPayroll = rows.reduce((s, r) => {
    if (r.slip) return s + r.slip.netSalary
    return s + netFromParts(r.agent.baseSalary, r.commission, [])
  }, 0)

  async function generateSlipForRow(row: AgentRow, downloadPdf = true) {
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

    setGenerating(row.agent.id)
    try {
      const base = row.agent.baseSalary
      const commission = row.commission
      const adjustments: SalarySlipAdjustment[] = []
      if (commission > 0) {
        adjustments.push({
          id: `comm-${row.agent.id}`,
          type: "add",
          amount: String(commission),
          label: `Sales commission (${row.deliveredCount} delivered orders)`,
        })
      }

      const netSalary = netFromParts(base, commission, adjustments)
      const roleLabel =
        JOB_TITLE_LABELS[row.agent.jobTitle as keyof typeof JOB_TITLE_LABELS] ??
        row.agent.jobTitle

      const payload = {
        userId: row.agent.id,
        staffName: row.agent.name,
        staffRole: roleLabel,
        staffDepartment: "Sales",
        staffCategory: "sales",
        month: payrollMonth,
        baseSalary: base,
        currency: "PKR",
        adjustments,
        netSalary,
        generatedDate: new Date().toISOString(),
        bankName: "",
        bankAccountNumber: "",
        bankAccountTitle: "",
      }

      const res = await fetch("/api/hrm/salary-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.status === 409) {
        toast({
          title: "Slip already exists",
          message: "Refreshing records…",
          type: "warning",
        })
        await load()
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Save failed")
      }

      const saved = (await res.json()) as SavedSlip
      if (downloadPdf) {
        await downloadSalarySlipPdf({
          ...payload,
          generatedDate: saved.generatedDate ?? payload.generatedDate,
        })
      }

      toast({
        title: "Salary slip generated",
        message: `${row.agent.name} — ${monthLabel(payrollMonth)}`,
        type: "success",
      })
      await load()
    } catch (e) {
      toast({
        title: "Could not generate slip",
        message: e instanceof Error ? e.message : undefined,
        type: "error",
      })
    } finally {
      setGenerating(null)
    }
  }

  async function generateAllPending() {
    const pending = rows.filter((r) => !r.slip)
    if (pending.length === 0) {
      toast({ title: "All slips already generated for this month", type: "success" })
      return
    }
    setBulkRunning(true)
    let ok = 0
    for (const row of pending) {
      try {
        await generateSlipForRow(row, false)
        ok += 1
      } catch {
        // toast already shown
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
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Base salary plus commission from <strong>delivered</strong> orders in{" "}
        {monthLabel(payrollMonth)}.
      </p>
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
              Generate all agents ({pendingCount})
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Sales agents", value: String(rows.length) },
          { label: "Slips generated", value: `${paidCount}/${rows.length}` },
          { label: "Pending", value: String(pendingCount) },
          { label: "Est. payroll", value: fmt(totalPayroll) },
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
        <div className="flex justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading sales payroll…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No sales agents found. Add agents under CRM → Sales agents.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[hsl(var(--muted))]/40 text-left text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold text-right">Base</th>
                <th className="px-4 py-3 font-semibold text-right">Commission</th>
                <th className="px-4 py-3 font-semibold text-right">Net (est.)</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const roleLabel =
                  JOB_TITLE_LABELS[row.agent.jobTitle as keyof typeof JOB_TITLE_LABELS] ??
                  row.agent.jobTitle
                const netEst = row.slip?.netSalary ?? netFromParts(
                  row.agent.baseSalary,
                  row.commission,
                  [],
                )
                const comm = commissions.find((c) => c.agentId === row.agent.id)
                const expanded = expandedId === row.agent.id

                return (
                  <Fragment key={row.agent.id}>
                    <tr className="hover:bg-[hsl(var(--muted))]/10">
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.agent.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {roleLabel} · {row.agent.commissionPercent}% comm.
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(row.agent.baseSalary)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(row.commission)}
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {row.deliveredCount} delivered
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {fmt(netEst)}
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
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {comm && comm.orders.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 cursor-pointer"
                              onClick={() =>
                                setExpandedId(expanded ? null : row.agent.id)
                              }
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 cursor-pointer"
                            disabled={generating === row.agent.id}
                            onClick={() => void generateSlipForRow(row, true)}
                          >
                            {generating === row.agent.id ? (
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
                        </div>
                      </td>
                    </tr>
                    {expanded && comm && (
                      <tr key={`${row.agent.id}-detail`}>
                        <td colSpan={6} className="px-4 py-3 bg-[hsl(var(--muted))]/15">
                          <p className="text-xs font-semibold mb-2">
                            Delivered orders — {monthLabel(payrollMonth)}
                          </p>
                          <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                            {comm.orders
                              .filter((o) => o.status === "delivered")
                              .map((o) => (
                                <li
                                  key={o.id}
                                  className="flex justify-between gap-4 border-b border-[hsl(var(--border))]/50 py-1"
                                >
                                  <span>
                                    {o.orderNumber} · {o.clientName}
                                  </span>
                                  <span className="tabular-nums shrink-0">
                                    {fmt(o.total)}{" "}
                                    {o.commissionAmount != null &&
                                      `(comm. ${fmt(o.commissionAmount)})`}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
