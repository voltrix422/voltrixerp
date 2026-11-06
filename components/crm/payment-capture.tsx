"use client"
import { useState, useEffect, type ChangeEvent } from "react"
import { createPortal } from "react-dom"
import {
  saveOrder,
  type Order,
  type OrderPayment,
  getOrderPaymentProofUrls,
  getPaymentSubmissionStatus,
  isPaymentEditable,
  isPaymentDeletable,
  isProofOnlyPayment,
  getDraftPayments,
  canCapturePaymentsForOrder,
  orderHasPendingFinancePayments,
  isOrderPaymentLocked,
  isPostDeliveryPaymentCapture,
  getOrderAmountPaid,
  getOrderCreditBalance,
  isOrderOnCredit,
  normalizeOrderPaymentTerms,
} from "@/lib/orders"
import { uploadFile } from "@/lib/upload"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { X, Upload, Trash2, Plus } from "lucide-react"

const PAYMENT_STATUS_LABELS = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
} as const

const PAYMENT_STATUS_COLORS = {
  draft: "bg-black/[0.06] text-[#6e6e73] dark:bg-white/10 dark:text-[#aeaeb2]",
  pending_approval: "bg-[#ff9f0a]/18 text-[#9a6700] dark:bg-[#ff9f0a]/20 dark:text-[#ffd60a]",
  approved: "bg-[#30d158]/18 text-[#248a3d] dark:bg-[#30d158]/20 dark:text-[#30d158]",
} as const

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function orderStatusAfterPaymentsRemoved(order: Order, remaining: OrderPayment[]) {
  if (order.status === "delivered") return "delivered" as const
  const hasPending = remaining.some(p => getPaymentSubmissionStatus(p, order.status) === "pending_approval")
  const hasSubmitted = remaining.some(p => {
    const s = getPaymentSubmissionStatus(p, order.status)
    return s === "pending_approval" || s === "approved"
  })
  if (hasPending || hasSubmitted) return "payment_added" as const
  if (order.status === "payment_added") {
    return (Math.abs(Number(order.tax || 0)) > 0.004 || order.transportCost > 0) ? "finalized" as const : "approved" as const
  }
  return order.status
}

export function PaymentCapture({ order, currentUser, onClose, onUpdate }: {
  order: Order
  currentUser: string
  onClose: () => void
  onUpdate: (o: Order) => void
}) {
  const [payments, setPayments] = useState<OrderPayment[]>(order.payments || [])
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentProofFiles, setPaymentProofFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editMethod, setEditMethod] = useState("Bank Transfer")
  const [editDate, setEditDate] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const draftPayments = getDraftPayments(payments, order.status)
  const financeLocked = isOrderPaymentLocked(order)
  const postDelivery = isPostDeliveryPaymentCapture(order)
  const onCredit = isOrderOnCredit(order)
  const totalSubmitted = getOrderAmountPaid({ ...order, payments })
  const totalDraft = draftPayments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = getOrderCreditBalance({ ...order, payments })
  // Delivered orders with unpaid balance should allow amount + proof capture,
  // even when they were not explicitly marked as "credit".
  const deliveredNeedsPayment = postDelivery && remaining > 0.004
  const deliveredProofOnly = postDelivery && !deliveredNeedsPayment
  const canAddPayments = canCapturePaymentsForOrder(order) && !financeLocked

  useEffect(() => {
    setPayments(order.payments || [])
  }, [order.id, order.payments, order.status])

  async function persistOrder(nextPayments: OrderPayment[], nextStatus?: Order["status"]) {
    let updated: Order = normalizeOrderPaymentTerms({
      ...order,
      payments: nextPayments,
      status: nextStatus ?? order.status,
    })
    await saveOrder(updated)
    updated = normalizeOrderPaymentTerms(updated)
    setPayments(nextPayments)
    onUpdate(updated)
    return updated
  }

  async function uploadProofFiles(files: File[]) {
    if (files.length === 0) return []
    setUploadingProof(true)
    try {
      return await Promise.all(files.map(file => uploadFile(file, "payment-proofs")))
    } finally {
      setUploadingProof(false)
    }
  }

  function validatePaymentAmount(amount: number, excludePaymentId?: string) {
    if (Number.isNaN(amount) || amount < 0) {
      setError("Please enter a valid payment amount (0 or greater)")
      return false
    }
    const otherSubmitted = payments
      .filter(p => p.id !== excludePaymentId)
      .filter(p => {
        const s = getPaymentSubmissionStatus(p, order.status)
        return (s === "pending_approval" || s === "approved") && !isProofOnlyPayment(p)
      })
      .reduce((sum, p) => sum + p.amount, 0)
    const otherDraft = payments
      .filter(p => p.id !== excludePaymentId && getPaymentSubmissionStatus(p, order.status) === "draft")
      .reduce((sum, p) => sum + p.amount, 0)
    const maxAllowed = order.total - otherSubmitted - otherDraft
    if (amount > maxAllowed + 0.004) {
      setError(`Payment amount cannot exceed remaining balance of PKR ${Math.max(0, maxAllowed).toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
      return false
    }
    return true
  }

  function validateNewPaymentAmount(amount: number) {
    return validatePaymentAmount(amount)
  }

  function resetNewPaymentForm() {
    setPaymentAmount("")
    setPaymentMethod("Bank Transfer")
    setPaymentDate(new Date().toISOString().split("T")[0])
    setPaymentNotes("")
    setPaymentProofFiles([])
    setError(null)
  }

  async function handleSaveDraft() {
    setError(null)
    const amount = Number(paymentAmount)
    if (!validateNewPaymentAmount(amount)) return

    setSaving(true)
    try {
      let proofUrls: string[] = []
      if (paymentProofFiles.length > 0) {
        proofUrls = await uploadProofFiles(paymentProofFiles)
      }

      const payment: OrderPayment = {
        id: Date.now().toString(),
        amount,
        method: paymentMethod,
        date: paymentDate,
        notes: paymentNotes,
        proofUrls,
        proofUrl: proofUrls[0],
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        submissionStatus: "draft",
      }

      await persistOrder([...payments, payment])
      resetNewPaymentForm()
    } catch {
      setError("Failed to save payment draft")
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePostDeliveryCreditPayment() {
    setError(null)
    const amount = Number(paymentAmount)
    if (!validateNewPaymentAmount(amount)) return
    if (amount <= 0.004) {
      setError("Enter a payment amount greater than zero")
      return
    }
    if (paymentProofFiles.length === 0) {
      setError("Payment proof is required")
      return
    }

    setSaving(true)
    try {
      const proofUrls = await uploadProofFiles(paymentProofFiles)

      const payment: OrderPayment = {
        id: Date.now().toString(),
        amount,
        method: paymentMethod,
        date: paymentDate,
        notes: paymentNotes,
        proofUrls,
        proofUrl: proofUrls[0],
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        submissionStatus: "approved",
        proofOnly: false,
      }

      await persistOrder([...payments, payment])
      resetNewPaymentForm()
    } catch {
      setError("Failed to record payment")
    } finally {
      setSaving(false)
    }
  }

  async function handleAttachPostDeliveryProof() {
    setError(null)
    if (paymentProofFiles.length === 0) {
      setError("Please attach at least one proof file")
      return
    }

    setSaving(true)
    try {
      const proofUrls = await uploadProofFiles(paymentProofFiles)

      const payment: OrderPayment = {
        id: Date.now().toString(),
        amount: 0,
        method: "Proof attachment",
        date: new Date().toISOString().split("T")[0],
        notes: paymentNotes,
        proofUrls,
        proofUrl: proofUrls[0],
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        submissionStatus: "approved",
        proofOnly: true,
      }

      await persistOrder([...payments, payment])
      resetNewPaymentForm()
    } catch {
      setError("Failed to attach proof")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitNewForApproval() {
    setError(null)
    const amount = Number(paymentAmount)
    if (!validateNewPaymentAmount(amount)) return

    if (amount > 0.004 && paymentProofFiles.length === 0) {
      setError("At least one payment proof is required before submitting for approval")
      return
    }

    setSaving(true)
    try {
      const proofUrls =
        paymentProofFiles.length > 0 ? await uploadProofFiles(paymentProofFiles) : []

      const payment: OrderPayment = {
        id: Date.now().toString(),
        amount,
        method: paymentMethod,
        date: paymentDate,
        notes: paymentNotes,
        proofUrls: proofUrls.length > 0 ? proofUrls : undefined,
        proofUrl: proofUrls[0],
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        submissionStatus: "pending_approval",
      }

      await persistOrder([...payments, payment], "payment_added")
      resetNewPaymentForm()
    } catch {
      setError("Failed to submit payment for approval")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitFullCreditForApproval() {
    setError(null)
    setSaving(true)
    try {
      await persistOrder(payments, "payment_added")
      onClose()
    } catch {
      setError("Failed to submit order for approval")
    } finally {
      setSaving(false)
    }
  }

  const canSubmitNewPayment = paymentAmount !== "" && !Number.isNaN(Number(paymentAmount))
  const newPaymentAmount = Number(paymentAmount)
  const isZeroAmountSubmit = canSubmitNewPayment && newPaymentAmount <= 0.004

  async function handleSubmitDraft(paymentId: string) {
    const payment = payments.find(p => p.id === paymentId)
    if (!payment) return

    if (payment.amount > 0.004 && getOrderPaymentProofUrls(payment).length === 0) {
      setError("Add at least one payment proof before submitting this draft for approval")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const next = payments.map(p =>
        p.id === paymentId ? { ...p, submissionStatus: "pending_approval" as const } : p
      )
      await persistOrder(next, "payment_added")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePayment(paymentId: string) {
    const payment = payments.find(p => p.id === paymentId)
    if (!payment || !isPaymentDeletable(payment, order.status)) return

    const next = payments.filter(p => p.id !== paymentId)
    const nextStatus = orderStatusAfterPaymentsRemoved(order, next)
    await persistOrder(next, nextStatus)
    setDeletePaymentId(null)
  }

  function startEditPayment(payment: OrderPayment) {
    setEditingPaymentId(payment.id)
    setEditAmount(String(payment.amount))
    setEditMethod(payment.method)
    setEditDate(payment.date)
    setEditNotes(payment.notes || "")
    setError(null)
  }

  function cancelEditPayment() {
    setEditingPaymentId(null)
    setError(null)
  }

  async function handleSavePaymentEdit(paymentId: string) {
    const payment = payments.find(p => p.id === paymentId)
    if (!payment || !isPaymentEditable(payment, order.status)) return

    const amount = Number(editAmount)
    if (!validatePaymentAmount(amount, paymentId)) return

    setSaving(true)
    setError(null)
    try {
      const next = payments.map(p =>
        p.id === paymentId
          ? { ...p, amount, method: editMethod, date: editDate, notes: editNotes }
          : p
      )
      await persistOrder(next)
      cancelEditPayment()
    } catch {
      setError("Failed to update payment")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddProofsToPayment(paymentId: string, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ""
    if (files.length === 0) return

    const payment = payments.find(p => p.id === paymentId)
    if (!payment || !isPaymentEditable(payment, order.status)) return

    setSaving(true)
    setError(null)
    try {
      const newUrls = await uploadProofFiles(files)
      const existing = getOrderPaymentProofUrls(payment)
      const proofUrls = [...existing, ...newUrls]

      const next = payments.map(p =>
        p.id === paymentId
          ? { ...p, proofUrls, proofUrl: proofUrls[0] }
          : p
      )
      await persistOrder(next)
    } catch {
      setError("Failed to upload additional proof files")
    } finally {
      setSaving(false)
    }
  }

  function handleProofFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      setPaymentProofFiles(prev => [...prev, ...files])
    }
    event.target.value = ""
  }

  function removeProofFile(index: number) {
    setPaymentProofFiles(prev => prev.filter((_, fileIndex) => fileIndex !== index))
  }

  function renderPaymentRow(payment: OrderPayment, paymentNumber: number) {
    const status = getPaymentSubmissionStatus(payment, order.status)
    const proofOnly = isProofOnlyPayment(payment)
    const editable = isPaymentEditable(payment, order.status) && !financeLocked
    const deletable = isPaymentDeletable(payment, order.status) && !financeLocked
    const isEditing = editingPaymentId === payment.id && !proofOnly

    return (
      <div key={payment.id} className="rounded-[12px] border border-black/[0.04] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] px-3 py-2 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold tracking-tight truncate text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              {proofOnly
                ? `Proof ${paymentNumber}`
                : `Payment ${paymentNumber} · PKR ${fmtMoney(payment.amount)}`}
            </p>
            <p className="text-[11px] text-[#86868b] truncate">
              {proofOnly
                ? new Date(payment.date).toLocaleDateString()
                : `${payment.method} · ${new Date(payment.date).toLocaleDateString()}`}
              {payment.notes ? ` · ${payment.notes}` : ""}
            </p>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-tight shrink-0 ${PAYMENT_STATUS_COLORS[status]}`}>
            {PAYMENT_STATUS_LABELS[status]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {getOrderPaymentProofUrls(payment).map((proofUrl, proofIndex) => (
            <a
              key={`${payment.id}-${proofIndex}`}
              href={proofUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[hsl(var(--primary))] underline text-[10px]"
            >
              Proof {proofIndex + 1}
            </a>
          ))}
          {editable && (
            <label className="inline-flex items-center gap-0.5 text-[10px] text-[hsl(var(--primary))] cursor-pointer hover:underline">
              <Plus className="h-3 w-3" />
              Add
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={e => handleAddProofsToPayment(payment.id, e)}
              />
            </label>
          )}
          {editable && !proofOnly && status === "draft" && (
            <Button
              size="sm"
              className="h-6 text-[10px] px-2 cursor-pointer"
              onClick={() => handleSubmitDraft(payment.id)}
              disabled={saving || uploadingProof}
            >
              Submit
            </Button>
          )}
          {editable && !proofOnly && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 cursor-pointer"
              onClick={() => startEditPayment(payment)}
              disabled={saving}
            >
              Edit
            </Button>
          )}
          {deletable && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 ml-auto"
              onClick={() => setDeletePaymentId(payment.id)}
              disabled={saving}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  const formLabel = deliveredNeedsPayment
    ? payments.length > 0
      ? "Another payment"
      : "Record payment"
    : deliveredProofOnly
      ? payments.length > 0
        ? "Another proof"
        : "Attach proof"
      : payments.length > 0
        ? "Another payment"
        : "Add payment"

  const fieldClass =
    "w-full h-9 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] dark:border-[hsl(var(--border))] px-3 text-[13px] tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"

  return (
    <>
      {typeof document !== "undefined" && createPortal(
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xl p-0 sm:p-5"
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-[560px] max-h-[min(92vh,720px)] rounded-t-[22px] sm:rounded-[22px] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 px-5 pt-4 pb-3 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[20px] font-semibold tracking-[-0.03em] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
                  Capture payment
                </p>
                <p className="text-[13px] font-medium text-[#86868b] tracking-tight mt-0.5 truncate">
                  {order.orderNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: "Total", value: fmtMoney(order.total) },
                { label: "Submitted", value: fmtMoney(totalSubmitted) },
                { label: "Remaining", value: fmtMoney(remaining) },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[12px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.04] dark:border-[hsl(var(--border))] px-2.5 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold tracking-tight tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
            {totalDraft > 0 && (
              <p className="mt-1.5 text-[11px] text-[#86868b] tabular-nums">
                Draft {fmtMoney(totalDraft)}
              </p>
            )}
          </div>

          <div className="px-5 sm:px-6 pb-3 space-y-3">
            {error && (
              <div className="px-3 py-2 rounded-[12px] bg-[#ff3b30]/10">
                <p className="text-[12px] font-medium text-[#d70015]">{error}</p>
              </div>
            )}

            <p className="text-[12px] font-medium text-[#6e6e73] leading-snug">
              {financeLocked
                ? onCredit && remaining > 0
                  ? "Fully paid — no further payments."
                  : "Finance approved — proofs locked."
                : deliveredNeedsPayment
                  ? "Delivered with balance — record payment + proof."
                  : deliveredProofOnly
                    ? "Fully paid — attach proof only (doesn’t change balance)."
                    : onCredit && remaining > 0
                      ? "On credit — add payments until cleared."
                      : "Submit payment with proof to Finance. Amount 0 = full credit."}
            </p>

            {payments.length > 0 && (
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b] px-0.5">
                  Recorded
                </p>
                {payments.map((payment, index) => renderPaymentRow(payment, index + 1))}
              </div>
            )}

            {canAddPayments && (
              <div className="rounded-[14px] border border-black/[0.04] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] p-3.5 space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
                  {formLabel}
                </p>

                {(!postDelivery || deliveredNeedsPayment) && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#6e6e73]">Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className={fieldClass}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#6e6e73]">Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className={`${fieldClass} cursor-pointer`}
                      >
                        <option>Bank Transfer</option>
                        <option>Cash</option>
                        <option>Cheque</option>
                        <option>Credit Card</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                )}

                {(!postDelivery || deliveredNeedsPayment) && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#6e6e73]">Date</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#6e6e73]">Notes</label>
                  <input
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className={fieldClass}
                    placeholder="Txn ID, reference…"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#6e6e73]">
                    {deliveredProofOnly || deliveredNeedsPayment ? "Proof *" : "Proof"}
                  </label>
                  <label className="flex items-center justify-center gap-1.5 h-9 rounded-[10px] border border-dashed border-black/[0.12] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-3 text-[13px] font-semibold text-[#0071e3] cursor-pointer hover:bg-black/[0.03] transition-colors">
                    <Upload className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={handleProofFilesChange}
                      className="hidden"
                    />
                  </label>
                  {paymentProofFiles.length > 0 && (
                    <div className="space-y-1">
                      {paymentProofFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between rounded-[10px] bg-[#f5f5f7] dark:bg-white/5 px-2.5 py-1.5 text-[11px]"
                        >
                          <span className="truncate pr-2 font-medium">{file.name}</span>
                          <button
                            type="button"
                            className="h-6 w-6 inline-flex items-center justify-center rounded-full text-[#d70015] hover:bg-[#ff3b30]/10 cursor-pointer"
                            onClick={() => removeProofFile(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-2 px-5 sm:px-6 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-black/[0.05] dark:border-[hsl(var(--border))]">
            {canAddPayments && !postDelivery && payments.length === 0 && !orderHasPendingFinancePayments({ ...order, payments }) && (
              <button
                type="button"
                onClick={handleSubmitFullCreditForApproval}
                disabled={saving || uploadingProof}
                className="h-10 px-4 rounded-full border border-[#ff9f0a]/40 text-[13px] font-semibold text-[#9a6700] hover:bg-[#ff9f0a]/10 disabled:opacity-60 cursor-pointer"
              >
                {saving ? "Submitting..." : "Full credit"}
              </button>
            )}
            {canAddPayments && deliveredProofOnly && (
              <button
                type="button"
                onClick={handleAttachPostDeliveryProof}
                disabled={saving || uploadingProof || paymentProofFiles.length === 0}
                className="h-10 flex-1 sm:flex-none px-5 rounded-full bg-[#0071e3] text-white text-[13px] font-semibold tracking-tight hover:bg-[#0077ed] disabled:opacity-60 cursor-pointer"
              >
                {saving ? "Saving..." : uploadingProof ? "Uploading..." : "Attach proof"}
              </button>
            )}
            {canAddPayments && deliveredNeedsPayment && (
              <button
                type="button"
                onClick={handleSavePostDeliveryCreditPayment}
                disabled={saving || uploadingProof || !canSubmitNewPayment || paymentProofFiles.length === 0}
                className="h-10 flex-1 sm:flex-none px-5 rounded-full bg-[#0071e3] text-white text-[13px] font-semibold tracking-tight hover:bg-[#0077ed] disabled:opacity-60 cursor-pointer"
              >
                {saving ? "Saving..." : uploadingProof ? "Uploading..." : "Record payment"}
              </button>
            )}
            {canAddPayments && !postDelivery && (
              <>
                <button
                  type="button"
                  onClick={handleSubmitNewForApproval}
                  disabled={saving || uploadingProof || !canSubmitNewPayment}
                  className="h-10 flex-1 sm:flex-none px-5 rounded-full bg-[#0071e3] text-white text-[13px] font-semibold tracking-tight hover:bg-[#0077ed] disabled:opacity-60 cursor-pointer"
                >
                  {saving ? "Processing..." : uploadingProof ? "Uploading..." : isZeroAmountSubmit ? "Submit (0)" : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving || uploadingProof || !canSubmitNewPayment}
                  className="h-10 px-4 rounded-full bg-black/[0.06] text-[13px] font-semibold text-[#1d1d1f] hover:bg-black/[0.1] disabled:opacity-60 cursor-pointer dark:bg-white/10 dark:text-white"
                >
                  {saving ? "Saving..." : "Draft"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-full text-[13px] font-semibold text-[#0071e3] hover:bg-[#0071e3]/08 cursor-pointer sm:ml-auto"
            >
              {financeLocked || remaining <= 0 ? "Close" : "Done"}
            </button>
          </div>
        </div>
      </div>,
      document.body,
      )}

      <ConfirmDialog
        isOpen={deletePaymentId !== null}
        title="Delete payment"
        message={
          deliveredProofOnly
            ? "Remove this payment or proof from the order? The order and delivery details stay — only this entry is deleted."
            : "Are you sure you want to delete this payment? This action cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deletePaymentId && handleDeletePayment(deletePaymentId)}
        onCancel={() => setDeletePaymentId(null)}
      />
    </>
  )
}
