"use client"
import { useState, useEffect } from "react"
import { getQuotations, saveQuotation, deleteQuotation, generateQuotationNumber, type Quotation, type QuotationItem, STATUS_LABELS, STATUS_COLORS } from "@/lib/quotations"
import { getClients, type Client } from "@/lib/crm"
import { getInventoryItems, type InventoryItem } from "@/lib/purchase"
import { downloadQuotationPDF } from "@/lib/generate-quotation-pdf"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { Plus, X, Trash2, FileText, Edit, ShoppingCart } from "lucide-react"

export function QuotationsList({ currentUser }: { currentUser: string }) {
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Quotation | null>(null)
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Quotation | null>(null)

  useEffect(() => {
    Promise.all([getQuotations(), getClients()]).then(([q, c]) => {
      setQuotations(q); setClients(c); setLoading(false)
    })
  }, [])

  const filtered = quotations.filter(q => {
    const ms = (q.quotationNumber?.toLowerCase() || "").includes(search.toLowerCase()) || (q.clientName?.toLowerCase() || "").includes(search.toLowerCase())
    return ms && (statusFilter === "all" || q.status === statusFilter)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b">
          {["all","draft","sent","accepted","rejected","expired","converted"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${statusFilter===s?"text-[hsl(var(--foreground))]":"text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}>
              {s==="all"?"All":STATUS_LABELS[s as keyof typeof STATUS_LABELS]||s}
              {statusFilter===s&&<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]"/>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="h-8 px-3 rounded border bg-[hsl(var(--background))] text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] w-40"/>
          <Button size="sm" className="h-8 text-xs px-3 cursor-pointer" onClick={()=>setShowForm(true)}><Plus className="h-3.5 w-3.5 mr-1"/>Create Quotation</Button>
        </div>
      </div>
      {loading?(<div className="flex items-center justify-center py-20"><div className="h-8 w-8 rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent animate-spin"/></div>
      ):filtered.length===0?(<div className="flex flex-col items-center justify-center py-20 text-center"><FileText className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3"/><p className="text-sm text-[hsl(var(--muted-foreground))]">{quotations.length===0?"No quotations yet. Create your first one!":"No quotations match your filters."}</p></div>
      ):(<div className="rounded-lg border overflow-hidden"><table className="w-full"><thead><tr className="border-b bg-[hsl(var(--muted))]/40">
        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Quotation #</th>
        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Client</th>
        <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Items</th>
        <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total</th>
        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Valid Until</th>
        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
        <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Actions</th>
      </tr></thead><tbody className="divide-y">
        {filtered.map(q=>(
          <tr key={q.id} className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer" onClick={()=>setSelected(q)}>
            <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{q.quotationNumber}</td>
            <td className="px-4 py-2.5 text-xs font-medium">{q.clientName}</td>
            <td className="px-4 py-2.5 text-xs text-center">{q.items?.length||0}</td>
            <td className="px-4 py-2.5 text-xs text-right font-semibold">PKR {(q.total||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
            <td className="px-4 py-2.5"><span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status]}</span></td>
            <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{q.validUntil?new Date(q.validUntil).toLocaleDateString():"—"}</td>
            <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{q.createdAt?new Date(q.createdAt).toLocaleDateString():"—"}</td>
            <td className="px-4 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-center gap-2">
                <button onClick={()=>setEditingQuotation(q)} className="text-blue-500 hover:text-blue-700 cursor-pointer" title="Edit"><Edit className="h-3.5 w-3.5"/></button>
                <button onClick={()=>downloadQuotationPDF(q)} className="text-[#1a9f9a] hover:text-[#158a85] cursor-pointer" title="Download PDF"><FileText className="h-3.5 w-3.5"/></button>
                <button onClick={()=>setDeleteConfirm(q)} className="text-red-500 hover:text-red-700 cursor-pointer" title="Delete"><Trash2 className="h-3.5 w-3.5"/></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody></table></div>)}
      {showForm&&<QuotationForm currentUser={currentUser} clients={clients} onClose={()=>setShowForm(false)} onSave={q=>{setQuotations(prev=>[q,...prev.filter(x=>x.id!==q.id)]);setShowForm(false)}}/>}
      {editingQuotation&&<QuotationForm currentUser={currentUser} clients={clients} existing={editingQuotation} onClose={()=>setEditingQuotation(null)} onSave={q=>{setQuotations(prev=>prev.map(x=>x.id===q.id?q:x));setEditingQuotation(null)}}/>}
      {selected&&!editingQuotation&&<QuotationDetail quotation={selected} onClose={()=>setSelected(null)} onEdit={()=>{setEditingQuotation(selected);setSelected(null)}} onDelete={id=>{setQuotations(prev=>prev.filter(x=>x.id!==id));setSelected(null)}}/>}
      <ConfirmDialog isOpen={!!deleteConfirm} title="Delete Quotation" message={`Delete ${deleteConfirm?.quotationNumber}?`} confirmText="Delete" cancelText="Cancel" variant="danger"
        onConfirm={()=>{if(deleteConfirm){deleteQuotation(deleteConfirm.id);setQuotations(prev=>prev.filter(x=>x.id!==deleteConfirm.id))}setDeleteConfirm(null)}}
        onCancel={()=>setDeleteConfirm(null)}/>
    </div>
  )
}

// ─── Detail View ──────────────────────────────────────────────────────────────
function QuotationDetail({ quotation, onClose, onEdit, onDelete }: {
  quotation: Quotation; onClose: () => void; onEdit: () => void; onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await deleteQuotation(quotation.id)
    onDelete(quotation.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <p className="text-base font-bold text-[hsl(var(--primary))]">{quotation.quotationNumber}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{quotation.clientName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[quotation.status]}`}>{STATUS_LABELS[quotation.status]}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose}><X className="h-4 w-4"/></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Info Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Created</p>
              <p className="text-sm font-medium">{new Date(quotation.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Valid Until</p>
              <p className="text-sm font-medium">{quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "—"}</p>
            </div>
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Created By</p>
              <p className="text-sm font-medium">{quotation.createdBy}</p>
            </div>
          </div>

          {/* Delivery Address */}
          {quotation.deliveryAddress && (
            <div>
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Delivery Address</p>
              <p className="text-sm">{quotation.deliveryAddress}</p>
            </div>
          )}

          {/* Notes */}
          {quotation.notes && (
            <div>
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Notes</p>
              <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-3">
                {quotation.notes.split("\n").map((line, i) => (
                  <p key={i} className="text-sm">{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Items</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b bg-[hsl(var(--muted))]/40">
                  <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Description</th>
                  <th className="h-8 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-20">Qty</th>
                  <th className="h-8 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-16">Unit</th>
                  <th className="h-8 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-28">Unit Price</th>
                  <th className="h-8 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-28">Total</th>
                </tr></thead>
                <tbody className="divide-y">
                  {quotation.items.map(item => (
                    <tr key={item.id} className="hover:bg-[hsl(var(--muted))]/20">
                      <td className="px-3 py-2 text-xs">{item.description}</td>
                      <td className="px-3 py-2 text-xs text-center">{item.qty}</td>
                      <td className="px-3 py-2 text-xs text-center">{item.unit}</td>
                      <td className="px-3 py-2 text-xs text-right">PKR {item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-right font-medium">PKR {(item.qty * item.unitPrice).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Subtotal</span><span>PKR {quotation.subtotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              {(quotation.discountValue||0)>0&&<div className="flex justify-between text-red-600"><span>Discount {quotation.discountIsPercentage?`(${quotation.discount}%)`:""}</span><span>-PKR {(quotation.discountValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {quotation.taxPercent>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Tax ({quotation.taxPercent}%)</span><span>PKR {quotation.tax.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {quotation.transportCost>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">{quotation.transportLabel}</span><span>PKR {(quotation.transportCostValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {quotation.otherCost>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">{quotation.otherCostLabel}</span><span>PKR {(quotation.otherCostValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              <div className="flex justify-between pt-1.5 border-t font-bold text-sm"><span>Total</span><span className="text-[#1faca6]">PKR {quotation.total.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={onEdit}><Edit className="h-3.5 w-3.5 mr-1"/>Edit</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => downloadQuotationPDF(quotation)}><FileText className="h-3.5 w-3.5 mr-1"/>Download PDF</Button>
          <Button size="sm" variant="destructive" className="h-8 text-xs cursor-pointer ml-auto" onClick={handleDelete} disabled={deleting}><Trash2 className="h-3.5 w-3.5 mr-1"/>{deleting?"Deleting...":"Delete"}</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
