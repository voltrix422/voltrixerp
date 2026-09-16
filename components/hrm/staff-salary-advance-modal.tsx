"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  createSalaryAdvance,
  deleteSalaryAdvance,
  fetchSalaryAdvances,
  sumOutstandingAdvances,
  type SalaryAdvance,
} from "@/lib/hrm-salary-advances"
import { X, Upload, Trash2 } from "lucide-react"

type StaffLike = {
  id: string
  name: string
  role: string
  currency: string
}

type Props = {
  staff: StaffLike
  givenBy: string
  onClose: () => void
  onUpdate: () => void
}

export function StaffSalaryAdvanceModal({ staff, givenBy, onClose, onUpdate }: Props) {
  const { toast } = useToast()
  const [advances, setAdvances] = useState<SalaryAdvance[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchSalaryAdvances(staff.id)
      .then(setAdvances)
      .catch(() => toast({ title: "Error", message: "Failed to load advances", type: "error" }))
      .finally(() => setLoading(false))
  }, [staff.id, toast])

  const outstanding = sumOutstandingAdvances(advances)
  const currency = staff.currency || "PKR"

  async function uploadProof(file: File) {
    const formData = new FormData()
    formData.append("files", file)
    formData.append("folder", "hrm-advances")
    const res = await fetch("/api/upload", { method: "POST", body: formData })
    if (!res.ok) throw new Error("Failed to upload proof")
    const data = await res.json()
    return { url: data.urls[0] as string, name: file.name }
  }

  async function handleSubmit() {
    const parsed = Number(amount)
    if (!reason.trim()) {
      toast({ title: "Missing reason", message: "Please enter why this advance is given.", type: "error" })
      return
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: "Invalid amount", message: "Advance amount must be greater than zero.", type: "error" })
      return
    }

    setSaving(true)
    try {
      let proofUrl: string | undefined
      let proofName: string | undefined
      if (proofFile) {
        setUploading(true)
        const uploaded = await uploadProof(proofFile)
        proofUrl = uploaded.url
        proofName = uploaded.name
        setUploading(false)
      }

      const created = await createSalaryAdvance({
        staffId: staff.id,
        amount: parsed,
        currency,
        reason: reason.trim(),
        notes: notes.trim(),
        givenBy,
        proofUrl,
        proofName,
      })
      setAdvances((prev) => [created, ...prev])
      setAmount("")
      setReason("")
      setNotes("")
      setProofFile(null)
      toast({
        title: "Advance recorded",
        message: `${currency} ${parsed.toLocaleString()} advance added for ${staff.name}.`,
        type: "success",
      })
      onUpdate()
    } catch (error) {
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to record advance",
        type: "error",
      })
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  async function handleDelete(advance: SalaryAdvance) {
    const message =
      advance.status === "outstanding"
        ? `Delete this advance of ${currency} ${advance.amount.toLocaleString()}? The outstanding balance will be reduced.`
        : advance.status === "recovered"
          ? `This advance was recovered in ${advance.recoveredInMonth || "payroll"}. Delete it permanently?`
          : `Remove this cancelled advance from history?`

    if (!window.confirm(message)) return

    try {
      await deleteSalaryAdvance(advance.id, givenBy)
      setAdvances((prev) => prev.filter((a) => a.id !== advance.id))
      toast({ title: "Advance deleted", type: "success" })
      onUpdate()
    } catch (error) {
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to delete advance",
        type: "error",
      })
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div
        className="w-full max-w-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
          <div>
            <p className="text-sm font-semibold">Salary Advance</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{staff.name} · {staff.role}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-[hsl(var(--muted-foreground))]" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          <div className="border border-[hsl(var(--border))] px-3 py-2">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Outstanding advance balance</p>
            <p className="text-sm font-semibold tabular-nums mt-0.5">
              {currency} {outstanding.toLocaleString()}
            </p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
              Deducted automatically when you run payroll for this employee.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold">Give new advance</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-[hsl(var(--muted-foreground))]">Amount ({currency}) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full h-7 border border-[hsl(var(--border))] bg-transparent px-2 text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[hsl(var(--muted-foreground))]">Reason *</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Emergency advance"
                  className="w-full h-7 border border-[hsl(var(--border))] bg-transparent px-2 text-xs focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[hsl(var(--muted-foreground))]">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-xs resize-none focus:outline-none"
                placeholder="Optional details"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[hsl(var(--muted-foreground))]">Payment proof (optional)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="w-full text-[11px]"
              />
            </div>
            <Button
              variant="outline"
              className="h-7 px-3 text-[11px] w-full gap-1"
              onClick={handleSubmit}
              disabled={saving || uploading}
            >
              <Upload className="h-3 w-3" />
              {saving || uploading ? "Saving..." : "Record Advance"}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold">Advance history</p>
            {loading ? (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Loading...</p>
            ) : advances.length === 0 ? (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No advances recorded yet.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {advances.map((advance) => (
                  <div key={advance.id} className="border border-[hsl(var(--border))] px-2 py-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{advance.reason}</p>
                        <p className="text-[hsl(var(--muted-foreground))] mt-0.5">
                          {currency} {advance.amount.toLocaleString()} · {new Date(advance.givenAt).toLocaleString()}
                        </p>
                        <p className="text-[hsl(var(--muted-foreground))]">By {advance.givenBy}</p>
                        {advance.recoveredInMonth && (
                          <p className="text-[hsl(var(--muted-foreground))] mt-1">Recovered in {advance.recoveredInMonth}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] capitalize text-[hsl(var(--muted-foreground))]">
                        {advance.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <div>
                        {advance.proofUrl && (
                          <a
                            href={advance.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            View proof
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-[11px] text-[hsl(var(--muted-foreground))] underline cursor-pointer inline-flex items-center gap-1"
                        onClick={() => handleDelete(advance)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
