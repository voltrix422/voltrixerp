"use client"

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
      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer border border-[hsl(var(--border))] ${
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

const inputClass =
  "w-full h-7 border border-[hsl(var(--border))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none"
const labelClass = "text-[11px] text-[hsl(var(--muted-foreground))]"

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
  const [tab, setTab] = useState<FormTab>("profile")
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
              <p className="text-sm font-semibold truncate">
                {editing ? "Edit Staff" : "New Staff"}
              </p>
              <span className="text-[11px] capitalize text-[hsl(var(--muted-foreground))]">{status}</span>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
              {(name || "Employee").trim()}
              {role ? ` Â· ${role}` : ""}
              {department ? ` Â· ${department}` : ""}
              {` Â· ${employmentType || "Permanent"}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[hsl(var(--muted-foreground))]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
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

        <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto p-4 space-y-4 flex-1">
            {tab === "profile" && (
              <>
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="h-14 w-14 border border-dashed border-[hsl(var(--border))] flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="photo" className="h-full w-full object-cover" />
                    ) : (
                      <Upload className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">Photo</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Click to upload</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>Full Name *</label>
                    <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Ahmed Khan" className={inputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Job Title *</label>
                    <input value={role} onChange={e => setRole(e.target.value)} required placeholder="e.g. Sales" className={inputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Department</label>
                    <select value={department} onChange={e => setDepartment(e.target.value)} className={inputClass}>
                      {departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Employment Type</label>
                    <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className={inputClass}>
                      {employmentTypes.map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Email</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@company.com" className={inputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Phone</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92 300 0000000" className={inputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value as "active" | "inactive")} className={inputClass}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Join Date</label>
                    <input value={joinDate} onChange={e => setJoinDate(e.target.value)} type="date" className={inputClass} />
                  </div>
                  <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>Address</label>
                    <input value={address} onChange={e => setAddress(e.target.value)} placeholder="City, Country" className={inputClass} />
                  </div>
                  <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>Notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Any additional info..."
                      className="w-full border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-xs focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </>
            )}

            {tab === "compensation" && (
              <>
                <div className="flex items-baseline justify-between gap-3 border border-[hsl(var(--border))] px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">Net payable</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      Gross {money(breakdown.grossPay)} Â· Deductions {money(breakdown.totalDeductions)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{money(breakdown.netPayable)}</p>
                </div>

                <div className="border border-[hsl(var(--border))] overflow-hidden">
                  <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
                    <p className="text-xs font-semibold">Compensation</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      Toggles control what is included in net payable
                    </p>
                  </div>
                  <div className="overflow-x-auto px-3 py-1">
                    <table className="w-full text-xs min-w-[900px]">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
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
                          <td className="py-2 pr-2 font-medium">{name || "â€”"}</td>
                          <td className="py-2 pr-2">{role || "â€”"}</td>
                          <td className="py-2 pr-2">{employmentType}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{money(breakdown.contractSalary)}</td>
                          <td className="py-2 pr-2 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums">{money(breakdown.medicalAllowance)}</span>
                              <Toggle checked={medicalEnabled} onChange={() => setMedicalEnabled(v => !v)} />
                            </div>
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{money(breakdown.basicSalary)}</td>
                          <td className="py-2 pr-2 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums">{money(breakdown.taxAmount)}</span>
                              <Toggle checked={taxEnabled} onChange={() => setTaxEnabled(v => !v)} />
                            </div>
                          </td>
                          <td className="py-2 pr-2 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums">{money(breakdown.eobiAmount)}</span>
                              <Toggle checked={eobiEnabled} onChange={() => setEobiEnabled(v => !v)} />
                            </div>
                          </td>
                          <td className="py-2 text-right tabular-nums font-semibold">
                            {money(breakdown.netPayable)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="border border-[hsl(var(--border))] p-3 space-y-3">
                    <p className="text-xs font-semibold">Pay build-up</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className={labelClass}>Contract Salary</label>
                        <input value={salary} onChange={e => setSalary(e.target.value)} type="number" min="0" placeholder="0" className={inputClass} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelClass}>Basic Salary</label>
                        <input value={basicSalary} onChange={e => setBasicSalary(e.target.value)} type="number" min="0" placeholder="0 = use contract" className={inputClass} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelClass}>Currency</label>
                        <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputClass}>
                          {currencies.map(c => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className={labelClass}>Medical Allowance</label>
                          <Toggle checked={medicalEnabled} onChange={() => setMedicalEnabled(v => !v)} />
                        </div>
                        <input value={medicalAllowance} onChange={e => setMedicalAllowance(e.target.value)} type="number" min="0" placeholder="0" className={inputClass} />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[hsl(var(--border))] space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium">Custom allowances</p>
                        <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={onAddAllowance}>
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
                            className={inputClass}
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
                            className={inputClass}
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
                            className="text-[11px] text-[hsl(var(--muted-foreground))] cursor-pointer"
                            onClick={() => setCustomAllowances(prev => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-[hsl(var(--muted-foreground))]">Gross (after allowances)</span>
                        <span className="font-medium tabular-nums">{money(breakdown.grossPay)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-[hsl(var(--border))] p-3 space-y-3">
                    <p className="text-xs font-semibold">Deductions</p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className={labelClass}>Tax deduction</label>
                          <Toggle checked={taxEnabled} onChange={() => setTaxEnabled(v => !v)} />
                        </div>
                        <input value={taxAmount} onChange={e => setTaxAmount(e.target.value)} type="number" min="0" placeholder="0" className={inputClass} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className={labelClass}>EOBI deduction</label>
                          <Toggle checked={eobiEnabled} onChange={() => setEobiEnabled(v => !v)} />
                        </div>
                        <input value={eobiAmount} onChange={e => setEobiAmount(e.target.value)} type="number" min="0" placeholder="0" className={inputClass} />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[hsl(var(--border))] space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium">Custom deductions</p>
                        <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={onAddDeduction}>
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
                            className={inputClass}
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
                            className={inputClass}
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
                            className="text-[11px] text-[hsl(var(--muted-foreground))] cursor-pointer"
                            onClick={() => setCustomDeductions(prev => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-[hsl(var(--muted-foreground))]">Total deductions</span>
                        <span className="font-medium tabular-nums">âˆ’ {money(breakdown.totalDeductions)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === "details" && (
              <>
                <div className="border border-[hsl(var(--border))] p-3 space-y-3">
                  <p className="text-xs font-semibold">Bank Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={labelClass}>Bank Name</label>
                      <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Meezan Bank" className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Account Number</label>
                      <input value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} placeholder="e.g. 1234567890" className={inputClass} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className={labelClass}>Account Title</label>
                      <input value={bankAccountTitle} onChange={e => setBankAccountTitle(e.target.value)} placeholder="e.g. Muhammad Ahmed Khan" className={inputClass} />
                    </div>
                  </div>
                </div>

                <div className="border border-[hsl(var(--border))] p-3 space-y-2">
                  <label className="text-xs font-semibold">Documents</label>
                  <input ref={docFileRef} type="file" className="hidden" onChange={onDocFileChange} />
                  {existingDocuments.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Existing</p>
                      {existingDocuments.map((doc, i) => (
                        <div key={i} className="flex items-center gap-2 border border-[hsl(var(--border))] px-2 py-1.5">
                          <FileText className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                          <span className="flex-1 min-w-0 text-xs truncate">{doc.name}</span>
                          <span className="text-[11px] text-[hsl(var(--muted-foreground))] shrink-0">{(doc.size / 1024).toFixed(0)}KB</span>
                          <button type="button" onClick={() => onRemoveExistingDoc(i)} className="text-[hsl(var(--muted-foreground))] shrink-0 cursor-pointer">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {documents.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 border border-[hsl(var(--border))] px-2 py-1.5">
                      <FileText className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                      <input
                        value={doc.name}
                        onChange={e => updateDocName(i, e.target.value)}
                        placeholder="Document name"
                        className="flex-1 min-w-0 bg-transparent text-xs focus:outline-none"
                      />
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))] shrink-0">{(doc.file.size / 1024).toFixed(0)}KB</span>
                      <button type="button" onClick={() => removeDoc(i)} className="text-[hsl(var(--muted-foreground))] shrink-0 cursor-pointer">
                        <X className="h-3.5 w-3.5" />
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onPendingUpload}
                      disabled={!newDocName.trim()}
                      className="h-7 px-2.5 text-[11px] gap-1 shrink-0"
                    >
                      <Upload className="h-3 w-3" /> Upload
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 px-4 py-3 border-t border-[hsl(var(--border))] shrink-0">
            <Button type="button" variant="outline" className="h-7 px-3 text-[11px]" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex-1" />
            {tab !== "profile" && (
              <Button type="button" variant="outline" className="h-7 px-3 text-[11px]" onClick={() => setTab(tab === "details" ? "compensation" : "profile")}>
                Back
              </Button>
            )}
            {tab !== "details" && (
              <Button
                type="button"
                variant="outline"
                className="h-7 px-3 text-[11px]"
                onClick={() => setTab(tab === "profile" ? "compensation" : "details")}
              >
                Next
              </Button>
            )}
            <Button type="submit" variant="outline" className="h-7 px-3 text-[11px]" disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
