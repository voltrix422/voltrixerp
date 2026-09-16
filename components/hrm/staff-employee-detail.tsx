"use client"

import { Button } from "@/components/ui/button"
import { StaffKpiSection } from "@/components/hrm/staff-kpi-section"
import {
  computeStaffCompensation,
  normalizeStaffPayLines,
  type StaffPayLine,
} from "@/lib/hrm-salary-calc"
import { Download, X } from "lucide-react"
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
      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer border border-[hsl(var(--border))] disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? "bg-[hsl(var(--foreground))]" : "bg-transparent"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 translate-y-px bg-[hsl(var(--card))] border border-[hsl(var(--border))] transition ${
          checked ? "translate-x-[18px]" : "translate-x-px"
        }`}
      />
    </button>
  )
}

function CompRow({
  label,
  value,
  hint,
  toggle,
}: {
  label: string
  value: string
  hint?: string
  toggle?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[hsl(var(--border))] last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[hsl(var(--foreground))]">{label}</p>
        {hint ? <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{hint}</p> : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs tabular-nums">{value}</span>
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
  const [tab, setTab] = useState<DetailTab>("overview")
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{member.name}</p>
              <span className="text-[11px] capitalize text-[hsl(var(--muted-foreground))]">{member.status}</span>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
              {member.role} Â· {member.department} Â· {member.employment_type || "Permanent"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={onDownloadIdCard}>
              ID Card
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[hsl(var(--muted-foreground))]"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <nav className="flex items-center gap-0 border-b border-[hsl(var(--border))] shrink-0 overflow-x-auto px-2">
          {TABS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`shrink-0 px-3 py-2 text-xs font-medium border-b-2 -mb-px cursor-pointer ${
                tab === item.id
                  ? "border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="overflow-y-auto p-4 space-y-4">
          {tab === "overview" && (
            <table className="w-full text-xs border-collapse border border-[hsl(var(--border))]">
              <tbody>
                {[
                  ["Employee", member.name],
                  ["Role", member.role],
                  ["Department", member.department],
                  ["Employment Type", member.employment_type || "Permanent"],
                  ["Status", member.status],
                  ["Net Payable", money(currency, breakdown.netPayable)],
                  ["Email", member.email || "â€”"],
                  ["Phone", member.phone || "â€”"],
                  ["Address", member.address || "â€”"],
                  ["Join Date", member.join_date ? new Date(member.join_date).toLocaleDateString() : "â€”"],
                  ...(member.bank_name || member.bank_account_number
                    ? [
                        ["Bank", member.bank_name || "â€”"],
                        ["Account", member.bank_account_number || "â€”"],
                        ["Account title", member.bank_account_title || "â€”"],
                      ]
                    : []),
                  ...(member.notes ? [["Notes", member.notes]] : []),
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-[hsl(var(--border))] last:border-b-0">
                    <td className="px-2 py-1.5 w-40 text-[hsl(var(--muted-foreground))] align-top">{label}</td>
                    <td className="px-2 py-1.5 whitespace-pre-wrap">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "compensation" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Compensation</p>
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={onEdit}>
                  Edit amounts
                </Button>
              </div>
              <div className="overflow-x-auto border border-[hsl(var(--border))]">
                <table className="w-full text-xs min-w-[640px] border-collapse">
                  <thead>
                    <tr className="text-left border-b border-[hsl(var(--border))]">
                      <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Employee</th>
                      <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Role</th>
                      <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Type</th>
                      <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))] text-right">Contract</th>
                      <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))] text-right">Medical</th>
                      <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))] text-right">Basic</th>
                      <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))] text-right">Tax</th>
                      <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))] text-right">EOBI</th>
                      <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))] text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      <td className="px-2 py-2">{member.name}</td>
                      <td className="px-2 py-2">{member.role}</td>
                      <td className="px-2 py-2">{member.employment_type || "Permanent"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{money(currency, breakdown.contractSalary)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
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
                      <td className="px-2 py-2 text-right tabular-nums">{money(currency, breakdown.basicSalary)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
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
                      <td className="px-2 py-2 text-right tabular-nums">
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
                      <td className="px-2 py-2 text-right tabular-nums font-medium">
                        {money(currency, breakdown.netPayable)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="border border-[hsl(var(--border))] p-3">
                  <p className="text-xs font-semibold mb-1">Pay build-up</p>
                  <CompRow label="Contract Salary" value={money(currency, breakdown.contractSalary)} hint="Agreed package" />
                  <CompRow label="Basic Salary" value={money(currency, breakdown.basicSalary)} hint="Payable base for slips" />
                  <CompRow
                    label="Medical Allowance"
                    value={
                      member.medical_enabled
                        ? `+ ${money(currency, breakdown.medicalApplied)}`
                        : `Off (${money(currency, breakdown.medicalAllowance)})`
                    }
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
                  <CompRow label="Gross (after allowances)" value={money(currency, breakdown.grossPay)} />
                </div>

                <div className="border border-[hsl(var(--border))] p-3">
                  <p className="text-xs font-semibold mb-1">Deductions</p>
                  <CompRow
                    label="Tax"
                    value={
                      member.tax_enabled
                        ? `âˆ’ ${money(currency, breakdown.taxApplied)}`
                        : `Off (${money(currency, breakdown.taxAmount)})`
                    }
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
                        ? `âˆ’ ${money(currency, breakdown.eobiApplied)}`
                        : `Off (${money(currency, breakdown.eobiAmount)})`
                    }
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
                      value={line.enabled ? `âˆ’ ${money(currency, line.amount)}` : `Off (${money(currency, line.amount)})`}
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
                    value={`âˆ’ ${money(currency, breakdown.totalDeductions)}`}
                  />
                </div>
              </div>

              <div className="border border-[hsl(var(--border))] px-3 py-2 text-xs">
                <span className="text-[hsl(var(--muted-foreground))]">Net payable </span>
                <span className="tabular-nums font-medium">{money(currency, breakdown.netPayable)}</span>
                <span className="text-[hsl(var(--muted-foreground))]">
                  {" "}Â· Gross {money(currency, breakdown.grossPay)} Â· Deductions {money(currency, breakdown.totalDeductions)}
                </span>
              </div>
            </>
          )}

          {tab === "payroll" && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {isAdmin && (
                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={onOpenAdvance}>
                    Advance
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={onGenerateSlip}>
                  Generate salary slip
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={onOpenHistory}>
                  Payment history
                </Button>
              </div>

              {outstandingAdvance > 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Outstanding advance: {money(currency, outstandingAdvance)}
                </p>
              )}

              <table className="w-full text-xs border-collapse border border-[hsl(var(--border))]">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))] text-left">
                    <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Item</th>
                    <th className="px-2 py-1.5 font-medium text-[10px] uppercase text-[hsl(var(--muted-foreground))] text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <td className="px-2 py-1.5">Basic</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{money(currency, breakdown.basicSalary)}</td>
                  </tr>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <td className="px-2 py-1.5">Allowances</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      + {money(currency, breakdown.medicalApplied + breakdown.customAllowancesTotal)}
                    </td>
                  </tr>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <td className="px-2 py-1.5">Deductions</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      âˆ’ {money(currency, breakdown.totalDeductions)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-medium">Net payable</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">{money(currency, breakdown.netPayable)}</td>
                  </tr>
                </tbody>
              </table>

              <div>
                <p className="text-xs font-semibold mb-1">Recent paid slips</p>
                {salarySlips.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No paid history yet.</p>
                ) : (
                  <table className="w-full text-xs border-collapse border border-[hsl(var(--border))]">
                    <tbody>
                      {salarySlips.slice(0, 8).map((slip: any) => (
                        <tr key={slip.id} className="border-b border-[hsl(var(--border))] last:border-b-0">
                          <td className="px-2 py-1.5">{monthLabel(slip.month)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {slip.currency} {Number(slip.netSalary || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {tab === "performance" && (
            <>
              <div className="border border-[hsl(var(--border))] p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold">Performance points</p>
                  <span className="text-xs tabular-nums">{member.points || 100} / 100</span>
                </div>
                <PointsBar points={member.points || 100} />
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[hsl(var(--border))]">
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    Last reset: {member.last_reset ? new Date(member.last_reset).toLocaleDateString() : "N/A"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onUpdatePoints(-5)}
                      disabled={(member.points || 100) <= 0}
                      className="h-7 px-2 border border-[hsl(var(--border))] text-[11px] disabled:opacity-40 cursor-pointer"
                    >
                      âˆ’5
                    </button>
                    <button
                      onClick={() => onUpdatePoints(5)}
                      disabled={(member.points || 100) >= 100}
                      className="h-7 px-2 border border-[hsl(var(--border))] text-[11px] disabled:opacity-40 cursor-pointer"
                    >
                      +5
                    </button>
                    <button
                      onClick={onResetPoints}
                      className="h-7 px-2 border border-[hsl(var(--border))] text-[11px] cursor-pointer"
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
                <div className="border border-[hsl(var(--border))] p-3 space-y-2">
                  <p className="text-xs font-semibold">Warnings</p>
                  {member.warnings.map((w, i) => (
                    <div key={i} className="text-xs border border-[hsl(var(--border))] px-2 py-1.5">
                      <p className="font-medium">Level {w.level}</p>
                      <p className="text-[hsl(var(--muted-foreground))]">{w.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "documents" && (
            <div className="border border-[hsl(var(--border))]">
              {member.documents?.length ? (
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {member.documents.map((doc, i) => (
                      <tr key={i} className="border-b border-[hsl(var(--border))] last:border-b-0">
                        <td className="px-2 py-1.5">
                          <a href={doc.data} download={doc.name} className="hover:underline">
                            {doc.name}
                          </a>
                        </td>
                        <td className="px-2 py-1.5 text-right w-8">
                          <Download className="h-3.5 w-3.5 inline text-[hsl(var(--muted-foreground))]" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-3 text-xs text-[hsl(var(--muted-foreground))]">No documents. Add them in Edit.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
