"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  computeStaffCompensation,
  formatMoneyAmount,
  type StaffPayLine,
} from "@/lib/hrm-salary-calc"
import { FileText, Upload, X } from "lucide-react"
import { useMemo, useState, type RefObject } from "react"

type FormTab = "profile" | "compensation" | "details"

const TABS: { id: FormTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "compensation", label: "Compensation" },
  { id: "details", label: "Bank & Documents" },
]

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
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

const inputClass =
  "w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"

export function StaffEditModal({
  editing,
  saving,
  departments,
  employmentTypes,
  currencies,
  name,
  setName,
  role,
  setRole,
  department,
  setDepartment,
  email,
  setEmail,
  phone,
  setPhone,
  address,
  setAddress,
  salary,
  setSalary,
  basicSalary,
  setBasicSalary,
  employmentType,
  setEmploymentType,
  medicalAllowance,
  setMedicalAllowance,
  medicalEnabled,
  setMedicalEnabled,
  taxAmount,
  setTaxAmount,
  taxEnabled,
  setTaxEnabled,
  eobiAmount,
  setEobiAmount,
  eobiEnabled,
  setEobiEnabled,
  customAllowances,
  setCustomAllowances,
  customDeductions,
  setCustomDeductions,
  currency,
  setCurrency,
  joinDate,
  setJoinDate,
  status,
  setStatus,
  notes,
  setNotes,
  bankName,
  setBankName,
  bankAccountNumber,
  setBankAccountNumber,
  bankAccountTitle,
  setBankAccountTitle,
  photoPreview,
  fileRef,
  onFileChange,
  documents,
  newDocName,
  setNewDocName,
  docFileRef,
  onDocFileChange,
  onPendingUpload,
  updateDocName,
  removeDoc,
  existingDocuments,
  onRemoveExistingDoc,
  onAddAllowance,
  onAddDeduction,
  onSubmit,
  onClose,
}: {
  editing: boolean
  saving: boolean
  departments: string[]
  employmentTypes: string[]
  currencies: string[]
  name: string
  setName: (v: string) => void
  role: string
  setRole: (v: string) => void
  department: string
  setDepartment: (v: string) => void
  email: string
  setEmail: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  address: string
  setAddress: (v: string) => void
  salary: string
  setSalary: (v: string) => void
  basicSalary: string
  setBasicSalary: (v: string) => void
  employmentType: string
  setEmploymentType: (v: string) => void
  medicalAllowance: string
  setMedicalAllowance: (v: string) => void
  medicalEnabled: boolean
  setMedicalEnabled: (v: boolean | ((p: boolean) => boolean)) => void
  taxAmount: string
  setTaxAmount: (v: string) => void
  taxEnabled: boolean
  setTaxEnabled: (v: boolean | ((p: boolean) => boolean)) => void
  eobiAmount: string
  setEobiAmount: (v: string) => void
  eobiEnabled: boolean
  setEobiEnabled: (v: boolean | ((p: boolean) => boolean)) => void
  customAllowances: StaffPayLine[]
  setCustomAllowances: React.Dispatch<React.SetStateAction<StaffPayLine[]>>
  customDeductions: StaffPayLine[]
  setCustomDeductions: React.Dispatch<React.SetStateAction<StaffPayLine[]>>
  currency: string
  setCurrency: (v: string) => void
  joinDate: string
  setJoinDate: (v: string) => void
  status: "active" | "inactive"
  setStatus: (v: "active" | "inactive") => void
  notes: string
  setNotes: (v: string) => void
  bankName: string
  setBankName: (v: string) => void
  bankAccountNumber: string
  setBankAccountNumber: (v: string) => void
  bankAccountTitle: string
  setBankAccountTitle: (v: string) => void
  photoPreview: string
  fileRef: RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  documents: { file: File; name: string }[]
  newDocName: string
  setNewDocName: (v: string) => void
  docFileRef: RefObject<HTMLInputElement | null>
  onDocFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPendingUpload: () => void
  updateDocName: (index: number, name: string) => void
  removeDoc: (index: number) => void
  existingDocuments: { name: string; data: string; type: string; size: number }[]
  onRemoveExistingDoc: (index: number) => void
  onAddAllowance: () => void
  onAddDeduction: () => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<FormTab>("compensation")
  const breakdown = useMemo(
    () =>
      computeStaffCompensation({
        salary: parseFloat(salary) || 0,
        basicSalary: parseFloat(basicSalary) || 0,
        medicalAllowance: parseFloat(medicalAllowance) || 0,
        medicalEnabled,
        taxAmount: parseFloat(taxAmount) || 0,
        taxEnabled,
        eobiAmount: parseFloat(eobiAmount) || 0,
        eobiEnabled,
        customAllowances,
        customDeductions,
      }),
    [
      salary,
      basicSalary,
      medicalAllowance,
      medicalEnabled,
      taxAmount,
      taxEnabled,
      eobiAmount,
      eobiEnabled,
      customAllowances,
      customDeductions,
    ],
  )
  const money = (n: number) => formatMoneyAmount(currency || "PKR", n)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[94vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[hsl(var(--border))] shrink-0 bg-gradient-to-r from-[#0f766e]/8 to-transparent">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
              {editing ? "Edit Staff Member" : "New Staff Member"}
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] truncate">
              {(name || "Employee").trim()}
              {role ? ` · ${role}` : ""}
              {department ? ` · ${department}` : ""}
              {` · ${employmentType || "Permanent"}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status === "active" ? (
              <Badge variant="success" className="text-[10px]">active</Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]">inactive</Badge>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
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
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
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

        <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto p-6 space-y-5 flex-1">
            {tab === "profile" && (
              <>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="h-20 w-20 rounded-full border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center cursor-pointer hover:border-[#1a9f9a] overflow-hidden shrink-0 transition-colors bg-[hsl(var(--muted))]/10"
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="photo" className="h-full w-full object-cover" />
                    ) : (
                      <Upload className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Photo</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Click circle to upload</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                    <label className="text-sm font-medium">Full Name *</label>
                    <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Ahmed Khan" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Job Title *</label>
                    <input value={role} onChange={e => setRole(e.target.value)} required placeholder="e.g. Sales" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Department</label>
                    <select value={department} onChange={e => setDepartment(e.target.value)} className={inputClass}>
                      {departments.map(d => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Employment Type</label>
                    <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className={inputClass}>
                      {employmentTypes.map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@company.com" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92 300 0000000" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value as "active" | "inactive")} className={inputClass}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Join Date</label>
                    <input value={joinDate} onChange={e => setJoinDate(e.target.value)} type="date" className={inputClass} />
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                    <label className="text-sm font-medium">Address</label>
                    <input value={address} onChange={e => setAddress(e.target.value)} placeholder="City, Country" className={inputClass} />
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Any additional info..."
                      className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] resize-none"
                    />
                  </div>
                </div>
              </>
            )}

            {tab === "compensation" && (
              <>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Salary after all taxes, deductions & allowances</p>
                    <p className="text-xs text-emerald-800/80 mt-1">
                      Basic + medical + custom allowances − tax − EOBI − custom deductions
                    </p>
                    <p className="text-[11px] text-emerald-800 mt-1">
                      Gross {money(breakdown.grossPay)} · Deductions {money(breakdown.totalDeductions)}
                    </p>
                  </div>
                  <p className="text-3xl font-bold tabular-nums text-emerald-900">{money(breakdown.netPayable)}</p>
                </div>

                <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                  <div className="px-4 py-3 bg-[hsl(var(--muted))]/20 border-b border-[hsl(var(--border))]">
                    <p className="text-sm font-semibold">Employee Compensation</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      Edit amounts below — toggles control what is included in net payable
                    </p>
                  </div>
                  <div className="overflow-x-auto px-4 py-2">
                    <table className="w-full text-sm min-w-[900px]">
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
                          <td className="py-3 pr-2 font-medium">{name || "—"}</td>
                          <td className="py-3 pr-2">{role || "—"}</td>
                          <td className="py-3 pr-2">{employmentType}</td>
                          <td className="py-3 pr-2 text-right tabular-nums">{money(breakdown.contractSalary)}</td>
                          <td className="py-3 pr-2 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums">{money(breakdown.medicalAllowance)}</span>
                              <Toggle checked={medicalEnabled} onChange={() => setMedicalEnabled(v => !v)} />
                            </div>
                          </td>
                          <td className="py-3 pr-2 text-right tabular-nums">{money(breakdown.basicSalary)}</td>
                          <td className="py-3 pr-2 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums">{money(breakdown.taxAmount)}</span>
                              <Toggle checked={taxEnabled} onChange={() => setTaxEnabled(v => !v)} />
                            </div>
                          </td>
                          <td className="py-3 pr-2 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums">{money(breakdown.eobiAmount)}</span>
                              <Toggle checked={eobiEnabled} onChange={() => setEobiEnabled(v => !v)} />
                            </div>
                          </td>
                          <td className="py-3 text-right tabular-nums font-semibold text-[#0f766e]">
                            {money(breakdown.netPayable)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-3">
                    <p className="text-sm font-semibold">Pay build-up</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-[hsl(var(--muted-foreground))]">Contract Salary</label>
                        <input value={salary} onChange={e => setSalary(e.target.value)} type="number" min="0" placeholder="0" className={inputClass} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[hsl(var(--muted-foreground))]">Basic Salary</label>
                        <input value={basicSalary} onChange={e => setBasicSalary(e.target.value)} type="number" min="0" placeholder="0 = use contract" className={inputClass} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[hsl(var(--muted-foreground))]">Currency</label>
                        <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputClass}>
                          {currencies.map(c => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[hsl(var(--muted-foreground))]">Medical Allowance</label>
                          <Toggle checked={medicalEnabled} onChange={() => setMedicalEnabled(v => !v)} />
                        </div>
                        <input value={medicalAllowance} onChange={e => setMedicalAllowance(e.target.value)} type="number" min="0" placeholder="0" className={inputClass} />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[hsl(var(--border))] space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Custom allowances</p>
                        <Button type="button" size="sm" variant="outline" className="h-8" onClick={onAddAllowance}>
                          + Add
                        </Button>
                      </div>
                      {customAllowances.map((line, idx) => (
                        <div key={line.id} className="grid grid-cols-[1fr_110px_auto_auto] gap-2 items-center">
                          <input
                            value={line.label}
                            onChange={e =>
                              setCustomAllowances(prev =>
                                prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l)),
                              )
                            }
                            placeholder="Label"
                            className="h-9 rounded-lg border border-[hsl(var(--border))] px-3 text-sm"
                          />
                          <input
                            type="number"
                            min="0"
                            value={line.amount || ""}
                            onChange={e =>
                              setCustomAllowances(prev =>
                                prev.map((l, i) =>
                                  i === idx ? { ...l, amount: parseFloat(e.target.value) || 0 } : l,
                                ),
                              )
                            }
                            className="h-9 rounded-lg border border-[hsl(var(--border))] px-3 text-sm"
                          />
                          <Toggle
                            checked={line.enabled}
                            onChange={() =>
                              setCustomAllowances(prev =>
                                prev.map((l, i) => (i === idx ? { ...l, enabled: !l.enabled } : l)),
                              )
                            }
                          />
                          <button
                            type="button"
                            className="text-xs text-rose-600"
                            onClick={() => setCustomAllowances(prev => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm pt-1">
                        <span className="text-[hsl(var(--muted-foreground))]">Gross (after allowances)</span>
                        <span className="font-semibold text-emerald-700 tabular-nums">{money(breakdown.grossPay)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-3">
                    <p className="text-sm font-semibold">Deductions</p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[hsl(var(--muted-foreground))]">Tax deduction</label>
                          <Toggle checked={taxEnabled} onChange={() => setTaxEnabled(v => !v)} />
                        </div>
                        <input value={taxAmount} onChange={e => setTaxAmount(e.target.value)} type="number" min="0" placeholder="0" className={inputClass} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[hsl(var(--muted-foreground))]">EOBI deduction</label>
                          <Toggle checked={eobiEnabled} onChange={() => setEobiEnabled(v => !v)} />
                        </div>
                        <input value={eobiAmount} onChange={e => setEobiAmount(e.target.value)} type="number" min="0" placeholder="0" className={inputClass} />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[hsl(var(--border))] space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Custom deductions</p>
                        <Button type="button" size="sm" variant="outline" className="h-8" onClick={onAddDeduction}>
                          + Add
                        </Button>
                      </div>
                      {customDeductions.map((line, idx) => (
                        <div key={line.id} className="grid grid-cols-[1fr_110px_auto_auto] gap-2 items-center">
                          <input
                            value={line.label}
                            onChange={e =>
                              setCustomDeductions(prev =>
                                prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l)),
                              )
                            }
                            placeholder="Label"
                            className="h-9 rounded-lg border border-[hsl(var(--border))] px-3 text-sm"
                          />
                          <input
                            type="number"
                            min="0"
                            value={line.amount || ""}
                            onChange={e =>
                              setCustomDeductions(prev =>
                                prev.map((l, i) =>
                                  i === idx ? { ...l, amount: parseFloat(e.target.value) || 0 } : l,
                                ),
                              )
                            }
                            className="h-9 rounded-lg border border-[hsl(var(--border))] px-3 text-sm"
                          />
                          <Toggle
                            checked={line.enabled}
                            onChange={() =>
                              setCustomDeductions(prev =>
                                prev.map((l, i) => (i === idx ? { ...l, enabled: !l.enabled } : l)),
                              )
                            }
                          />
                          <button
                            type="button"
                            className="text-xs text-rose-600"
                            onClick={() => setCustomDeductions(prev => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm pt-1">
                        <span className="text-[hsl(var(--muted-foreground))]">Total deductions</span>
                        <span className="font-semibold text-rose-600 tabular-nums">− {money(breakdown.totalDeductions)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === "details" && (
              <>
                <div className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-4">
                  <p className="text-sm font-semibold">Bank Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Bank Name</label>
                      <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Meezan Bank" className={inputClass} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Account Number</label>
                      <input value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} placeholder="e.g. 1234567890" className={inputClass} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium">Account Title</label>
                      <input value={bankAccountTitle} onChange={e => setBankAccountTitle(e.target.value)} placeholder="e.g. Muhammad Ahmed Khan" className={inputClass} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-3">
                  <label className="text-sm font-semibold">Documents</label>
                  <input ref={docFileRef} type="file" className="hidden" onChange={onDocFileChange} />
                  {existingDocuments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide font-medium">Existing Documents</p>
                      {existingDocuments.map((doc, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-4 py-3">
                          <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                          <span className="flex-1 min-w-0 text-sm truncate">{doc.name}</span>
                          <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{(doc.size / 1024).toFixed(0)}KB</span>
                          <button type="button" onClick={() => onRemoveExistingDoc(i)} className="text-red-400 hover:text-red-600 shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {documents.map((doc, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-4 py-3">
                      <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                      <input
                        value={doc.name}
                        onChange={e => updateDocName(i, e.target.value)}
                        placeholder="Document name"
                        className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
                      />
                      <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{(doc.file.size / 1024).toFixed(0)}KB</span>
                      <button type="button" onClick={() => removeDoc(i)} className="text-red-400 hover:text-red-600 shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      value={newDocName}
                      onChange={e => setNewDocName(e.target.value)}
                      placeholder="Enter document name..."
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={onPendingUpload}
                      disabled={!newDocName.trim()}
                      className="h-10 px-4 rounded-lg bg-[#1a9f9a] text-white text-sm font-medium hover:bg-[#158a85] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0"
                    >
                      <Upload className="h-4 w-4" /> Upload
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-[hsl(var(--border))] shrink-0 bg-[hsl(var(--card))]">
            <Button type="button" variant="outline" className="h-10 px-6" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex-1" />
            {tab !== "profile" && (
              <Button type="button" variant="outline" className="h-10" onClick={() => setTab(tab === "details" ? "compensation" : "profile")}>
                Back
              </Button>
            )}
            {tab !== "details" && (
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setTab(tab === "profile" ? "compensation" : "details")}
              >
                Next
              </Button>
            )}
            <Button type="submit" className="h-10 px-8 bg-[#1a9f9a] hover:bg-[#158a85] text-white" disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Staff" : "Save Staff"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
