"use client"
import { useState, type ChangeEvent } from "react"
import { saveOrder, type Order, type OrderPayment, getOrderPaymentProofUrls } from "@/lib/orders"
import { uploadFile } from "@/lib/upload"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { X, Upload, Trash2 } from "lucide-react"

export function PaymentCapture({ order, currentUser, onClose, onUpdate }: {
  order: Order
  currentUser: string
  onClose: () => void
  onUpdate: (o: Order) => void
}) {
  const [paymentAmount, setPaymentAmount] = useState(order.total.toString())
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentProofFiles, setPaymentProofFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)

  async function handleAddPayment() {
    setError(null)
    
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setError("Please enter a valid payment amount")
      return
    }

    const totalPaid = (order.payments || []).reduce((sum, p) => sum + p.amount, 0)
    const remaining = order.total - totalPaid
    
    if (Number(paymentAmount) > remaining) {
      setError(`Payment amount cannot exceed remaining balance of PKR ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
      return
    }

    if (paymentProofFiles.length === 0) {
      setError("At least one payment proof image or document is required")
      return
    }

    setSaving(true)

    let proofUrls: string[] = []
    setUploadingProof(true)
    try {
      proofUrls = await Promise.all(
        paymentProofFiles.map((file) => uploadFile(file, "payment-proofs")),
      )
    } catch {
      setUploadingProof(false)
      setSaving(false)
      setError("Failed to upload one or more payment proof files")
      return
    }
    setUploadingProof(false)

    const payment: OrderPayment = {
      id: Date.now().toString(),
      amount: Number(paymentAmount),
      method: paymentMethod,
      date: paymentDate,
      notes: paymentNotes,
      proofUrls,
      proofUrl: proofUrls[0],
      createdAt: new Date().toISOString(),
      createdBy: currentUser,
    }

    const updated: Order = {
      ...order,
      payments: [...(order.payments || []), payment],
      status: "payment_added",
    }

    await saveOrder(updated)
    
    // Inventory will be deducted when order status changes to "delivered"
    
    onUpdate(updated)
    setSaving(false)
    onClose()
  }

  async function handleDeletePayment(paymentId: string) {
    const updated: Order = {
      ...order,
      payments: (order.payments || []).filter(p => p.id !== paymentId)
    }
    await saveOrder(updated)
    onUpdate(updated)
    setDeletePaymentId(null)
  }

  function handleProofFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      setPaymentProofFiles((prev) => [...prev, ...files])
    }
    event.target.value = ""
  }

  function removeProofFile(index: number) {
    setPaymentProofFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))
  }

  const totalPaid = (order.payments || []).reduce((sum, p) => sum + p.amount, 0)
  const remaining = order.total - totalPaid

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-8 py-5 border-b shrink-0">
            <div>
              <p className="text-xl font-bold text-[hsl(var(--primary))]">Capture Payment - {order.orderNumber}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Total: PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} | 
                Paid: PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} | 
                Remaining: PKR {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
              </div>
            )}

            {order.payments && order.payments.length > 0 && (
              <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4">
                <p className="text-sm font-semibold mb-3">Previous Payments</p>
                <div className="space-y-3">
                  {order.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm border-b pb-3 last:border-0">
                      <div>
                        <p className="font-medium">PKR {p.amount.toLocaleString()}</p>
                        <p className="text-[hsl(var(--muted-foreground))]">{p.method} · {new Date(p.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {getOrderPaymentProofUrls(p).map((proofUrl, proofIndex) => (
                          <a
                            key={`${p.id}-${proofIndex}`}
                            href={proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[hsl(var(--primary))] underline cursor-pointer"
                          >
                            Proof {proofIndex + 1}
                          </a>
                        ))}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => setDeletePaymentId(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Add new payment details from the client. Finance will review the payment before the order is sent to inventory.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-1">
              <label className="text-xs font-medium">Payment Date *</label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Payment Notes</label>
              <textarea
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-[hsl(var(--background))] px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
                placeholder="Transaction ID, reference number, etc."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Payment Proof (Receipt/Screenshot) *</label>
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
                You can upload multiple receipts, screenshots, or PDF files for one payment.
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
                        className="h-7 w-7 p-0 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => removeProofFile(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 px-8 py-5 border-t bg-[hsl(var(--muted))]/20 shrink-0">
            <Button size="sm" className="h-10 text-sm bg-green-600 hover:bg-green-700 cursor-pointer" onClick={handleAddPayment} disabled={saving || uploadingProof}>
              {saving ? "Processing..." : uploadingProof ? "Uploading..." : "Submit Payment for Approval"}
            </Button>
            <Button size="sm" variant="outline" className="h-10 text-sm ml-auto cursor-pointer" onClick={onClose}>Cancel</Button>
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
