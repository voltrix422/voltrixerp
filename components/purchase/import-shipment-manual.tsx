"use client"

import { BookOpen, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

/** Collapsible help — keep closed by default so the main flow stays clean */
export function ImportShipmentManual({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-md border bg-[hsl(var(--card))] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[hsl(var(--muted))]/30 cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <div className="min-w-0">
            <p className="text-xs font-semibold">Help · How to use Imported Purchases</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
              Pakistan import flow · containers · PSW · landed cost per item
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-4 pt-1 border-t space-y-4 text-sm leading-relaxed">
          <section className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">What this module does</h3>
            <p className="text-xs text-[hsl(var(--foreground))]/90">
              Track one <strong>import shipment</strong> from foreign supplier contract through PSW clearance,
              capture every cost, then calculate <strong>landed cost per item</strong>.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">6-step flow</h3>
            <ol className="list-decimal pl-4 space-y-1.5 text-xs">
              <li>
                <strong>Basics</strong> — Supplier, contract, FX. Same tab has a separate <strong>Shipping</strong> section (B/L, vessel, IGM).
              </li>
              <li>
                <strong>Invoice</strong> — Containers + line items with actual / declared / assessed prices. Upload commercial invoice &amp; packing list.
              </li>
              <li>
                <strong>PSW</strong> — GD and multiple PSIDs (payment slips). Enter duties and SROs per invoice item, plus shared cess duties at the end.
              </li>
              <li>
                <strong>Charges</strong> — Freight, clearing, transport, bank — shared vs item-specific.
              </li>
              <li>
                <strong>Landed Cost</strong> — Choose how to allocate shared costs, calculate, then lock unit landed cost.
              </li>
              <li>
                <strong>Receive</strong> — Warehouse qty, GRN, mark received.
              </li>
            </ol>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Landed cost formula</h3>
            <div className="rounded-md border bg-[hsl(var(--muted))]/20 p-2.5 font-mono text-[11px] space-y-0.5">
              <p>Product PKR = Qty × Actual unit price × FX</p>
              <p>Shared costs → split across items</p>
              <p>Direct costs (duty on one HS) → that item only</p>
              <p className="pt-1 font-semibold">Unit landed = (Product + Shared + Direct) ÷ Received qty</p>
            </div>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">How shared charges are split</h3>
            <p className="text-xs text-[hsl(var(--foreground))]/90">
              Shared charges are split using whatever you pick on the <strong>Landed</strong> step under{" "}
              <strong>Allocate shared costs by</strong>. Default is <strong>invoice value</strong>, not weight or volume.
            </p>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              <li><strong>Invoice value</strong> (default) — each item’s share of qty × price × FX.</li>
              <li><strong>Weight</strong> — item net kg (else gross / legacy kg).</li>
              <li><strong>Quantity</strong> — item qty.</li>
              <li><strong>CBM</strong> — item volume.</li>
            </ul>
            <p className="text-xs text-[hsl(var(--foreground))]/90">
              Formula: item gets <em>charge × (item basis ÷ sum of all bases)</em>.
              If bases total zero, costs split equally. <strong>Direct</strong> charges and PSW duties
              linked to one item go only to that item and are not split.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Pakistan / PSW tips</h3>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              <li><strong>PSW</strong> — portal where the Goods Declaration (GD) is filed.</li>
              <li><strong>PSID</strong> — payment slip ID(s) for duties/taxes; add PSID 1, PSID 2… and attach named receipts.</li>
              <li><strong>SRO</strong> — save SROs in the library on the list page, then quick-add on each GD.</li>
              <li><strong>IGM</strong> — from the shipping line when the vessel manifests.</li>
              <li>Use correct <strong>HS code</strong> per item; enter actual / declared / assessed prices separately.</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
