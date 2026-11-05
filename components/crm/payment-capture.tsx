"use client"
import { useState, useEffect, type ChangeEvent } from "react"
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
  pending_approval: "Pending finance approval",
  approved: "Approved by finance",
} as const

const PAYMENT_STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
} as const

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
      <div key={payment.id} className="rounded-md border px-2.5 py-1.5 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">
              {proofOnly
                ? `Proof ${paymentNumber}`
                : `P${paymentNumber} · PKR ${payment.amount.toLocaleString()}`}
            </p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
              {proofOnly
                ? new Date(payment.date).toLocaleDateString()
                : `${payment.method} · ${new Date(payment.date).toLocaleDateString()}`}
              {payment.notes ? ` · ${payment.notes}` : ""}
            </p>
          </div>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${PAYMENT_STATUS_COLORS[status]}`}>
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

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-3" onClick={onClose}>
        <div className="w-full sm:max-w-md rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-2 px-3 py-2.5 border-b shrink-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[hsl(var(--primary))] truncate">
                Capture Payment — {order.orderNumber}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums">
                <span><span className="font-medium text-[hsl(var(--foreground))]">Total</span> {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span><span className="font-medium text-[hsl(var(--foreground))]">Submitted</span> {totalSubmitted.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span><span className="font-medium text-[hsl(var(--foreground))]">Remaining</span> {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                {totalDraft > 0 && (
                  <span>Draft {totalDraft.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 cursor-pointer" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 space-y-2.5">
            {error && (
              <div className="px-2.5 py-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-800 dark:text-red-200 font-medium">{error}</p>
              </div>
            )}

            {financeLocked ? (
              <p className="text-[11px] text-green-800 dark:text-green-200 rounded-md border border-green-200 bg-green-50 dark:bg-green-950 px-2.5 py-1.5">
                {onCredit && remaining > 0
                  ? "Fully paid — no further payments."
                  : "Finance approved — proofs locked."}
              </p>
            ) : deliveredNeedsPayment ? (
              <p className="text-[11px] text-amber-900 dark:text-amber-100 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5">
                Delivered with balance — record payment + proof.
              </p>
            ) : deliveredProofOnly ? (
              <p className="text-[11px] text-emerald-900 dark:text-emerald-100 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5">
                Fully paid — attach proof only (doesn’t change balance).
              </p>
            ) : onCredit && remaining > 0 ? (
              <p className="text-[11px] text-amber-900 dark:text-amber-100 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5">
                On credit — add payments until cleared.
              </p>
            ) : (
              <p className="text-[11px] text-blue-900 dark:text-blue-100 rounded-md border bg-blue-50 dark:bg-blue-950 px-2.5 py-1.5">
                Submit payments with proof to Finance. Amount 0 = full credit.
              </p>
            )}

            {payments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Recorded</p>
                {payments.map((payment, index) => renderPaymentRow(payment, index + 1))}
              </div>
            )}

            {canAddPayments && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] pt-1 border-t">
                  {deliveredNeedsPayment
                    ? payments.length > 0
                      ? "Another payment"
                      : "Record payment"
                    : deliveredProofOnly
                      ? payments.length > 0
                        ? "Another proof"
                        : "Attach proof"
                      : payments.length > 0
                        ? "Another payment"
                        : "Add payment"}
                </p>

                {(!postDelivery || deliveredNeedsPayment) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium">Amount *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium">Method *</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] cursor-pointer"
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
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium">Date *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </div>
                )}

                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium">Notes (optional)</label>
                  <input
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    placeholder="Txn ID, reference…"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium">
                    {deliveredProofOnly ? "Proof *" : "Proof"}{deliveredNeedsPayment ? " *" : ""}
                  </label>
                  <label className="flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed bg-[hsl(var(--background))] px-2 text-xs cursor-pointer hover:bg-[hsl(var(--muted))]/30">
                    <Upload className="h-3.5 w-3.5" />
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
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border px-2 py-1 text-[10px]">
                          <span className="truncate pr-2">{file.name}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 cursor-pointer text-red-600"
                            onClick={() => removeProofFile(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-1.5 px-3 py-2.5 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {canAddPayments && !postDelivery && payments.length === 0 && !orderHasPendingFinancePayments({ ...order, payments }) && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-full sm:w-auto text-xs border-amber-500 text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40 cursor-pointer"
                onClick={handleSubmitFullCreditForApproval}
                disabled={saving || uploadingProof}
              >
                {saving ? "Submitting..." : "Full credit"}
              </Button>
            )}
            {canAddPayments && deliveredProofOnly && (
              <Button
                size="sm"
                className="h-8 w-full sm:w-auto text-xs bg-green-600 hover:bg-green-700 cursor-pointer order-1 sm:order-none"
                onClick={handleAttachPostDeliveryProof}
                disabled={saving || uploadingProof || paymentProofFiles.length === 0}
              >
                {saving ? "Saving..." : uploadingProof ? "Uploading..." : "Attach proof"}
              </Button>
            )}
            {canAddPayments && deliveredNeedsPayment && (
              <Button
                size="sm"
                className="h-8 w-full sm:w-auto text-xs bg-green-600 hover:bg-green-700 cursor-pointer order-1 sm:order-none"
                onClick={handleSavePostDeliveryCreditPayment}
                disabled={saving || uploadingProof || !canSubmitNewPayment || paymentProofFiles.length === 0}
              >
                {saving ? "Saving..." : uploadingProof ? "Uploading..." : "Record payment"}
              </Button>
            )}
            {canAddPayments && !postDelivery && (
              <>
                <Button
                  size="sm"
                  className="h-8 w-full sm:w-auto text-xs bg-green-600 hover:bg-green-700 cursor-pointer order-1 sm:order-none"
                  onClick={handleSubmitNewForApproval}
                  disabled={saving || uploadingProof || !canSubmitNewPayment}
                >
                  {saving ? "Processing..." : uploadingProof ? "Uploading..." : isZeroAmountSubmit ? "Submit (0)" : "Submit"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-full sm:w-auto text-xs cursor-pointer"
                  onClick={handleSaveDraft}
                  disabled={saving || uploadingProof || !canSubmitNewPayment}
                >
                  {saving ? "Saving..." : "Draft"}
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-full sm:w-auto sm:ml-auto text-xs cursor-pointer"
              onClick={onClose}
            >
              {financeLocked || remaining <= 0 ? "Close" : "Done"}
            </Button>
          </div>
        </div>
      </div>

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
