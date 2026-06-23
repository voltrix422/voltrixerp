"use client"
import { useState, useEffect, useMemo } from "react"
import {
  getPettyCashAllocations,
  getPettyCashReceipts,
  createPettyCashReceipt,
  type PettyCashReceipt as PettyCashReceiptType,
} from "@/lib/petty-cash"
import { formatPettyCashBalance, formatPettyCashExpense, sumPendingReceipts } from "@/lib/petty-cash-display"
import { findPersonalLedger, getLedgerBalance } from "@/lib/petty-cash-personal"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Upload, Receipt, X } from "lucide-react"

interface PettyCashReceiptProps {
  onClose: () => void
  onSave: (receipt: PettyCashReceiptType) => void
  employeeName?: string
  employeeId?: string
  employeeRole?: string
}

export function PettyCashReceipt({
  onClose,
  onSave,
  employeeName,
  employeeId,
  employeeRole = "Employee",
}: PettyCashReceiptProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [balance, setBalance] = useState(0)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [receiptProof, setReceiptProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const resolvedId = employeeId || user?.id || ""
  const resolvedName = employeeName || user?.name || ""

  useEffect(() => {
    if (!resolvedId && !resolvedName) {
      setDataLoading(false)
      return
    }
    setDataLoading(true)
    Promise.all([getPettyCashAllocations(), getPettyCashReceipts()])
      .then(([allocations, receipts]) => {
        const ledger = findPersonalLedger(allocations, resolvedId, resolvedName)
        const myReceipts = receipts.filter(
          (r) =>
            r.employeeName.trim().toLowerCase() === resolvedName.trim().toLowerCase() ||
            (ledger && r.allocationId === ledger.id),
        )
        if (ledger) {
          setBalance(getLedgerBalance(ledger, receipts))
          setPendingTotal(sumPendingReceipts(receipts, ledger.id))
        } else {
          setBalance(0)
          setPendingTotal(sumPendingReceipts(myReceipts))
        }
      })
      .catch((err) => console.error("Error loading petty cash balance:", err))
      .finally(() => setDataLoading(false))
  }, [resolvedId, resolvedName])

  const balanceAfter = useMemo(() => {
    const next = parseFloat(amount)
    if (!Number.isFinite(next) || Math.abs(next) < 0.004) return balance
    return balance - next
  }, [balance, amount])

  async function handleFileUpload(file: File): Promise<string> {
    const formData = new FormData()
    formData.append("files", file)
    formData.append("folder", "petty-cash")
    const response = await fetch("/api/upload", { method: "POST", body: formData })
    if (!response.ok) throw new Error("Failed to upload file")
    const data = await response.json()
    return data.urls[0]
  }

  async function submit() {
    if (!resolvedId || !resolvedName) {
      toast({ title: "Error", message: "Could not identify your account. Please log in again.", type: "error" })
      return
    }
    if (!description || !amount || !receiptProof) {
      toast({
        title: "Missing information",
        message: "Description, amount, and receipt proof are required",
        type: "error",
      })
      return
    }
    const parsedAmount = parseFloat(amount)
    if (!Number.isFinite(parsedAmount) || Math.abs(parsedAmount) < 0.004) {
      toast({
        title: "Invalid amount",
        message: "Amount must be non-zero. Use negative values (e.g. -500) when needed.",
        type: "error",
      })
      return
    }

    setLoading(true)
    try {
      let receiptProofUrl = ""
      let receiptProofFileName = ""
      if (receiptProof) {
        setUploading(true)
        receiptProofUrl = await handleFileUpload(receiptProof)
        receiptProofFileName = receiptProof.name
        setUploading(false)
      }

      const receipt = await createPettyCashReceipt({
        employeeId: resolvedId,
        employeeName: resolvedName,
        employeeRole,
        description,
        amount: parsedAmount,
        receiptProof: receiptProofUrl || undefined,
        receiptProofName: receiptProofFileName || undefined,
        notes: notes.trim(),
        selfSubmit: false,
        submittedBy: user?.name || resolvedName,
      })

      toast({
        title: "Sent for approval",
        message: "Admin will review your receipt. Your balance updates after approval.",
        type: "success",
      })
      onSave(receipt)
      onClose()
    } catch (error) {
      console.error("Error creating petty cash receipt:", error)
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to add receipt",
        type: "error",
      })
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-600" />
            <p className="text-lg font-bold">Add Receipt</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <span className="font-semibold">Your petty cash balance</span>
              <br />
              Add a receipt anytime. Admin must approve before it counts. You can enter negative amounts (for adjustments/reversals).
            </p>
            <p className="text-lg font-bold mt-2 text-blue-900 dark:text-blue-100">
              {dataLoading ? "…" : formatPettyCashBalance(balance)}
            </p>
            {!dataLoading && pendingTotal > 0 && (
              <p className="text-xs mt-1 text-amber-700 dark:text-amber-300">
                Pending approval: {formatPettyCashExpense(pendingTotal)}
              </p>
            )}
            {amount && Number.isFinite(Number.parseFloat(amount)) && !dataLoading && (
              <p className="text-xs mt-1 text-[hsl(var(--muted-foreground))]">
                If approved:{" "}
                <span className={balanceAfter < 0 ? "text-red-600 font-semibold" : "font-medium"}>
                  {formatPettyCashBalance(balanceAfter)}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Description *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you pay for?"
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Amount (PKR) *
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1500 or -1500"
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Positive = expense, negative = adjustment/reversal. Admin approval required.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Receipt / proof *
            </label>
            <div className="border-2 border-dashed border-[hsl(var(--muted-foreground))] rounded-lg p-4">
              <input
                type="file"
                id="receipt-proof"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptProof(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="receipt-proof"
                className="flex flex-col items-center justify-center cursor-pointer text-center"
              >
                <Upload className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-2" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {receiptProof ? receiptProof.name : "Upload receipt photo or PDF"}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 ml-auto"
            onClick={submit}
            disabled={loading || uploading || dataLoading}
          >
            {loading || uploading ? "Saving…" : "Add Receipt"}
          </Button>
        </div>
      </div>
    </div>
  )
}
