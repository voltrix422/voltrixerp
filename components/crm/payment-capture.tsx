"use client"
import { useState, useEffect, type ChangeEvent } from "react"
import {
  saveOrder,
  type Order,
  type OrderPayment,
  getOrderPaymentProofUrls,
  getPaymentSubmissionStatus,
  isPaymentEditable,
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
  const financeLocked = isOrderPaymentLocked(order)
  const postDelivery = isPostDeliveryPaymentCapture(order)
  const canAddPayments = canCapturePaymentsForOrder(order) && !financeLocked

  useEffect(() => {
    setPayments(order.payments || [])
  }, [order.id, order.payments, order.status])

  const draftPayments = getDraftPayments(payments, order.status)
  const totalSubmitted = getOrderAmountPaid({ ...order, payments })
  const totalDraft = draftPayments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = getOrderCreditBalance({ ...order, payments })
  const onCredit = isOrderOnCredit(order)

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
    if (!payment || !isPaymentEditable(payment, order.status)) return

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
    const isEditing = editingPaymentId === payment.id && !proofOnly

    return (
      <div key={payment.id} className="rounded-lg border p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {proofOnly
                ? `Delivery proof ${paymentNumber}`
                : `Payment ${paymentNumber} — PKR ${payment.amount.toLocaleString()}`}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {proofOnly
                ? new Date(payment.date).toLocaleDateString()
                : `${payment.method} · ${new Date(payment.date).toLocaleDateString()}`}
            </p>
            {payment.notes && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{payment.notes}</p>
            )}
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${PAYMENT_STATUS_COLORS[status]}`}>
            {PAYMENT_STATUS_LABELS[status]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {getOrderPaymentProofUrls(payment).map((proofUrl, proofIndex) => (
            <a
              key={`${payment.id}-${proofIndex}`}
              href={proofUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[hsl(var(--primary))] underline text-xs"
            >
              Proof {proofIndex + 1}
            </a>
          ))}
          {editable && (
            <label className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] cursor-pointer hover:underline">
              <Plus className="h-3 w-3" />
              Add proof
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={e => handleAddProofsToPayment(payment.id, e)}
              />
            </label>
          )}
        </div>

        {editable && (
          <div className="flex items-center gap-2 pt-1">
            {!proofOnly && status === "draft" && (
              <Button
                size="sm"
                className="h-7 text-xs cursor-pointer"
                onClick={() => handleSubmitDraft(payment.id)}
                disabled={saving || uploadingProof}
              >
                Submit for approval
              </Button>
            )}
            {!proofOnly && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs cursor-pointer"
                onClick={() => startEditPayment(payment)}
                disabled={saving}
              >
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 ml-auto"
              onClick={() => setDeletePaymentId(payment.id)}
              disabled={saving}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
        <div className="w-full sm:max-w-3xl rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-base sm:text-lg font-bold text-[hsl(var(--primary))] truncate">
                Capture Payment — {order.orderNumber}
              </p>
              <div className="mt-2 space-y-1 text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">
                <p>
                  <span className="font-medium text-[hsl(var(--foreground))]">Total:</span>{" "}
                  PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p>
                  <span className="font-medium text-[hsl(var(--foreground))]">Submitted:</span>{" "}
                  PKR {totalSubmitted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p>
                  <span className="font-medium text-[hsl(var(--foreground))]">Remaining:</span>{" "}
                  PKR {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                {totalDraft > 0 && (
                  <p className="text-[11px]">
                    Draft (not sent to finance): PKR {totalDraft.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 cursor-pointer" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
              </div>
            )}

            {financeLocked ? (
              <div className="rounded-lg border bg-green-50 dark:bg-green-950 p-4">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  {onCredit && remaining > 0
                    ? "This order is fully paid in the system. No further payments can be added."
                    : "Finance has approved this order. You can no longer add or edit payment proofs."}
                </p>
              </div>
            ) : postDelivery ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-3 sm:p-4">
                <p className="text-xs sm:text-sm font-medium text-emerald-900 dark:text-emerald-100 leading-snug">
                  This order is delivered. Attach delivery or payment proof here — it is saved on the order only and does not change the paid balance or go to Finance.
                </p>
              </div>
            ) : onCredit && remaining > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3 sm:p-4">
                <p className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-100 leading-snug">
                  This order was sent to inventory on credit. Add further payments here; Finance tracks the outstanding balance until cleared.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-3 sm:p-4">
                <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100 leading-snug">
                  Add multiple payments (Payment 1, Payment 2, …). Each payment you submit is sent to Finance with its proofs. Use amount 0 for full credit (no proof required). Finance can approve full payment or send the order on credit to inventory.
                </p>
              </div>
            )}

            {payments.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Recorded payments</p>
                {payments.map((payment, index) => renderPaymentRow(payment, index + 1))}
              </div>
            )}

            {canAddPayments && (
              <>
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-4">
                    {postDelivery
                      ? payments.length > 0
                        ? "Attach another proof"
                        : "Attach delivery proof"
                      : payments.length > 0
                        ? "Add another payment"
                        : "Add payment"}
                  </p>
                </div>

                {!postDelivery && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Payment Amount *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Payment Method *</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] cursor-pointer"
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

                {!postDelivery && (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Payment Date *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                  />
                </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium">{postDelivery ? "Notes (optional)" : "Payment Notes (optional)"}</label>
                  <textarea
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border bg-[hsl(var(--background))] px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
                    placeholder="Transaction ID, reference number, etc."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">
                    {postDelivery ? "Proof attachment *" : `Payment Proof (optional${postDelivery ? "" : " — required to submit for approval"})`}
                  </label>
                  <label className="flex items-center justify-center gap-2 h-10 rounded-md border border-dashed bg-[hsl(var(--background))] px-3.5 text-sm cursor-pointer hover:bg-[hsl(var(--muted))]/30">
                    <Upload className="h-4 w-4" />
                    <span>Upload proof files</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={handleProofFilesChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    {postDelivery
                      ? "Upload a receipt, screenshot, or delivery proof. This does not add to the order balance."
                      : isZeroAmountSubmit
                        ? "Not required for amount 0 (full credit request)."
                        : "Required to submit for approval. You can add more proofs later before finance approves."}
                  </p>
                  {paymentProofFiles.length > 0 && (
                    <div className="space-y-2">
                      {paymentProofFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                          <span className="truncate pr-3">{file.name}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 cursor-pointer text-red-600"
                            onClick={() => removeProofFile(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {canAddPayments && !postDelivery && payments.length === 0 && !orderHasPendingFinancePayments({ ...order, payments }) && (
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-full sm:w-auto text-sm border-amber-500 text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40 cursor-pointer"
                onClick={handleSubmitFullCreditForApproval}
                disabled={saving || uploadingProof}
              >
                {saving ? "Submitting..." : "Submit for approval (full credit, no payment)"}
              </Button>
            )}
            {canAddPayments && postDelivery && (
              <Button
                size="sm"
                className="h-10 w-full sm:w-auto text-sm bg-green-600 hover:bg-green-700 cursor-pointer order-1 sm:order-none"
                onClick={handleAttachPostDeliveryProof}
                disabled={saving || uploadingProof || paymentProofFiles.length === 0}
              >
                {saving ? "Saving..." : uploadingProof ? "Uploading..." : "Attach proof"}
              </Button>
            )}
            {canAddPayments && !postDelivery && (
              <>
                <Button
                  size="sm"
                  className="h-10 w-full sm:w-auto text-sm bg-green-600 hover:bg-green-700 cursor-pointer order-1 sm:order-none"
                  onClick={handleSubmitNewForApproval}
                  disabled={saving || uploadingProof || !canSubmitNewPayment}
                >
                  {saving ? "Processing..." : uploadingProof ? "Uploading..." : isZeroAmountSubmit ? "Submit for approval (amount 0)" : "Submit for approval"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 w-full sm:w-auto text-sm cursor-pointer"
                  onClick={handleSaveDraft}
                  disabled={saving || uploadingProof || !canSubmitNewPayment}
                >
                  {saving ? "Saving..." : "Save as draft"}
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-10 w-full sm:w-auto sm:ml-auto text-sm cursor-pointer"
              onClick={onClose}
            >
              {financeLocked || remaining <= 0 ? "Close" : "Done"}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deletePaymentId !== null}
        title="Delete Payment"
        message="Are you sure you want to delete this payment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deletePaymentId && handleDeletePayment(deletePaymentId)}
        onCancel={() => setDeletePaymentId(null)}
      />
    </>
  )
}
