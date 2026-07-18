"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StaffKpiSection } from "@/components/hrm/staff-kpi-section"
import {
  computeStaffCompensation,
  normalizeStaffPayLines,
  type StaffPayLine,
} from "@/lib/hrm-salary-calc"
import {
  Banknote,
  Briefcase,
  Download,
  FileText,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Wallet,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"

export type StaffDetailMember = {
  id: string
  name: string
  role: string
  department: string
  email: string
  phone: string
  address: string
  salary: number
  employment_type?: string
  basic_salary?: number
  medical_allowance?: number
  medical_enabled?: boolean
  tax_amount?: number
  tax_enabled?: boolean
  eobi_amount?: number
  eobi_enabled?: boolean
  custom_allowances?: StaffPayLine[] | unknown
  custom_deductions?: StaffPayLine[] | unknown
  currency: string
  join_date: string
  status: "active" | "inactive"
  notes: string
  photo_url: string
  documents: { name: string; data: string; type: string; size: number }[]
  points: number
  warnings: { level: 0 | 1 | 2 | 3; message: string; date: string; pointsAtWarning: number }[]
  last_reset?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_title?: string
}

type DetailTab = "overview" | "compensation" | "payroll" | "performance" | "documents"

const TABS: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "compensation", label: "Compensation" },
  { id: "payroll", label: "Payroll" },
  { id: "performance", label: "Performance" },
  { id: "documents", label: "Documents" },
]

function money(currency: string, amount: number) {
  return `${currency} ${Number(amount || 0).toLocaleString()}`
}

function ToggleSwitch({
  checked,
  disabled,
  title,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  title?: string
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? "bg-[#1a9f9a]" : "bg-[hsl(var(--muted))]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

function CompRow({
  label,
  value,
  hint,
  tone = "neutral",
  toggle,
}: {
  label: string
  value: string
  hint?: string
  tone?: "neutral" | "add" | "deduct" | "net"
  toggle?: React.ReactNode
}) {
  const valueClass =
    tone === "add"
      ? "text-emerald-700"
      : tone === "deduct"
        ? "text-rose-600"
        : tone === "net"
          ? "text-[#0f766e] text-base"
          : "text-[hsl(var(--foreground))]"
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[hsl(var(--border))]/70 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
        {hint ? <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{hint}</p> : null}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-sm font-semibold tabular-nums ${valueClass}`}>{value}</span>
        {toggle}
      </div>
    </div>
  )
}

export function StaffEmployeeDetail({
  member,
  isAdmin,
  outstandingAdvance,
  salarySlips,
  togglingKey,
  onClose,
  onEdit,
  onDownloadIdCard,
  onOpenAdvance,
  onGenerateSlip,
  onOpenHistory,
  onOpenPhoto,
  onToggleMedical,
  onToggleTax,
  onToggleEobi,
  onToggleCustomAllowance,
  onToggleCustomDeduction,
  onUpdatePoints,
  onResetPoints,
  actorName,
  PointsBar,
  monthLabel,
}: {
  member: StaffDetailMember
  isAdmin: boolean
  outstandingAdvance: number
  salarySlips: any[]
  togglingKey: string | null
  onClose: () => void
  onEdit: () => void
  onDownloadIdCard: () => void
  onOpenAdvance: () => void
  onGenerateSlip: () => void
  onOpenHistory: () => void
  onOpenPhoto: () => void
  onToggleMedical: (enabled: boolean) => void
  onToggleTax: (enabled: boolean) => void
  onToggleEobi: (enabled: boolean) => void
  onToggleCustomAllowance: (id: string, enabled: boolean) => void
  onToggleCustomDeduction: (id: string, enabled: boolean) => void
  onUpdatePoints: (delta: number) => void
  onResetPoints: () => void
  actorName: string
  PointsBar: React.ComponentType<{ points: number }>
  monthLabel: (month: string) => string
}) {
  const [tab, setTab] = useState<DetailTab>("compensation")
  const breakdown = useMemo(
    () =>
      computeStaffCompensation({
        salary: member.salary,
        basicSalary: member.basic_salary,
        medicalAllowance: member.medical_allowance,
        medicalEnabled: member.medical_enabled,
        taxAmount: member.tax_amount,
        taxEnabled: member.tax_enabled,
        eobiAmount: member.eobi_amount,
        eobiEnabled: member.eobi_enabled,
        customAllowances: member.custom_allowances,
        customDeductions: member.custom_deductions,
      }),
    [member],
  )
  const allowances = normalizeStaffPayLines(member.custom_allowances)
  const deductions = normalizeStaffPayLines(member.custom_deductions)
  const currency = member.currency || "PKR"
  const busy = (key: string) => togglingKey === key

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[hsl(var(--border))] shrink-0 bg-gradient-to-r from-[#0f766e]/8 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-12 w-12 rounded-full shrink-0 overflow-hidden bg-[hsl(var(--muted))]/30 flex items-center justify-center border border-[hsl(var(--border))] cursor-pointer hover:ring-2 hover:ring-[#1a9f9a] transition-all"
              onClick={() => member.photo_url && onOpenPhoto()}
            >
              {member.photo_url ? (
                <img src={member.photo_url} alt={member.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                  {member.name
                    .split(" ")
                    .map(n => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-lg font-semibold text-[hsl(var(--foreground))] truncate">{member.name}</p>
                <Badge
                  variant={member.status === "active" ? "success" : "destructive"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {member.status}
                </Badge>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))] truncate">
                {member.role} · {member.department} · {member.employment_type || "Permanent"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-8 gap-2" onClick={onDownloadIdCard}>
              <IdCard className="h-4 w-4" /> ID Card
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="px-6 pt-3 border-b border-[hsl(var(--border))] shrink-0 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {TABS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  tab === item.id
                    ? "border-[#1a9f9a] text-[#0f766e] bg-[#1a9f9a]/5"
                    : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Employee</p>
                  <p className="text-base font-semibold mt-1">{member.name}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Role</p>
                  <p className="text-base font-semibold mt-1">{member.role}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Employment Type</p>
                  <p className="text-base font-semibold mt-1">{member.employment_type || "Permanent"}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Net Payable</p>
                  <p className="text-base font-semibold mt-1 text-[#0f766e]">{money(currency, breakdown.netPayable)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {member.email ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-4 py-3">
                    <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Email</p>
                      <p className="text-sm font-medium">{member.email}</p>
                    </div>
                  </div>
                ) : null}
                {member.phone ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-4 py-3">
                    <Phone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Phone</p>
                      <p className="text-sm font-medium">{member.phone}</p>
                    </div>
                  </div>
                ) : null}
                {member.address ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-4 py-3 sm:col-span-2">
                    <MapPin className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Address</p>
                      <p className="text-sm font-medium">{member.address}</p>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-4 py-3">
                  <Briefcase className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Join Date</p>
                    <p className="text-sm font-medium">
                      {member.join_date ? new Date(member.join_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {(member.bank_name || member.bank_account_number) && (
                <div className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Bank Details</p>
                  <p className="text-sm"><span className="text-[hsl(var(--muted-foreground))]">Bank:</span> {member.bank_name || "—"}</p>
                  <p className="text-sm"><span className="text-[hsl(var(--muted-foreground))]">Account:</span> {member.bank_account_number || "—"}</p>
                  <p className="text-sm"><span className="text-[hsl(var(--muted-foreground))]">Title:</span> {member.bank_account_title || "—"}</p>
                </div>
              )}

              {member.notes ? (
                <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{member.notes}</p>
                </div>
              ) : null}
            </>
          )}

          {tab === "compensation" && (
            <>
              <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                <div className="px-4 py-3 bg-[hsl(var(--muted))]/20 border-b border-[hsl(var(--border))] flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Employee Compensation</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      Toggle each line to include or exclude it from net payable
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8" onClick={onEdit}>
                    Edit amounts
                  </Button>
                </div>
                <div className="px-4 py-1">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                          <th className="py-2 pr-2 font-medium">Employee</th>
                          <th className="py-2 pr-2 font-medium">Role</th>
                          <th className="py-2 pr-2 font-medium">Employment Type</th>
                          <th className="py-2 pr-2 font-medium text-right">Contract Salary</th>
                          <th className="py-2 pr-2 font-medium text-right">Medical</th>
                          <th className="py-2 pr-2 font-medium text-right">Basic Salary</th>
                          <th className="py-2 pr-2 font-medium text-right">Tax</th>
                          <th className="py-2 pr-2 font-medium text-right">EOBI</th>
                          <th className="py-2 font-medium text-right">Net Payable</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="align-top">
                          <td className="py-3 pr-2 font-medium">{member.name}</td>
                          <td className="py-3 pr-2">{member.role}</td>
                          <td className="py-3 pr-2">{member.employment_type || "Permanent"}</td>
                          <td className="py-3 pr-2 text-right tabular-nums">{money(currency, breakdown.contractSalary)}</td>
                          <td className="py-3 pr-2 text-right tabular-nums">
                            <div className="flex flex-col items-end gap-1">
                              <span>{money(currency, breakdown.medicalAllowance)}</span>
                              <ToggleSwitch
                                checked={Boolean(member.medical_enabled)}
                                disabled={busy("medical") || breakdown.medicalAllowance <= 0}
                                title="Toggle medical allowance"
                                onChange={() => onToggleMedical(!member.medical_enabled)}
                              />
                            </div>
                          </td>
                          <td className="py-3 pr-2 text-right tabular-nums">{money(currency, breakdown.basicSalary)}</td>
                          <td className="py-3 pr-2 text-right tabular-nums">
                            <div className="flex flex-col items-end gap-1">
                              <span>{money(currency, breakdown.taxAmount)}</span>
                              <ToggleSwitch
                                checked={Boolean(member.tax_enabled)}
                                disabled={busy("tax") || breakdown.taxAmount <= 0}
                                title="Toggle tax deduction"
                                onChange={() => onToggleTax(!member.tax_enabled)}
                              />
                            </div>
                          </td>
                          <td className="py-3 pr-2 text-right tabular-nums">
                            <div className="flex flex-col items-end gap-1">
                              <span>{money(currency, breakdown.eobiAmount)}</span>
                              <ToggleSwitch
                                checked={Boolean(member.eobi_enabled)}
                                disabled={busy("eobi") || breakdown.eobiAmount <= 0}
                                title="Toggle EOBI deduction"
                                onChange={() => onToggleEobi(!member.eobi_enabled)}
                              />
                            </div>
                          </td>
                          <td className="py-3 text-right tabular-nums font-semibold text-[#0f766e]">
                            {money(currency, breakdown.netPayable)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <p className="text-sm font-semibold mb-2">Pay build-up</p>
                  <CompRow label="Contract Salary" value={money(currency, breakdown.contractSalary)} hint="Agreed package" />
                  <CompRow label="Basic Salary" value={money(currency, breakdown.basicSalary)} hint="Payable base for slips" tone="add" />
                  <CompRow
                    label="Medical Allowance"
                    value={
                      member.medical_enabled
                        ? `+ ${money(currency, breakdown.medicalApplied)}`
                        : `Off (${money(currency, breakdown.medicalAllowance)})`
                    }
                    tone={member.medical_enabled ? "add" : "neutral"}
                    toggle={
                      <ToggleSwitch
                        checked={Boolean(member.medical_enabled)}
                        disabled={busy("medical") || breakdown.medicalAllowance <= 0}
                        onChange={() => onToggleMedical(!member.medical_enabled)}
                      />
                    }
                  />
                  {allowances.map(line => (
                    <CompRow
                      key={line.id}
                      label={line.label}
                      value={line.enabled ? `+ ${money(currency, line.amount)}` : `Off (${money(currency, line.amount)})`}
                      tone={line.enabled ? "add" : "neutral"}
                      hint="Custom allowance"
                      toggle={
                        <ToggleSwitch
                          checked={line.enabled}
                          disabled={busy(`allowance:${line.id}`)}
                          onChange={() => onToggleCustomAllowance(line.id, !line.enabled)}
                        />
                      }
                    />
                  ))}
                  <CompRow label="Gross (after allowances)" value={money(currency, breakdown.grossPay)} tone="add" />
                </div>

                <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <p className="text-sm font-semibold mb-2">Deductions</p>
                  <CompRow
                    label="Tax"
                    value={
                      member.tax_enabled
                        ? `− ${money(currency, breakdown.taxApplied)}`
                        : `Off (${money(currency, breakdown.taxAmount)})`
                    }
                    tone={member.tax_enabled ? "deduct" : "neutral"}
                    toggle={
                      <ToggleSwitch
                        checked={Boolean(member.tax_enabled)}
                        disabled={busy("tax") || breakdown.taxAmount <= 0}
                        onChange={() => onToggleTax(!member.tax_enabled)}
                      />
                    }
                  />
                  <CompRow
                    label="EOBI Deduction"
                    value={
                      member.eobi_enabled
                        ? `− ${money(currency, breakdown.eobiApplied)}`
                        : `Off (${money(currency, breakdown.eobiAmount)})`
                    }
                    tone={member.eobi_enabled ? "deduct" : "neutral"}
                    toggle={
                      <ToggleSwitch
                        checked={Boolean(member.eobi_enabled)}
                        disabled={busy("eobi") || breakdown.eobiAmount <= 0}
                        onChange={() => onToggleEobi(!member.eobi_enabled)}
                      />
                    }
                  />
                  {deductions.map(line => (
                    <CompRow
                      key={line.id}
                      label={line.label}
                      value={line.enabled ? `− ${money(currency, line.amount)}` : `Off (${money(currency, line.amount)})`}
                      tone={line.enabled ? "deduct" : "neutral"}
                      hint="Custom deduction"
                      toggle={
                        <ToggleSwitch
                          checked={line.enabled}
                          disabled={busy(`deduction:${line.id}`)}
                          onChange={() => onToggleCustomDeduction(line.id, !line.enabled)}
                        />
                      }
                    />
                  ))}
                  <CompRow
                    label="Total deductions"
                    value={`− ${money(currency, breakdown.totalDeductions)}`}
                    tone="deduct"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex items-start gap-3">
                  <Banknote className="h-5 w-5 text-emerald-700 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-900">Salary after all taxes, deductions & allowances</p>
                    <p className="text-xs text-emerald-800/80 mt-1">
                      Basic + medical + custom allowances − tax − EOBI − custom deductions
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-emerald-900 mt-2">
                      {money(currency, breakdown.netPayable)}
                    </p>
                    <p className="text-[11px] text-emerald-800 mt-1">
                      Gross {money(currency, breakdown.grossPay)} · Deductions {money(currency, breakdown.totalDeductions)}
                    </p>
                  </div>
                </div>
              </div>

              {(allowances.length === 0 && deductions.length === 0) && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Tip: use Edit to add custom allowances (added to salary) and custom deductions.
                </p>
              )}
            </>
          )}

          {tab === "payroll" && (
            <>
              <div className="flex flex-wrap gap-2">
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-2 border-amber-300 text-amber-800 hover:bg-amber-50"
                    onClick={onOpenAdvance}
                  >
                    <Wallet className="h-4 w-4" /> Advance
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-9 gap-2" onClick={onGenerateSlip}>
                  <Download className="h-4 w-4" /> Generate salary slip
                </Button>
                <Button size="sm" variant="outline" className="h-9 gap-2" onClick={onOpenHistory}>
                  <FileText className="h-4 w-4" /> Payment history
                </Button>
              </div>

              {outstandingAdvance > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                  Outstanding advance: {money(currency, outstandingAdvance)}
                </div>
              )}

              <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                <p className="text-sm font-semibold mb-3">This month profile (before slip adjustments)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Basic</p>
                    <p className="font-semibold tabular-nums">{money(currency, breakdown.basicSalary)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Allowances</p>
                    <p className="font-semibold tabular-nums text-emerald-700">
                      + {money(currency, breakdown.medicalApplied + breakdown.customAllowancesTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Deductions</p>
                    <p className="font-semibold tabular-nums text-rose-600">
                      − {money(currency, breakdown.totalDeductions)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Net payable</p>
                    <p className="font-semibold tabular-nums text-[#0f766e]">{money(currency, breakdown.netPayable)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                <p className="text-sm font-semibold mb-3">Recent paid slips</p>
                {salarySlips.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No paid history yet.</p>
                ) : (
                  <div className="space-y-2">
                    {salarySlips.slice(0, 8).map((slip: any) => (
                      <div
                        key={slip.id}
                        className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm"
                      >
                        <span>{monthLabel(slip.month)}</span>
                        <span className="font-semibold text-emerald-700">
                          {slip.currency} {Number(slip.netSalary || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "performance" && (
            <>
              <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                    Performance Points
                  </p>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      (member.points || 100) <= 20
                        ? "bg-red-100 text-red-700"
                        : (member.points || 100) <= 50
                          ? "bg-orange-100 text-orange-700"
                          : (member.points || 100) <= 70
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {(member.points || 100)} / 100
                  </span>
                </div>
                <PointsBar points={member.points || 100} />
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-[hsl(var(--border))]">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Last reset: {member.last_reset ? new Date(member.last_reset).toLocaleDateString() : "N/A"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdatePoints(-5)}
                      disabled={(member.points || 100) <= 0}
                      className="h-8 px-3 rounded-lg border border-[hsl(var(--border))] text-sm disabled:opacity-40"
                    >
                      −5
                    </button>
                    <button
                      onClick={() => onUpdatePoints(5)}
                      disabled={(member.points || 100) >= 100}
                      className="h-8 px-3 rounded-lg border border-[hsl(var(--border))] text-sm disabled:opacity-40"
                    >
                      +5
                    </button>
                    <button
                      onClick={onResetPoints}
                      className="h-8 px-3 rounded-lg border border-[hsl(var(--border))] text-sm"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              <StaffKpiSection
                staffId={member.id}
                staffName={member.name}
                isAdmin={isAdmin}
                actorName={actorName}
              />

              {member.warnings?.length > 0 && (
                <div className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-2">
                  <p className="text-sm font-semibold">Warnings</p>
                  {member.warnings.map((w, i) => (
                    <div key={i} className="text-sm rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                      <p className="font-medium">Level {w.level}</p>
                      <p className="text-[hsl(var(--muted-foreground))]">{w.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "documents" && (
            <div className="rounded-xl border border-[hsl(var(--border))] p-4">
              <p className="text-sm font-semibold mb-3">Documents</p>
              {member.documents?.length ? (
                <div className="space-y-2">
                  {member.documents.map((doc, i) => (
                    <a
                      key={i}
                      href={doc.data}
                      download={doc.name}
                      className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]/20"
                    >
                      <span className="truncate">{doc.name}</span>
                      <Download className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No documents uploaded. Add them in Edit.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
