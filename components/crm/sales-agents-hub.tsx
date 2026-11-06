"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  fetchSalesAgents,
  fetchSalesManagers,
  fetchCompensationHistory,
  fetchCommissionSummary,
  JOB_TITLE_LABELS,
  type SalesAgentProfile,
  type CompensationHistoryRow,
  type CommissionSummary,
  type SalesManagerOption,
} from "@/lib/sales-agents"
import { SalesAgentFormModal } from "@/components/crm/sales-agent-form-modal"
import { canManageAllSalesAgents } from "@/lib/crm-workspace"
import type { User } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { ClientsList } from "@/components/crm/clients-list"
import { OrdersList } from "@/components/crm/orders-list"
import { QuotationsList } from "@/components/crm/quotations-list"
import type { CrmWorkspaceScope } from "@/lib/crm-workspace"
import { SalesAgentsDashboard } from "@/components/crm/sales-agents-dashboard"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  History,
  MapPin,
  Plus,
  X,
} from "lucide-react"

type HubTab = "dashboard" | "agents" | "commissions"
type AgentWorkspaceTab = "clients" | "quotations" | "orders"

type Props = {
  user: User
  onSelectAgent?: (agent: User) => void
}

function formatMoney(n: number) {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

const controlClass =
  "mt-1 w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-3 text-[13px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"

export function SalesAgentsHub({ user }: Props) {
  const { toast } = useToast()
  const isSuperAdmin = canManageAllSalesAgents(user)
  const managerFilter = user.role === "sales_manager" ? user.id : undefined

  const [hubTab, setHubTab] = useState<HubTab>("dashboard")
  const [agents, setAgents] = useState<SalesAgentProfile[]>([])
  const [managers, setManagers] = useState<SalesManagerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SalesAgentProfile | null>(null)
  const [workspaceTab, setWorkspaceTab] = useState<AgentWorkspaceTab>("clients")

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SalesAgentProfile | null>(null)

  const [historyAgent, setHistoryAgent] = useState<SalesAgentProfile | null>(null)
  const [history, setHistory] = useState<CompensationHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [commissionFrom, setCommissionFrom] = useState("")
  const [commissionTo, setCommissionTo] = useState("")
  const [commissionAgentId, setCommissionAgentId] = useState("")
  const [commissions, setCommissions] = useState<CommissionSummary[]>([])
  const [commissionLoading, setCommissionLoading] = useState(false)

  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const [list, mgrList] = await Promise.all([
        fetchSalesAgents({ managerId: managerFilter, withStats: true }),
        fetchSalesManagers(),
      ])
      setAgents(list)
      setManagers(mgrList)
    } catch {
      toast({ title: "Error", message: "Failed to load sales agents.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [managerFilter, toast])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  function closeForm() {
    setEditing(null)
    setShowForm(false)
  }

  function openNewAgent() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(agent: SalesAgentProfile) {
    setEditing(agent)
    setShowForm(true)
  }

  async function reloadManagers() {
    try {
      setManagers(await fetchSalesManagers())
    } catch {
      /* ignore */
    }
  }

  async function openHistory(agent: SalesAgentProfile) {
    setHistoryAgent(agent)
    setHistoryLoading(true)
    try {
      setHistory(await fetchCompensationHistory(agent.id))
    } catch {
      toast({ title: "Error", message: "Could not load compensation history.", type: "error" })
    } finally {
      setHistoryLoading(false)
    }
  }

  async function runCommissionCalc() {
    setCommissionLoading(true)
    try {
      const data = await fetchCommissionSummary({
        agentId: commissionAgentId || undefined,
        from: commissionFrom || undefined,
        to: commissionTo || undefined,
      })
      const filtered = managerFilter
        ? data.filter(row => agents.some(a => a.id === row.agentId))
        : data
      setCommissions(filtered)
    } catch {
      toast({ title: "Error", message: "Commission calculation failed.", type: "error" })
    } finally {
      setCommissionLoading(false)
    }
  }

  const workspace: CrmWorkspaceScope | undefined = selected
    ? { mode: "sales_agent", ownerUserId: selected.id, readOnly: true }
    : undefined

  const tabs: { id: HubTab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "agents", label: "Agents" },
    { id: "commissions", label: "Commissions" },
  ]

  if (selected && workspace) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
              {selected.name}
            </p>
            <p className="text-[12px] text-[#86868b] mt-0.5">
              {selected.location || "No location"} · {JOB_TITLE_LABELS[selected.jobTitle]} ·{" "}
              {selected.commissionPercent}% commission
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full text-[11px] px-3.5 border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] cursor-pointer shrink-0"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back
          </Button>
        </div>

        <div className="inline-flex items-center rounded-[10px] bg-black/[0.06] dark:bg-white/10 p-[3px]">
          {(["clients", "quotations", "orders"] as const).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setWorkspaceTab(key)}
              className={cn(
                "px-3.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-all capitalize cursor-pointer",
                workspaceTab === key
                  ? "bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[hsl(var(--muted-foreground))]",
              )}
            >
              {key}
            </button>
          ))}
        </div>

        {workspaceTab === "clients" && (
          <ClientsList currentUser={selected.name} currentUserId={selected.id} workspace={workspace} />
        )}
        {workspaceTab === "quotations" && (
          <QuotationsList currentUser={selected.name} currentUserId={selected.id} workspace={workspace} />
        )}
        {workspaceTab === "orders" && (
          <OrdersList currentUser={selected.name} currentUserId={selected.id} workspace={workspace} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex max-w-full items-center rounded-[10px] bg-black/[0.06] dark:bg-white/10 p-[3px] overflow-x-auto scrollbar-none">
          {tabs.map(t => {
            const selectedTab = hubTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setHubTab(t.id)}
                className={cn(
                  "shrink-0 px-3.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-all duration-200 cursor-pointer",
                  selectedTab
                    ? "bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shadow-sm"
                    : "text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] hover:text-[#1d1d1f] dark:hover:text-[hsl(var(--foreground))]",
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        {isSuperAdmin && (
          <Button
            size="sm"
            className="h-8 rounded-full text-[11px] px-3.5 cursor-pointer bg-[#1d1d1f] hover:bg-black text-white dark:bg-white dark:text-[#1d1d1f] shrink-0"
            onClick={openNewAgent}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New agent
          </Button>
        )}
      </div>

      {hubTab === "dashboard" && (
        <SalesAgentsDashboard
          agents={agents}
          loading={loading}
          onSelectAgent={setSelected}
        />
      )}

      {isSuperAdmin && (
        <SalesAgentFormModal
          open={showForm}
          editing={editing}
          managers={managers}
          otherAgents={agents}
          updatedBy={user.name}
          onClose={closeForm}
          onSaved={loadAgents}
          onManagersChange={reloadManagers}
        />
      )}

      {hubTab === "agents" && (
        <div className="rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-7 w-7 rounded-full border-2 border-[#0071e3] border-t-transparent animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <p className="p-10 text-center text-[13px] text-[#86868b]">No sales agents yet.</p>
          ) : (
            <div className="overflow-x-auto scrollbar-none">
              <table className="w-full text-[13px] min-w-[980px]">
                <thead>
                  <tr className="border-b border-black/[0.04] dark:border-[hsl(var(--border))] bg-[#fafafa] dark:bg-[hsl(var(--muted))]/30 text-left">
                    <th className="px-4 py-2.5 font-medium text-[11px] text-[#86868b]">Agent</th>
                    <th className="px-3 py-2.5 font-medium text-[11px] text-[#86868b]">Manager</th>
                    <th className="px-3 py-2.5 font-medium text-[11px] text-[#86868b]">Location</th>
                    <th className="px-3 py-2.5 font-medium text-[11px] text-[#86868b]">Salary</th>
                    <th className="px-3 py-2.5 font-medium text-[11px] text-[#86868b]">Rate</th>
                    <th className="px-3 py-2.5 font-medium text-[11px] text-[#86868b]">Clients</th>
                    <th className="px-3 py-2.5 font-medium text-[11px] text-[#86868b]">Quotes</th>
                    <th className="px-3 py-2.5 font-medium text-[11px] text-[#86868b]">Orders</th>
                    <th className="px-3 py-2.5 font-medium text-[11px] text-[#86868b]">Sold</th>
                    <th className="px-3 py-2.5 font-medium text-[11px] text-[#86868b]">Commission</th>
                    <th className="px-3 py-2.5 font-medium text-[11px] text-[#86868b]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-[hsl(var(--border))]">
                  {agents.map(agent => (
                    <tr
                      key={agent.id}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2f2f7] dark:bg-[hsl(var(--muted))]/40 text-[12px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                            {agent.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
                              {agent.name}
                            </p>
                            <p className="text-[11px] text-[#86868b] truncate">{agent.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[12px] text-[#86868b]">{agent.managerName || "—"}</td>
                      <td className="px-3 py-3 text-[12px]">
                        {agent.location ? (
                          <span className="inline-flex items-center gap-1 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                            <MapPin className="h-3 w-3 text-[#86868b]" />
                            {agent.location}
                          </span>
                        ) : (
                          <span className="text-[#86868b]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[12px] tabular-nums">{formatMoney(agent.baseSalary)}</td>
                      <td className="px-3 py-3 text-[12px] tabular-nums">{agent.commissionPercent}%</td>
                      <td className="px-3 py-3 text-[12px] tabular-nums">{agent.stats?.clients ?? 0}</td>
                      <td className="px-3 py-3 text-[12px]">
                        <span className="tabular-nums font-medium">{agent.stats?.quotations ?? 0}</span>
                        <span className="block text-[11px] text-[#86868b] tabular-nums">
                          {formatMoney(agent.stats?.quotationsValue ?? 0)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px]">
                        <span className="tabular-nums font-medium">{agent.stats?.orders ?? 0}</span>
                        <span className="block text-[11px] text-[#86868b] tabular-nums">
                          {agent.stats?.pendingOrders ?? 0} pending
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-medium tabular-nums">
                        {formatMoney(agent.stats?.totalSales ?? 0)}
                        <span className="block text-[11px] font-normal text-[#86868b] tabular-nums">
                          {agent.stats?.deliveredOrders ?? 0} delivered
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-semibold tabular-nums text-[#0071e3]">
                        {formatMoney(agent.stats?.commissionEarned ?? 0)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {isSuperAdmin && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 rounded-full text-[11px] px-2.5 cursor-pointer"
                                onClick={() => openEdit(agent)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 rounded-full p-0 cursor-pointer"
                                onClick={() => openHistory(agent)}
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full text-[11px] px-2.5 border-black/[0.08] cursor-pointer"
                            onClick={() => setSelected(agent)}
                          >
                            View
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {hubTab === "commissions" && (
        <div className="space-y-3">
          <div className="rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">
                From
              </label>
              <input
                type="date"
                className={controlClass}
                value={commissionFrom}
                onChange={e => setCommissionFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">
                To
              </label>
              <input
                type="date"
                className={controlClass}
                value={commissionTo}
                onChange={e => setCommissionTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">
                Agent
              </label>
              <select
                className={controlClass}
                value={commissionAgentId}
                onChange={e => setCommissionAgentId(e.target.value)}
              >
                <option value="">All agents</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              className="h-9 rounded-full text-[12px] px-4 cursor-pointer lg:col-span-2 bg-[#1d1d1f] hover:bg-black text-white dark:bg-white dark:text-[#1d1d1f]"
              disabled={commissionLoading}
              onClick={runCommissionCalc}
            >
              <Calculator className="h-3.5 w-3.5 mr-1.5" />
              {commissionLoading ? "Calculating…" : "Calculate"}
            </Button>
          </div>

          {commissions.map(row => (
            <div
              key={row.agentId}
              className="rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] p-4 space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                    {row.agentName}
                  </p>
                  <p className="text-[12px] text-[#86868b] mt-0.5">
                    {row.currentCommissionPercent}% · Base {formatMoney(row.baseSalary)}
                  </p>
                </div>
                <div className="text-right text-[12px] space-y-0.5">
                  <p className="text-[#86868b]">
                    Delivered <strong className="text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{row.deliveredOrderCount}</strong>
                  </p>
                  <p className="font-semibold text-[#0071e3]">
                    Commission {formatMoney(row.commissionEarned)}
                  </p>
                  <p className="text-[#86868b]">Sales {formatMoney(row.totalSales)}</p>
                </div>
              </div>
              {row.orders.length > 0 && (
                <div className="overflow-x-auto max-h-48 overflow-y-auto scrollbar-none rounded-[12px] border border-black/[0.04] dark:border-[hsl(var(--border))]">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-[#86868b] border-b border-black/[0.04] bg-[#fafafa] dark:bg-[hsl(var(--muted))]/25">
                        <th className="py-2 px-3 text-left font-medium text-[11px]">Order</th>
                        <th className="py-2 px-3 text-left font-medium text-[11px]">Client</th>
                        <th className="py-2 px-3 text-left font-medium text-[11px]">Status</th>
                        <th className="py-2 px-3 text-right font-medium text-[11px]">Total</th>
                        <th className="py-2 px-3 text-right font-medium text-[11px]">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {row.orders.map(o => (
                        <tr key={o.id}>
                          <td className="py-2 px-3 font-medium">{o.orderNumber}</td>
                          <td className="py-2 px-3 text-[#86868b]">{o.clientName}</td>
                          <td className="py-2 px-3 capitalize text-[#86868b]">{o.status.replace(/_/g, " ")}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{formatMoney(o.total)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#0071e3] font-medium">
                            {o.status === "delivered" && o.commissionAmount != null
                              ? formatMoney(o.commissionAmount)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {historyAgent &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xl p-4"
            onClick={() => setHistoryAgent(null)}
          >
            <div
              className="bg-white/95 dark:bg-[hsl(var(--card))]/95 rounded-[20px] border border-black/[0.06] dark:border-[hsl(var(--border))] max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/[0.06] dark:border-[hsl(var(--border))]">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[#86868b]">Compensation history</p>
                  <p className="text-[15px] font-semibold tracking-tight truncate">{historyAgent.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryAgent(null)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] hover:bg-black/[0.1] cursor-pointer"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>
              <div className="overflow-y-auto scrollbar-none p-4 space-y-2">
                {historyLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="h-6 w-6 rounded-full border-2 border-[#0071e3] border-t-transparent animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-[13px] text-center py-8 text-[#86868b]">No history yet.</p>
                ) : (
                  history.map(h => (
                    <div
                      key={h.id}
                      className="rounded-[12px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-[#fafafa] dark:bg-[hsl(var(--muted))]/15 p-3 text-[12px] space-y-1"
                    >
                      <p className="font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                        {formatMoney(h.baseSalary)} · {h.commissionPercent}%
                      </p>
                      <p className="text-[#86868b]">
                        From {new Date(h.effectiveFrom).toLocaleDateString()} · {h.createdBy}
                      </p>
                      {h.note && <p>{h.note}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
