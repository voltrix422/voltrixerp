"use client"
import { useState } from "react"
import { type PurchaseOrder, type PODocument, type ImportedPOItem, type PaymentRecord, savePO } from "@/lib/purchase"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { X, Plus, Trash2, Upload } from "lucide-react"

interface Props {
  po: PurchaseOrder
  isAdmin: boolean
  role: string
  onClose: () => void
  onUpdate: (updated: PurchaseOrder) => void
}

function DocUploader({ docs, onAdd, uploaderLabel }: {
  docs: PODocument[]
  onAdd: (doc: PODocument) => void
  uploaderLabel: string
}) {
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function upload() {
    if (!name.trim() || !file) return
    setUploading(true)
    const ext = file.name.split(".").pop()
    const path = `imported-po-docs/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("erp-files").upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from("erp-files").getPublicUrl(path)
      onAdd({ id: Date.now().toString(), name: name.trim(), url: data.publicUrl, uploadedBy: uploaderLabel, uploadedAt: new Date().toISOString() })
      setName("")
      setFile(null)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      {docs.length > 0 && (
        <div className="space-y-1">
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between rounded-md border bg-[hsl(var(--muted))]/20 px-3 py-2">
              <div>
                <p className="text-xs font-medium">{d.name}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{d.uploadedBy} · {new Date(d.uploadedAt).toLocaleDateString()}</p>
              </div>
              <a href={d.url} target="_blank" rel="noreferrer" className="text-[10px] text-[hsl(var(--primary))] underline">View</a>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Document name"
          className="flex-1 h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        <input type="file" id={`file-${uploaderLabel}`} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        <label htmlFor={`file-${uploaderLabel}`}
          className="flex h-8 cursor-pointer items-center gap-1 rounded-md border bg-[hsl(var(--muted))]/40 px-3 text-xs hover:bg-[hsl(var(--muted))]/60">
          <Upload className="h-3 w-3" /> {file ? file.name.slice(0, 12) + "..." : "File"}
        </label>
        <Button type="button" size="sm" className="h-8 text-xs px-3" onClick={upload} disabled={uploading || !name.trim() || !file}>
          {uploading ? "..." : "Add"}
        </Button>
      </div>
    </div>
  )
}

function PaymentForm({ pssid, payments, onAdd }: {
  pssid?: string
  payments: PaymentRecord[]
  onAdd: (p: PaymentRecord) => void
}) {
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("Bank Transfer")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function submit() {
    if (!amount || Number(amount) <= 0) return
    setUploading(true)
    let proofUrl: string | undefined
    if (proofFile) {
      const ext = proofFile.name.split(".").pop()
      const path = `payment-proofs/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("erp-files").upload(path, proofFile, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from("erp-files").getPublicUrl(path)
        proofUrl = data.publicUrl
      }
    }
    onAdd({
      id: Date.now().toString(),
      amount: Number(amount),
      method,
      date,
      notes,
      proofUrl,
      createdAt: new Date().toISOString(),
    })
    setAmount("")
    setNotes("")
    setProofFile(null)
    setUploading(false)
  }

  return (
    <div className="space-y-3">
      {pssid && (
        <div className="rounded-md border bg-[hsl(var(--muted))]/20 px-3 py-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">PSSID</p>
          <p className="text-sm font-mono font-semibold">{pssid}</p>
        </div>
      )}
      {payments.length > 0 && (
        <div className="space-y-1">
          {payments.map(p => (
            <div key={p.id} className="rounded-md border bg-[hsl(var(--muted))]/10 px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">PKR {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{p.method} · {p.date}{p.notes ? ` · ${p.notes}` : ""}</p>
              </div>
              {p.proofUrl && (
                <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[hsl(var(--primary))] underline shrink-0 ml-3">Proof</a>
              )}
            </div>
          ))}
          <p className="text-xs font-bold text-right pr-1">
            Total Paid: PKR {payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}
      <div className="rounded-lg border p-3 space-y-2 bg-[hsl(var(--muted))]/10">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Add Payment</p>
        <div className="flex gap-2">
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Amount (PKR)"
            className="flex-1 h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]">
            <option>Bank Transfer</option>
            <option>Cheque</option>
            <option>Cash</option>
            <option>Online</option>
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
          className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        <div className="flex gap-2 items-center">
          <input type="file" id="proof-upload" className="hidden" accept="image/*,application/pdf"
            onChange={e => setProofFile(e.target.files?.[0] || null)} />
          <label htmlFor="proof-upload"
            className="flex h-8 cursor-pointer items-center gap-1 rounded-md border bg-[hsl(var(--muted))]/40 px-3 text-xs hover:bg-[hsl(var(--muted))]/60">
            <Upload className="h-3 w-3" /> {proofFile ? proofFile.name.slice(0, 16) + "..." : "Proof of Payment"}
          </label>
          <Button type="button" size="sm" className="h-8 text-xs px-3 ml-auto" onClick={submit}
            disabled={uploading || !amount || Number(amount) <= 0}>
            {uploading ? "..." : "Add Payment"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function FlowHistory({ po }: { po: PurchaseOrder }) {
  if (po.flowHistory.length === 0) return null
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Flow History</p>
      <div className="space-y-1.5">
        {po.flowHistory.map((h, i) => (
          <div key={i} className="flex items-start gap-3 text-xs">
            <div className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--border))] shrink-0" />
            <div>
              <span className="font-medium">{h.step}</span>
              <span className="text-[hsl(var(--muted-foreground))]"> · {h.actor}</span>
              {h.note && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{h.note}</p>}
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{new Date(h.doneAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReadonlySection({ po, showAll, onUpdate }: { po: PurchaseOrder; showAll?: boolean; onUpdate: (updated: PurchaseOrder) => void }) {
  const allDocs = [
    ...po.adminDocuments.map(d => ({ ...d, section: "Admin" })),
    ...po.financeDocuments1.map(d => ({ ...d, section: "Finance (Round 1)" })),
    ...po.purchaseDocuments.map(d => ({ ...d, section: "Purchase" })),
    ...(showAll ? po.financeDocuments2.map(d => ({ ...d, section: "Finance (Payment)" })) : []),
  ]
  return (
    <div className="space-y-4">
      {po.importedSupplierName && (
        <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">Supplier</p>
          <p className="text-sm font-semibold">{po.importedSupplierName}</p>
        </div>
      )}
      {po.importedItems.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Items</p>
          <div className="space-y-2">
            {po.importedItems.map(item => (
              <ItemCard key={item.id} item={item} po={po} onUpdate={onUpdate} />
            ))}
            
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Grand Total</span>
                <span>PKR {po.importedItems.reduce((s, i) => s + (i.unitPrice * i.qty) + (i.duties || []).reduce((sum, d) => sum + d.amount, 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {po.pssid && (
        <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">PSSID</p>
          <p className="text-sm font-mono font-semibold">{po.pssid}</p>
        </div>
      )}
      {showAll && po.payments && po.payments.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Payments</p>
          <div className="space-y-1">
            {po.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-md border bg-[hsl(var(--muted))]/10 px-3 py-2">
                <div>
                  <p className="text-xs font-semibold">PKR {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{p.method} · {p.date}{p.notes ? ` · ${p.notes}` : ""}</p>
                </div>
                {p.proofUrl && (
                  <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[hsl(var(--primary))] underline shrink-0 ml-3">Proof</a>
                )}
              </div>
            ))}
            <p className="text-xs font-bold text-right pr-1">
              Total Paid: PKR {po.payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}
      {allDocs.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Documents</p>
          <div className="space-y-1">
            {allDocs.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-md border bg-[hsl(var(--muted))]/10 px-3 py-2">
                <div>
                  <p className="text-xs font-medium">{d.name}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{d.section} · {d.uploadedBy} · {new Date(d.uploadedAt).toLocaleDateString()}</p>
                </div>
                <a href={d.url} target="_blank" rel="noreferrer" className="text-[10px] text-[hsl(var(--primary))] underline">View</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


function ItemCard({ item, po, onUpdate }: { item: ImportedPOItem, po: PurchaseOrder, onUpdate: (updated: PurchaseOrder) => void }) {
  // Load initial state from localStorage
  const [showDuties, setShowDuties] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`duties-show-${item.id}`)
      return saved === 'true'
    }
    return false
  })
  const [editingDuties, setEditingDuties] = useState(false)
  const [dutyName, setDutyName] = useState("")
  const [dutyAmount, setDutyAmount] = useState("")
  const [editingDutyId, setEditingDutyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; dutyId: string; dutyName: string }>({
    show: false,
    dutyId: "",
    dutyName: ""
  })
  
  // Save state to localStorage whenever it changes
  const toggleShowDuties = () => {
    const newState = !showDuties
    setShowDuties(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`duties-show-${item.id}`, String(newState))
    }
  }
  
  const itemTotal = item.unitPrice * item.qty
  const totalDuties = (item.duties || []).reduce((sum, d) => sum + d.amount, 0)
  const totalWithDuties = itemTotal + totalDuties
  
  const addDuty = () => {
    if (!dutyName.trim() || !dutyAmount || Number(dutyAmount) <= 0) {
      alert("Please enter valid duty name and amount")
      return
    }
    
    if (editingDutyId) {
      // Edit existing duty
      const updatedDuties = (item.duties || []).map(d =>
        d.id === editingDutyId ? { ...d, name: dutyName.trim(), amount: Number(dutyAmount) } : d
      )
      const updatedItems = po.importedItems.map(i =>
        i.id === item.id ? { ...i, duties: updatedDuties } : i
      )
      onUpdate({ ...po, importedItems: updatedItems })
      savePO({ ...po, importedItems: updatedItems })
      setEditingDutyId(null)
    } else {
      // Add new duty
      const newDuty = {
        id: Date.now().toString(),
        name: dutyName.trim(),
        amount: Number(dutyAmount)
      }
      
      const updatedDuties = [...(item.duties || []), newDuty]
      const updatedItems = po.importedItems.map(i =>
        i.id === item.id ? { ...i, duties: updatedDuties } : i
      )
      onUpdate({ ...po, importedItems: updatedItems })
      savePO({ ...po, importedItems: updatedItems })
    }
    
    setDutyName("")
    setDutyAmount("")
  }
  
  const editDuty = (duty: any) => {
    setDutyName(duty.name)
    setDutyAmount(duty.amount.toString())
    setEditingDutyId(duty.id)
  }
  
  const cancelEdit = () => {
    setDutyName("")
    setDutyAmount("")
    setEditingDutyId(null)
  }
  
  const removeDuty = (dutyId: string) => {
    const updatedDuties = (item.duties || []).filter(d => d.id !== dutyId)
    const updatedItems = po.importedItems.map(i =>
      i.id === item.id ? { ...i, duties: updatedDuties } : i
    )
    onUpdate({ ...po, importedItems: updatedItems })
    savePO({ ...po, importedItems: updatedItems })
    setConfirmDelete({ show: false, dutyId: "", dutyName: "" })
  }
  
  return (
    <div className="rounded-lg border bg-[hsl(var(--card))]">
      <div className="flex items-center justify-between p-3 bg-[hsl(var(--muted))]/20">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex-1">
            <p className="text-sm font-semibold">{item.description}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {item.qty} {item.unit} × PKR {item.unitPrice.toLocaleString()} = PKR {itemTotal.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Total with Duties</p>
            <p className="text-sm font-bold">PKR {totalWithDuties.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setEditingDuties(true)}
          >
            <Plus className="h-3 w-3 mr-1" /> Manage Duties
          </Button>
          {(item.duties || []).length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={toggleShowDuties}
            >
              {showDuties ? "Hide" : "Show"} ({item.duties?.length})
            </Button>
          )}
        </div>
      </div>
      
      {showDuties && (item.duties || []).length > 0 && (
        <div className="p-3 border-t bg-[hsl(var(--muted))]/10">
          <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Applied Duties:</p>
          <div className="space-y-1">
            {item.duties?.map(duty => (
              <div key={duty.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-[hsl(var(--muted))]/20">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[hsl(var(--muted-foreground))]">{duty.name}</span>
                  <span className="font-medium">PKR {duty.amount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      editDuty(duty)
                      setEditingDuties(true)
                    }}
                    className="text-blue-500 hover:text-blue-700 p-1"
                    title="Edit"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDelete({ show: true, dutyId: duty.id, dutyName: duty.name })
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs py-1 border-t pt-2 font-bold">
              <span>Total Duties</span>
              <span>PKR {totalDuties.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
      
      {editingDuties && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditingDuties(false)}>
          <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <p className="text-base font-bold">{editingDutyId ? "Edit Duty" : "Manage Duties"}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{item.description}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                setEditingDuties(false)
                cancelEdit()
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-4">
              {(item.duties || []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2">Current Duties:</p>
                  <div className="space-y-2">
                    {item.duties?.map(duty => (
                      <div key={duty.id} className="flex items-center justify-between p-2 rounded-md border bg-[hsl(var(--muted))]/20">
                        <div>
                          <p className="text-xs font-medium">{duty.name}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">PKR {duty.amount.toLocaleString()}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-500 hover:text-red-700"
                          onClick={() => removeDuty(duty.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="border-t pt-4">
                <p className="text-xs font-semibold mb-2">{editingDutyId ? "Edit Duty:" : "Add New Duty:"}</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={dutyName}
                    onChange={e => setDutyName(e.target.value)}
                    placeholder="Duty name (e.g., Customs Duty)"
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                  <input
                    type="number"
                    value={dutyAmount}
                    onChange={e => setDutyAmount(e.target.value)}
                    placeholder="Amount"
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                  <div className="flex gap-2">
                    {editingDutyId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={addDuty}
                    >
                      <Plus className="h-3 w-3 mr-1" /> {editingDutyId ? "Update Duty" : "Add Duty"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
              <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={() => {
                setEditingDuties(false)
                cancelEdit()
              }}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <ConfirmDialog
        isOpen={confirmDelete.show}
        title="Delete Duty"
        message={`Are you sure you want to delete the duty "${confirmDelete.dutyName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => removeDuty(confirmDelete.dutyId)}
        onCancel={() => setConfirmDelete({ show: false, dutyId: "", dutyName: "" })}
      />
    </div>
  )
}

export function ImportedPODetail({ po, isAdmin, role, onClose, onUpdate }: Props) {
  const [note, setNote] = useState("")
  const [supplierName, setSupplierName] = useState(po.importedSupplierName || "")
  const [pssid, setPssid] = useState(po.pssid || "")
  const [items, setItems] = useState<ImportedPOItem[]>(
    po.importedItems.length > 0
      ? po.importedItems
      : [{ id: Date.now().toString(), description: "", qty: 1, unit: "pcs", unitPrice: 0 }]
  )
  const [adminDocs, setAdminDocs] = useState<PODocument[]>(po.adminDocuments)
  const [finance1Docs, setFinance1Docs] = useState<PODocument[]>(po.financeDocuments1)
  const [purchaseDocs, setPurchaseDocs] = useState<PODocument[]>(po.purchaseDocuments)
  const [finance2Docs, setFinance2Docs] = useState<PODocument[]>(po.financeDocuments2)
  const [payments, setPayments] = useState<PaymentRecord[]>(po.payments ?? [])
  const [saving, setSaving] = useState(false)

  const itemsTotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0)

  function addItem() {
    setItems(prev => [...prev, { id: Date.now().toString(), description: "", qty: 1, unit: "pcs", unitPrice: 0 }])
  }

  function updateItem(id: string, key: string, value: string | number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))
  }

  function addFlowStep(step: string, actor: string, n: string) {
    return [...po.flowHistory, { step, actor, note: n, doneAt: new Date().toISOString() }]
  }

  async function transition(newStatus: PurchaseOrder["status"], stepLabel: string, actorLabel: string) {
    setSaving(true)
    const updated: PurchaseOrder = {
      ...po,
      status: newStatus,
      importedSupplierName: supplierName || po.importedSupplierName,
      importedItems: items,
      pssid: pssid || po.pssid,
      adminDocuments: adminDocs,
      financeDocuments1: finance1Docs,
      purchaseDocuments: purchaseDocs,
      financeDocuments2: finance2Docs,
      payments,
      flowHistory: addFlowStep(stepLabel, actorLabel, note),
    }
    await savePO(updated)
    onUpdate(updated)
    setNote("")
    setSaving(false)
  }

  const s = po.status

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[hsl(var(--muted))]/40 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-lg font-bold text-[hsl(var(--primary))]">{po.poNumber}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Imported PO</p>
            </div>
            <Badge variant="secondary" className="text-[10px]">{po.status.replace("imp_", "").replace(/_/g, " ")}</Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Always show PO details at the top for all statuses except admin draft */}
          {s !== "imp_admin_draft" && (
            <div className="mb-6">
              <ReadonlySection po={{ ...po, payments, financeDocuments2: finance2Docs }} showAll onUpdate={onUpdate} />
            </div>
          )}

          {/* STEP 1: Admin creates PO */}
          {s === "imp_admin_draft" && isAdmin && (
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Admin Documents</p>
                <DocUploader docs={adminDocs} onAdd={d => setAdminDocs(prev => [...prev, d])} uploaderLabel="Admin" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
              </div>
              <Button size="sm" className="h-8 text-xs" disabled={saving}
                onClick={() => transition("imp_purchase", "Admin created PO", "Admin")}>
                Send to Purchase
              </Button>
            </div>
          )}

          {/* STEP 2: Purchase fills in details + uploads docs */}
          {s === "imp_purchase" && (
            <div className="space-y-4">
              {po.adminDocuments.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Admin Documents</p>
                  {po.adminDocuments.map(d => (
                    <div key={d.id} className="flex items-center justify-between rounded-md border bg-[hsl(var(--muted))]/20 px-3 py-2 mb-1">
                      <p className="text-xs font-medium">{d.name}</p>
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-[10px] text-[hsl(var(--primary))] underline">View</a>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium">Supplier Name</label>
                <input value={supplierName} onChange={e => setSupplierName(e.target.value)}
                  placeholder="Enter supplier name"
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Items</p>
                  <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[hsl(var(--muted))]/40 border-b">
                        <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                        <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-14">Qty</th>
                        <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-14">Unit</th>
                        <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-24">Unit Price</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map(item => (
                        <tr key={item.id}>
                          <td className="px-2 py-1.5">
                            <input value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)}
                              className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="1" value={item.qty} onChange={e => updateItem(item.id, "qty", Number(e.target.value))}
                              className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)}
                              className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.id, "unitPrice", Number(e.target.value))}
                              className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                          </td>
                          <td className="px-1">
                            {items.length > 1 && (
                              <button type="button" onClick={() => setItems(p => p.filter(i => i.id !== item.id))}>
                                <Trash2 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] hover:text-red-500" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-1">
                  <p className="text-xs font-semibold">Total: PKR {itemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Purchase Documents</p>
                <DocUploader docs={purchaseDocs} onAdd={d => setPurchaseDocs(prev => [...prev, d])} uploaderLabel="Purchase" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
              </div>
              <Button size="sm" className="h-8 text-xs" disabled={saving || !supplierName}
                onClick={() => transition("imp_finance_1", "Purchase added items", "Purchase")}>
                Forward to Finance
              </Button>
            </div>
          )}

          {/* STEP 3: Finance round 1 */}
          {s === "imp_finance_1" && role === "finance" && (
            <div className="space-y-4">
              <ReadonlySection po={po} onUpdate={onUpdate} />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Finance Documents</p>
                <DocUploader docs={finance1Docs} onAdd={d => setFinance1Docs(prev => [...prev, d])} uploaderLabel="Finance" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
              </div>
              <Button size="sm" className="h-8 text-xs" disabled={saving}
                onClick={() => transition("imp_purchase_2", "Finance uploaded docs", "Finance")}>
                Send to Purchase
              </Button>
            </div>
          )}

          {/* STEP 4: Purchase round 2 */}
          {s === "imp_purchase_2" && (
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Purchase Documents</p>
                <DocUploader docs={purchaseDocs} onAdd={d => setPurchaseDocs(prev => [...prev, d])} uploaderLabel="Purchase" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">PSSID Number</label>
                <input value={pssid} onChange={e => setPssid(e.target.value)} placeholder="e.g. 123456789"
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
              </div>
              <Button size="sm" className="h-8 text-xs" disabled={saving || !pssid}
                onClick={() => transition("imp_pending_approval", "Purchase added PSSID", "Purchase")}>
                Send to Admin for Approval
              </Button>
            </div>
          )}

          {/* STEP 5: Admin approval */}
          {s === "imp_pending_approval" && isAdmin && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Admin Note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs" disabled={saving}
                  onClick={() => transition("imp_finance_2", "Admin approved", "Admin")}>
                  Approve
                </Button>
                <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={saving}
                  onClick={() => transition("imp_rejected", "Admin rejected", "Admin")}>
                  Reject
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: Finance round 2 - Add payments and documents */}
          {s === "imp_finance_2" && role === "finance" && (
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Payments Against PSSID</p>
                <PaymentForm pssid={po.pssid} payments={payments} onAdd={p => setPayments(prev => [...prev, p])} />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Payment Documents</p>
                <DocUploader docs={finance2Docs} onAdd={d => setFinance2Docs(prev => [...prev, d])} uploaderLabel="Finance" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
              </div>
              {payments.length > 0 && (
                <Button size="sm" className="h-8 text-xs" disabled={saving}
                  onClick={() => transition("imp_purchase_final", "Finance completed payments", "Finance")}>
                  Move to Purchase
                </Button>
              )}
            </div>
          )}

          {/* STEP 7: Purchase final - Approve and move to inventory */}
          {s === "imp_purchase_final" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Purchase Note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
              </div>
              <Button size="sm" className="h-8 text-xs" disabled={saving}
                onClick={() => transition("imp_inventory", "Purchase approved, moved to Inventory", "Purchase")}>
                Approve & Move to Inventory
              </Button>
            </div>
          )}

          {/* STEP 8: In Inventory - No action needed, just showing details */}
          {s === "imp_inventory" && (
            <div className="space-y-4">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">This PO is now in inventory for receiving.</p>
            </div>
          )}

          {/* Read-only message for users who can't take action */}
          {(s === "imp_rejected" ||
            (s === "imp_finance_1" && role !== "finance") ||
            (s === "imp_pending_approval" && !isAdmin) ||
            (s === "imp_finance_2" && role !== "finance") ||
            (s === "imp_purchase_final" && role === "finance") ||
            (s === "imp_purchase" && role === "finance") ||
            (s === "imp_purchase_2" && role === "finance")
          ) && (
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {s === "imp_rejected" ? "This PO has been rejected." : "Waiting for action from another department."}
              </p>
            </div>
          )}

          <FlowHistory po={po} />
        </div>

        <div className="flex items-center px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
