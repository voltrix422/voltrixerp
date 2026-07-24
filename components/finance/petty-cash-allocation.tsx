"use client"
import { useState, useEffect } from "react"
import { getUsers, ROLE_LABELS, type User } from "@/lib/auth"
import { createPettyCashAllocation, type PettyCashAllocation } from "@/lib/petty-cash"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { X, Upload, DollarSign } from "lucide-react"

interface PettyCashAllocationProps {
  onClose: () => void
  onSave: (allocation: PettyCashAllocation) => void
}

export function PettyCashAllocation({ onClose, onSave }: PettyCashAllocationProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [userSearch, setUserSearch] = useState("")

  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [amount, setAmount] = useState("")
  const [purpose, setPurpose] = useState("")
  const [notes, setNotes] = useState("")
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    getUsers()
      .then((list) =>
        setUsers(
          list
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
        ),
      )
      .catch((error) => {
        console.error("Error loading users for petty cash:", error)
      })
  }, [])

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase().trim()
    if (!q) return true
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      ROLE_LABELS[u.role].toLowerCase().includes(q)
    )
  })

  async function handleFileUpload(file: File): Promise<string> {
    const formData = new FormData()
    formData.append("files", file)
    formData.append("folder", "petty-cash")

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Failed to upload file")
    }

    const data = await response.json()
    return data.urls[0]
  }

  async function submit() {
    if (!selectedUser || !amount || !purpose) {
      toast({
        title: "Missing Information",
        message: "Please fill in all required fields",
        type: "error",
      })
      return
    }

    setLoading(true)

    try {
      let paymentProofUrl = ""
      let paymentProofFileName = ""

      if (paymentProof) {
        setUploading(true)
        paymentProofUrl = await handleFileUpload(paymentProof)
        paymentProofFileName = paymentProof.name
        setUploading(false)
      }

      const roleLabel = ROLE_LABELS[selectedUser.role] || "User"

      const allocation = await createPettyCashAllocation({
        employeeId: selectedUser.id,
        employeeName: selectedUser.name,
        employeeRole: roleLabel,
        amount: parseFloat(amount),
        purpose,
        paymentProof: paymentProofUrl || undefined,
        paymentProofName: paymentProofFileName || undefined,
        notes: notes.trim(),
        allocatedBy: user?.name || "Unknown",
      })

      toast({
        title: "Success",
        message: `Petty cash of PKR ${amount} allocated to ${selectedUser.name}`,
        type: "success",
      })

      onSave(allocation)
      onClose()
    } catch (error) {
      console.error("Error creating petty cash allocation:", error)
      toast({
        title: "Error",
        message: "Failed to allocate petty cash",
        type: "error",
      })
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <p className="text-lg font-bold">Allocate Petty Cash</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2 relative">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Select Employee *
            </label>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              From Manage Users — cash is tied to the login account ID.
            </p>
            <button
              type="button"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] flex items-center justify-between cursor-pointer"
            >
              <span className={selectedUser ? "" : "text-[hsl(var(--muted-foreground))]"}>
                {selectedUser
                  ? `${selectedUser.name} · ${ROLE_LABELS[selectedUser.role]}`
                  : "Choose a user account..."}
              </span>
              <svg className="h-5 w-5 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
                <div className="absolute z-20 w-full mt-1 max-h-80 overflow-auto rounded-md border bg-[hsl(var(--background))] shadow-lg">
                  <div className="p-3 border-b">
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search name, email, or role..."
                      className="w-full h-9 rounded border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                      autoFocus
                    />
                  </div>
                  {filteredUsers.length === 0 ? (
                    <div className="px-3.5 py-4 text-sm text-[hsl(var(--muted-foreground))]">
                      No users found in Manage Users
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedUser(u)
                          setShowUserDropdown(false)
                          setUserSearch("")
                        }}
                        className="px-3.5 py-2.5 text-sm cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/30 border-t"
                      >
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {u.email} · {ROLE_LABELS[u.role]}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Amount (PKR) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Purpose *
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Office supplies, travel expenses"
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or instructions"
              rows={3}
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Payment Proof (Optional)
            </label>
            <div className="border-2 border-dashed border-[hsl(var(--muted-foreground))] rounded-lg p-4">
              <input
                type="file"
                id="payment-proof"
                accept="image/*,.pdf"
                onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="payment-proof"
                className="flex flex-col items-center justify-center cursor-pointer text-center"
              >
                <Upload className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-2" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {paymentProof ? paymentProof.name : "Click to upload payment proof"}
                </span>
                <span className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Images or PDF files
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
            className="h-8 text-xs bg-green-600 hover:bg-green-700 ml-auto"
            onClick={submit}
            disabled={loading || uploading}
          >
            {loading || uploading ? "Processing..." : "Allocate Cash"}
          </Button>
        </div>
      </div>
    </div>
  )
}
