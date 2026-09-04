"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Save, CheckCircle2, Copy, Download, Paperclip, Loader2, Eye, Trash2 } from "lucide-react"
import {
  amountFromSalaryAdjustments,
  computeBatchSalaryFigures,
  monthDateBounds,
  normalizeStaffPayLines,
  periodStartForJoinDate,
  type StaffPayLine,
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
import { uploadFiles } from "@/lib/upload"

export type MakeSalariesStaff = {
  id: string
  name: string
  role: string
  department: string
  salary: number
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
  bank_name?: string
  bank_account_number?: string
  bank_account_title?: string
}

export type SalaryPaymentAttachment = {
  url: string
  name: string
  note: string
  uploadedAt: string
}

type SalaryRow = {
  staffId: string
  staffName: string
  role: string
  department: string
  currency: string
  monthlySalary: number
  basicSalary: number
  medicalAllowance: number
  medicalEnabled: boolean
  taxAmount: number
  taxEnabled: boolean
  eobiAmount: number
  eobiEnabled: boolean
  customAllowances: StaffPayLine[]
  customDeductions: StaffPayLine[]
  incentive: number
  commission: number
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
  paidAt?: string | null
  paidBy?: string | null
  paymentNotes?: string | null
  paymentAttachments?: SalaryPaymentAttachment[] | unknown
}

type PendingAttachment = {
  id: string
  file: File
  note: string
}

type ProofEditItem = SalaryPaymentAttachment & {
  key: string
  replaceFile: File | null
  previewUrl: string | null
}

function normalizePaymentAttachments(raw: unknown): SalaryPaymentAttachment[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      const url = String(row.url || "").trim()
      if (!url) return null
      return {
        url,
        name: String(row.name || "attachment"),
        note: String(row.note || ""),
        uploadedAt: String(row.uploadedAt || ""),
      }
    })
    .filter((x): x is SalaryPaymentAttachment => !!x)
}

function findSlipForStaff(existing: ExistingSlip[], staffId: string, staffName: string, month: string) {
  const monthSlips = existing.filter((s) => s.month === month)
  return (
    monthSlips.find((slip) => slip.staffLocalId === staffId) ||
    monthSlips.find(
      (slip) => String(slip.staffName || "").trim().toLowerCase() === staffName.trim().toLowerCase(),
    ) ||
    null
  )
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
      const saved = findSlipForStaff(existing, s.id, s.name, month)
      return {
        staffId: s.id,
        staffName: s.name,
        role: s.role,
        department: s.department,
        currency: s.currency || "PKR",
        monthlySalary: s.salary,
        basicSalary: Number(s.basic_salary) || 0,
        medicalAllowance: Number(s.medical_allowance) || 0,
        medicalEnabled: Boolean(s.medical_enabled),
        taxAmount: Number(s.tax_amount) || 0,
        taxEnabled: Boolean(s.tax_enabled),
        eobiAmount: Number(s.eobi_amount) || 0,
        eobiEnabled: Boolean(s.eobi_enabled),
        customAllowances: normalizeStaffPayLines(s.custom_allowances),
        customDeductions: normalizeStaffPayLines(s.custom_deductions),
        incentive: amountFromSalaryAdjustments(saved?.adjustments, ["incentive"]),
        commission: amountFromSalaryAdjustments(saved?.adjustments, ["commission"]),
        included: true,
        periodFrom: saved?.periodStart || periodStartForJoinDate(month, s.join_date),
        periodTo: saved?.periodEnd || bounds.to,
        bankName: s.bank_name || "",
        bankAccountNumber: s.bank_account_number || "",
        bankAccountTitle: s.bank_account_title || "",
      }
    })
}

function MarkPaidDialog({
  staffName,
  netLabel,
  month,
  saving,
  onClose,
  onConfirm,
}: {
  staffName: string
  netLabel: string
  month: string
  saving: boolean
  onClose: () => void
  onConfirm: (payload: {
    paymentNotes: string
    attachments: PendingAttachment[]
  }) => void | Promise<void>
}) {
  const [paymentNotes, setPaymentNotes] = useState("")
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const next = Array.from(fileList).map((file) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      note: "",
    }))
    setAttachments((prev) => [...prev, ...next])
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        e.stopPropagation()
        if (!saving) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold">Mark salary as paid</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {staffName} · {monthLabel(month)} · {netLabel}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Payment notes</label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Paid via bank transfer / JazzCash reference…"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">Attachments</label>
              <label className="inline-flex items-center gap-1.5 text-xs text-[#1a9f9a] cursor-pointer hover:underline">
                <Paperclip className="h-3.5 w-3.5" />
                Add files
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                  disabled={saving}
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>

            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center">
                Optional — add payment screenshots, bank slips, or PDFs. Each file can have its own note.
              </p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((att) => (
                  <li key={att.id} className="rounded-lg border p-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium break-all">{att.file.name}</p>
                      <button
                        type="button"
                        className="text-[10px] text-red-600 shrink-0"
                        disabled={saving}
                        onClick={() =>
                          setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      value={att.note}
                      onChange={(e) =>
                        setAttachments((prev) =>
                          prev.map((a) =>
                            a.id === att.id ? { ...a, note: e.target.value } : a,
                          ),
                        )
                      }
                      placeholder="Note for this attachment"
                      className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                      disabled={saving}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t bg-muted/10">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="flex-1 gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
            disabled={saving}
            onClick={() => void onConfirm({ paymentNotes, attachments })}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Saving…" : "Confirm paid"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function isProofImage(att: { url: string; name: string }) {
  const source = `${att.name} ${att.url}`.toLowerCase()
  return /\.(png|jpe?g|gif|webp|avif|bmp)(\?|$)/i.test(source)
}

function PaidProofsDialog({
  staffName,
  month,
  notes,
  attachments,
  paidBy,
  paidAt,
  saving,
  onClose,
  onSave,
}: {
  staffName: string
  month: string
  notes: string
  attachments: SalaryPaymentAttachment[]
  paidBy?: string | null
  paidAt?: string | null
  saving: boolean
  onClose: () => void
  onSave: (payload: {
    paymentNotes: string
    attachments: ProofEditItem[]
    newFiles: PendingAttachment[]
  }) => void | Promise<void>
}) {
  const [paymentNotes, setPaymentNotes] = useState(notes)
  const [existing, setExisting] = useState<ProofEditItem[]>(
    attachments.map((att, i) => ({
      key: `${att.url}-${i}`,
      url: att.url,
      name: att.name,
      note: att.note,
      uploadedAt: att.uploadedAt,
      replaceFile: null,
      previewUrl: null,
    })),
  )
  const [newFiles, setNewFiles] = useState<(PendingAttachment & { previewUrl: string })[]>([])
  const existingRef = useRef(existing)
  const newFilesRef = useRef(newFiles)
  existingRef.current = existing
  newFilesRef.current = newFiles

  useEffect(() => {
    return () => {
      for (const row of existingRef.current) {
        if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
      }
      for (const row of newFilesRef.current) {
        URL.revokeObjectURL(row.previewUrl)
      }
    }
  }, [])

  function addNewFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const next = Array.from(fileList).map((file) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      note: "",
      previewUrl: URL.createObjectURL(file),
    }))
    setNewFiles((prev) => [...prev, ...next])
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        e.stopPropagation()
        if (!saving) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold">Payment proof</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {staffName} · {monthLabel(month)} — remove a wrong screenshot, replace it, or add another.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto text-sm">
          {(paidBy || paidAt) && (
            <p className="text-xs text-muted-foreground">
              Paid{paidBy ? ` by ${paidBy}` : ""}
              {paidAt ? ` · ${new Date(paidAt).toLocaleString("en-PK")}` : ""}
            </p>
          )}
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase text-muted-foreground">Notes</p>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              rows={3}
              disabled={saving}
              placeholder="Payment notes…"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase text-muted-foreground">Attachments</p>
              <label className="inline-flex items-center gap-1.5 text-xs text-[#1a9f9a] cursor-pointer hover:underline">
                <Paperclip className="h-3.5 w-3.5" />
                Add files
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                  disabled={saving}
                  onChange={(e) => {
                    addNewFiles(e.target.files)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>
            {existing.length === 0 && newFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center">
                No attachments. Add a screenshot or bank slip.
              </p>
            ) : (
              <ul className="space-y-2">
                {existing.map((att) => {
                  const previewUrl = att.previewUrl || att.url
                  const previewName = att.replaceFile ? att.replaceFile.name : att.name
                  return (
                    <li key={att.key} className="rounded-lg border p-2.5 space-y-2">
                      {isProofImage({ url: previewUrl, name: previewName }) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt={previewName}
                          className="max-h-36 w-full object-contain rounded-md bg-[hsl(var(--muted))]/30"
                        />
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={att.replaceFile ? previewUrl : att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-[#1a9f9a] underline break-all"
                        >
                          {previewName || "Attachment"}
                          {att.replaceFile ? " (will replace on save)" : ""}
                        </a>
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-[10px] text-[#1a9f9a] cursor-pointer hover:underline">
                            Replace
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              disabled={saving}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                e.target.value = ""
                                if (!file) return
                                setExisting((prev) =>
                                  prev.map((row) => {
                                    if (row.key !== att.key) return row
                                    if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
                                    return {
                                      ...row,
                                      replaceFile: file,
                                      name: file.name,
                                      previewUrl: URL.createObjectURL(file),
                                    }
                                  }),
                                )
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="text-[10px] text-red-600 inline-flex items-center gap-0.5"
                            disabled={saving}
                            onClick={() =>
                              setExisting((prev) => {
                                const row = prev.find((r) => r.key === att.key)
                                if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl)
                                return prev.filter((r) => r.key !== att.key)
                              })
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        </div>
                      </div>
                      <input
                        value={att.note}
                        onChange={(e) =>
                          setExisting((prev) =>
                            prev.map((row) =>
                              row.key === att.key ? { ...row, note: e.target.value } : row,
                            ),
                          )
                        }
                        placeholder="Note for this attachment"
                        className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                        disabled={saving}
                      />
                    </li>
                  )
                })}
                {newFiles.map((att) => (
                  <li key={att.id} className="rounded-lg border border-dashed p-2.5 space-y-2">
                    {isProofImage({ url: att.file.name, name: att.file.name }) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={att.previewUrl}
                        alt={att.file.name}
                        className="max-h-36 w-full object-contain rounded-md bg-[hsl(var(--muted))]/30"
                      />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium break-all">{att.file.name} (new)</p>
                      <button
                        type="button"
                        className="text-[10px] text-red-600"
                        disabled={saving}
                        onClick={() =>
                          setNewFiles((prev) => {
                            const row = prev.find((a) => a.id === att.id)
                            if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl)
                            return prev.filter((a) => a.id !== att.id)
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      value={att.note}
                      onChange={(e) =>
                        setNewFiles((prev) =>
                          prev.map((a) => (a.id === att.id ? { ...a, note: e.target.value } : a)),
                        )
                      }
                      placeholder="Note for this attachment"
                      className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                      disabled={saving}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex gap-2 px-4 py-3 border-t bg-muted/10">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="flex-1 gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
            disabled={saving}
            onClick={() =>
              void onSave({
                paymentNotes,
                attachments: existing,
                newFiles,
              })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  )
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
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)
  const [updatingProofs, setUpdatingProofs] = useState(false)
  const [payingStaffId, setPayingStaffId] = useState<string | null>(null)
  const [viewProofsStaffId, setViewProofsStaffId] = useState<string | null>(null)

  useEffect(() => {
    if (initialMonth) setMonth(initialMonth)
  }, [initialMonth])

  useEffect(() => {
    const monthSlips = existingSlips.filter((s) => s.month === month)
    setRows(buildRows(staff, month, monthSlips))
  }, [month, staff, existingSlips])

  const finalizedByStaff = useMemo(() => {
    const map = new Map<string, ExistingSlip>()
    for (const slip of existingSlips) {
      if (slip.month !== month) continue
      if (String(slip.status || "").toLowerCase() !== "finalized") continue
      const key = slip.staffLocalId || String(slip.staffName || "").trim().toLowerCase()
      if (key) map.set(key, slip)
    }
    return map
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
              row.eobiAmount,
              row.eobiEnabled,
              row.medicalAllowance,
              row.medicalEnabled,
              row.customAllowances,
              row.customDeductions,
              row.basicSalary,
              row.incentive,
              row.commission,
            )
          : {
              baseSalary: 0,
              adjustments: [],
              netSalary: 0,
              incentive: 0,
              commission: 0,
              proRateDescription: "",
              payPeriodText: "",
            }
      return { row, advance, figures }
    })
  }, [rows, advanceByStaff])

  const includedRows = computed.filter((c) => c.row.included)
  const selectableRows = computed.filter(
    (c) => !finalizedByStaff.has(c.row.staffId) && !finalizedByStaff.has(c.row.staffName.trim().toLowerCase()),
  )
  const allSelectableIncluded =
    selectableRows.length > 0 && selectableRows.every((c) => c.row.included)
  const totalNet = includedRows.reduce((sum, c) => sum + c.figures.netSalary, 0)
  const currency = includedRows[0]?.row.currency || "PKR"
  const draftCount = existingSlips.filter((s) => s.month === month && s.status === "draft").length
  const paidCount = existingSlips.filter(
    (s) => s.month === month && String(s.status || "").toLowerCase() === "finalized",
  ).length

  const payingRow = payingStaffId
    ? computed.find((c) => c.row.staffId === payingStaffId) || null
    : null
  const proofSlip = viewProofsStaffId
    ? finalizedByStaff.get(viewProofsStaffId) ||
      finalizedByStaff.get(
        computed.find((c) => c.row.staffId === viewProofsStaffId)?.row.staffName.trim().toLowerCase() ||
          "",
      ) ||
      null
    : null

  function isFinalized(row: SalaryRow) {
    return (
      finalizedByStaff.has(row.staffId) ||
      finalizedByStaff.has(row.staffName.trim().toLowerCase())
    )
  }

  function getFinalizedSlip(row: SalaryRow) {
    return (
      finalizedByStaff.get(row.staffId) ||
      finalizedByStaff.get(row.staffName.trim().toLowerCase()) ||
      null
    )
  }

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
        if (isFinalized(row)) return row
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
          incentive: figures.incentive,
          commission: figures.commission,
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

  async function saveSlips(
    status: "draft" | "finalized",
    selected = computed.filter((c) => c.row.included),
    payment?: {
      paymentNotes: string
      paymentAttachments: SalaryPaymentAttachment[]
      paidBy: string
      paidAt: string
    },
  ) {
    if (selected.length === 0) {
      alert("Select at least one employee.")
      return
    }

    for (const { row } of selected) {
      if (!row.periodFrom || !row.periodTo || row.periodTo < row.periodFrom) {
        alert(`Invalid pay period for ${row.staffName}.`)
        return
      }
      if (status === "finalized" && isFinalized(row)) {
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
        recoveredBy,
        ...(payment
          ? {
              paidAt: payment.paidAt,
              paidBy: payment.paidBy,
              paymentNotes: payment.paymentNotes,
              paymentAttachments: payment.paymentAttachments,
            }
          : {}),
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

  async function handleUpdatePaymentProofs(payload: {
    paymentNotes: string
    attachments: ProofEditItem[]
    newFiles: PendingAttachment[]
  }) {
    if (!proofSlip?.id) {
      alert("This paid record has no saved slip id, so proofs cannot be updated.")
      return
    }
    setUpdatingProofs(true)
    try {
      const kept: SalaryPaymentAttachment[] = []
      for (const att of payload.attachments) {
        if (att.replaceFile) {
          const [url] = await uploadFiles([att.replaceFile], "salary-proofs")
          if (!url) throw new Error("Upload failed while replacing an attachment.")
          kept.push({
            url,
            name: att.replaceFile.name,
            note: att.note.trim(),
            uploadedAt: new Date().toISOString(),
          })
        } else {
          kept.push({
            url: att.url,
            name: att.name,
            note: att.note.trim(),
            uploadedAt: att.uploadedAt || new Date().toISOString(),
          })
        }
      }

      let added: SalaryPaymentAttachment[] = []
      if (payload.newFiles.length > 0) {
        const urls = await uploadFiles(
          payload.newFiles.map((att) => att.file),
          "salary-proofs",
        )
        added = payload.newFiles
          .map((att, i) => ({
            url: urls[i] || "",
            name: att.file.name,
            note: att.note.trim(),
            uploadedAt: new Date().toISOString(),
          }))
          .filter((att) => att.url)
      }

      const res = await fetch("/api/hrm/salary-slips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: proofSlip.id,
          paymentNotes: payload.paymentNotes.trim(),
          paymentAttachments: [...kept, ...added],
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || "Failed to update payment proof.")
      }
      await onSaved()
      setViewProofsStaffId(null)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update payment proof.")
    } finally {
      setUpdatingProofs(false)
    }
  }

  async function handleMarkPaidConfirm(payload: {
    paymentNotes: string
    attachments: PendingAttachment[]
  }) {
    if (!payingRow) return
    setMarkingPaidId(payingRow.row.staffId)
    try {
      const files = payload.attachments.map((a) => a.file)
      const urls = files.length > 0 ? await uploadFiles(files, "salary-proofs") : []
      const paymentAttachments: SalaryPaymentAttachment[] = payload.attachments
        .map((att, i) => ({
          url: urls[i] || "",
          name: att.file.name,
          note: att.note.trim(),
          uploadedAt: new Date().toISOString(),
        }))
        .filter((a) => a.url)

      const saved = await saveSlips("finalized", [payingRow], {
        paymentNotes: payload.paymentNotes.trim(),
        paymentAttachments,
        paidBy: recoveredBy,
        paidAt: new Date().toISOString(),
      })
      if (!saved) return
      await onSaved()
      setPayingStaffId(null)
      alert(`${payingRow.row.staffName} marked as paid for ${monthLabel(month)}.`)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to mark salary as paid.")
    } finally {
      setMarkingPaidId(null)
    }
  }

  function copyAccountNumber(accountNumber: string) {
    if (!accountNumber.trim()) return
    void navigator.clipboard.writeText(accountNumber.trim())
  }

  const busy = saving || finalizing || !!markingPaidId || updatingProofs

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
              Uncheck employees to exclude them from export and payroll. Mark each employee as paid one by one with payment notes and attachments.
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
          {paidCount > 0 && (
            <Badge variant="outline" className="mt-5 text-emerald-700 border-emerald-300 bg-emerald-50">
              {paidCount} marked paid
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
          <table className="w-full min-w-[1600px]">
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
                <th className="px-2 py-2 text-xs font-medium text-right min-w-[100px]">Incentive</th>
                <th className="px-2 py-2 text-xs font-medium text-right min-w-[100px]">Commission</th>
                <th className="px-2 py-2 text-xs font-medium text-right">Advance</th>
                <th className="px-2 py-2 text-xs font-medium text-right">Net</th>
                <th className="px-2 py-2 text-xs font-medium min-w-[130px]">Payment</th>
              </tr>
            </thead>
            <tbody>
              {computed.map(({ row, advance, figures }) => {
                const finalized = isFinalized(row)
                const slip = getFinalizedSlip(row)
                const proofs = normalizePaymentAttachments(slip?.paymentAttachments)
                const marking = markingPaidId === row.staffId
                return (
                  <tr
                    key={row.staffId}
                    className={`border-b border-[hsl(var(--border))] ${!row.included ? "opacity-50" : ""}`}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={row.included}
                        disabled={finalized}
                        onChange={(e) => updateRow(row.staffId, { included: e.target.checked })}
                        className="h-4 w-4 rounded"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <p className="text-sm font-medium">{row.staffName}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{row.role}</p>
                      {finalized && (
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
                        disabled={!row.included || finalized}
                        onChange={(e) => updateRow(row.staffId, { periodFrom: e.target.value })}
                        className="h-8 w-[132px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={row.periodTo}
                        disabled={!row.included || finalized}
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
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.incentive || ""}
                        placeholder="0"
                        disabled={!row.included || finalized}
                        onChange={(e) =>
                          updateRow(row.staffId, {
                            incentive: Math.max(0, Math.round(Number(e.target.value) || 0)),
                          })
                        }
                        className="h-8 w-[96px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-right tabular-nums disabled:opacity-60"
                        title="Incentive (added to net)"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.commission || ""}
                        placeholder="0"
                        disabled={!row.included || finalized}
                        onChange={(e) =>
                          updateRow(row.staffId, {
                            commission: Math.max(0, Math.round(Number(e.target.value) || 0)),
                          })
                        }
                        className="h-8 w-[96px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-right tabular-nums disabled:opacity-60"
                        title="Commission (added to net)"
                      />
                    </td>
                    <td className="px-2 py-2 text-right text-sm tabular-nums text-red-600">
                      {advance > 0 ? `− ${row.currency} ${advance.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums">
                      {row.currency} {figures.netSalary.toLocaleString()}
                    </td>
                    <td className="px-2 py-2">
                      {finalized ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="success" className="text-[10px] w-fit">
                            Paid
                          </Badge>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[10px] text-[#1a9f9a] hover:underline"
                            onClick={() => setViewProofsStaffId(row.staffId)}
                          >
                            <Eye className="h-3 w-3" />
                            {proofs.length > 0 || slip?.paymentNotes ? "View / edit proof" : "Add proof"}
                          </button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1"
                          disabled={busy || !row.included}
                          onClick={() => setPayingStaffId(row.staffId)}
                        >
                          {marking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Mark paid
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[hsl(var(--border))] px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xl">
            Use Mark paid per employee to record payment with attachments and notes. Bulk finalize still available without per-row proofs. {includedRows.length} of {computed.length} selected.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={busy || exportingExcel || includedRows.length === 0}
              onClick={handleExportExcel}
            >
              <Download className="h-4 w-4" />
              {exportingExcel ? "Exporting…" : "Export Excel"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={busy}
              onClick={handleSaveDraftAndExport}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save draft & export PDF"}
            </Button>
            <Button
              className="gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
              disabled={busy}
              onClick={handleFinalize}
            >
              <CheckCircle2 className="h-4 w-4" />
              {finalizing ? "Finalizing…" : "Finalize payroll"}
            </Button>
          </div>
        </div>
      </div>

      {payingRow && (
        <MarkPaidDialog
          staffName={payingRow.row.staffName}
          netLabel={`${payingRow.row.currency} ${payingRow.figures.netSalary.toLocaleString()}`}
          month={month}
          saving={markingPaidId === payingRow.row.staffId}
          onClose={() => {
            if (!markingPaidId) setPayingStaffId(null)
          }}
          onConfirm={handleMarkPaidConfirm}
        />
      )}

      {proofSlip && viewProofsStaffId && (
        <PaidProofsDialog
          key={proofSlip.id || viewProofsStaffId}
          staffName={
            computed.find((c) => c.row.staffId === viewProofsStaffId)?.row.staffName ||
            proofSlip.staffName ||
            ""
          }
          month={month}
          notes={String(proofSlip.paymentNotes || "")}
          attachments={normalizePaymentAttachments(proofSlip.paymentAttachments)}
          paidBy={proofSlip.paidBy}
          paidAt={proofSlip.paidAt}
          saving={updatingProofs}
          onClose={() => {
            if (!updatingProofs) setViewProofsStaffId(null)
          }}
          onSave={handleUpdatePaymentProofs}
        />
      )}
    </div>
  )
}
