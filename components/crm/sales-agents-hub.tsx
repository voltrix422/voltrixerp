"use client"

import { useCallback, useEffect, useState } from "react"
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
import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  History,
  LayoutDashboard,
  MapPin,
  Plus,
  Users,
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

  if (selected && workspace) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-[hsl(var(--muted))]/20 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{selected.name}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {selected.location || "No location"} · {JOB_TITLE_LABELS[selected.jobTitle]} ·{" "}
              {selected.commissionPercent}% commission
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to agents
          </Button>
        </div>

        <div className="flex items-center gap-1 border-b">
          {(["clients", "quotations", "orders"] as const).map(key => (
            <button
              key={key}
              onClick={() => setWorkspaceTab(key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer capitalize ${
                workspaceTab === key
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {key}
              {workspaceTab === key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#1faca6]" />
            <h2 className="text-sm font-semibold">
              {isSuperAdmin ? "Sales agents" : "My sales team"}
            </h2>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Manage agents, compensation, and commission reports.
          </p>
        </div>
        {isSuperAdmin && (
          <Button
            size="sm"
            className="h-8 text-xs cursor-pointer"
            onClick={openNewAgent}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New agent
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b">
        {([
          ["dashboard", "Dashboard"],
          ["agents", "Agents"],
          ["commissions", "Commission calculator"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setHubTab(key)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer flex items-center gap-1 ${
              hubTab === key
                ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {key === "dashboard" && <LayoutDashboard className="h-3 w-3" />}
            {label}
            {hubTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
          </button>
        ))}
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
        <div className="rounded-lg border overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-[hsl(var(--muted-foreground))]">Loading agents...</p>
          ) : agents.length === 0 ? (
            <p className="p-6 text-sm text-[hsl(var(--muted-foreground))]">No sales agents yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[hsl(var(--muted))]/30 text-left text-xs text-[hsl(var(--muted-foreground))]">
                    <th className="px-4 py-2 font-medium">Agent</th>
                    <th className="px-4 py-2 font-medium">Manager</th>
                    <th className="px-4 py-2 font-medium">Location</th>
                    <th className="px-4 py-2 font-medium">Salary</th>
                    <th className="px-4 py-2 font-medium">Commission</th>
                    <th className="px-4 py-2 font-medium">Clients</th>
                    <th className="px-4 py-2 font-medium">Quotes</th>
                    <th className="px-4 py-2 font-medium">Orders</th>
                    <th className="px-4 py-2 font-medium">Sold</th>
                    <th className="px-4 py-2 font-medium">Commission</th>
                    <th className="px-4 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {agents.map(agent => (
                    <tr key={agent.id} className="border-b last:border-0 hover:bg-[hsl(var(--muted))]/10">
                      <td className="px-4 py-3">
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{agent.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">{agent.managerName || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {agent.location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {agent.location}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{formatMoney(agent.baseSalary)}</td>
                      <td className="px-4 py-3 text-xs">{agent.commissionPercent}%</td>
                      <td className="px-4 py-3 text-xs">{agent.stats?.clients ?? 0}</td>
                      <td className="px-4 py-3 text-xs">
                        {agent.stats?.quotations ?? 0}
                        <span className="block text-[10px] text-[hsl(var(--muted-foreground))]">
                          {formatMoney(agent.stats?.quotationsValue ?? 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {agent.stats?.orders ?? 0}
                        <span className="block text-[10px] text-[hsl(var(--muted-foreground))]">
                          {agent.stats?.pendingOrders ?? 0} pending
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">
                        {formatMoney(agent.stats?.totalSales ?? 0)}
                        <span className="block text-[10px] font-normal text-[hsl(var(--muted-foreground))]">
                          {agent.stats?.deliveredOrders ?? 0} delivered
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#1faca6] font-medium">
                        {formatMoney(agent.stats?.commissionEarned ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {isSuperAdmin && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs cursor-pointer"
                                onClick={() => openEdit(agent)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs cursor-pointer"
                                onClick={() => openHistory(agent)}
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs cursor-pointer"
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
        <div className="space-y-4">
          <div className="rounded-lg border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))]">From date</label>
              <input
                type="date"
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                value={commissionFrom}
                onChange={e => setCommissionFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))]">To date</label>
              <input
                type="date"
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                value={commissionTo}
                onChange={e => setCommissionTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Agent</label>
              <select
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm bg-transparent"
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
              className="h-9 text-xs cursor-pointer lg:col-span-2"
              disabled={commissionLoading}
              onClick={runCommissionCalc}
            >
              <Calculator className="h-3.5 w-3.5 mr-1.5" />
              {commissionLoading ? "Calculating..." : "Calculate commission"}
            </Button>
          </div>

          {commissions.map(row => (
            <div key={row.agentId} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{row.agentName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {row.currentCommissionPercent}% · Base {formatMoney(row.baseSalary)}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p>
                    Delivered: <strong>{row.deliveredOrderCount}</strong>
                  </p>
                  <p className="text-[#1faca6] font-semibold">
                    Commission: {formatMoney(row.commissionEarned)}
                  </p>
                  <p>Sales: {formatMoney(row.totalSales)}</p>
                </div>
              </div>
              {row.orders.length > 0 && (
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[hsl(var(--muted-foreground))] border-b">
                        <th className="py-1 text-left">Order</th>
                        <th className="py-1 text-left">Client</th>
                        <th className="py-1 text-left">Status</th>
                        <th className="py-1 text-right">Total</th>
                        <th className="py-1 text-right">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.orders.map(o => (
                        <tr key={o.id} className="border-b border-dashed last:border-0">
                          <td className="py-1.5">{o.orderNumber}</td>
                          <td className="py-1.5">{o.clientName}</td>
                          <td className="py-1.5 capitalize">{o.status.replace(/_/g, " ")}</td>
                          <td className="py-1.5 text-right">{formatMoney(o.total)}</td>
                          <td className="py-1.5 text-right text-[#1faca6]">
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

      {historyAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[hsl(var(--background))] rounded-lg border max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-semibold">Compensation history · {historyAgent.name}</p>
              <button type="button" onClick={() => setHistoryAgent(null)} className="cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {historyLoading ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No history yet.</p>
              ) : (
                history.map(h => (
                  <div key={h.id} className="rounded-md border p-3 text-xs space-y-1">
                    <p className="font-medium">
                      {formatMoney(h.baseSalary)} · {h.commissionPercent}%
                    </p>
                    <p className="text-[hsl(var(--muted-foreground))]">
                      From {new Date(h.effectiveFrom).toLocaleDateString()} · {h.createdBy}
                    </p>
                    {h.note && <p>{h.note}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
