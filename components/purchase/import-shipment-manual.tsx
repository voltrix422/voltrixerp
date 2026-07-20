"use client"

import { BookOpen, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

export function ImportShipmentManual() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border bg-[hsl(var(--card))] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[hsl(var(--muted))]/30 cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">How to use Imported Purchases</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
              Pakistan import flow · containers · PSW · landed cost per item
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-5 pt-1 border-t space-y-5 text-sm leading-relaxed">
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">What this module does</h3>
            <p className="text-[13px] text-[hsl(var(--foreground))]/90">
              Track one <strong>import shipment</strong> (often one or more containers) from foreign supplier contract
              through PSW customs clearance, capture every cost, then calculate <strong>landed cost per item</strong>
              — the true PKR cost of each product sitting in your warehouse.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">7-step flow (follow in order)</h3>
            <ol className="list-decimal pl-5 space-y-2 text-[13px]">
              <li>
                <strong>Basics &amp; Contract</strong> — Select imported supplier, contract/PO ref, Incoterms (FOB/CIF…),
                currency, and <em>FX rate to PKR</em>. Upload contract, proforma, LC/EIF.
              </li>
              <li>
                <strong>Containers &amp; Items</strong> — Add container number(s), then line items inside each container
                (description, HS code, qty, foreign unit price, weight/CBM). Upload commercial invoice &amp; packing list.
              </li>
              <li>
                <strong>Shipping &amp; Arrival</strong> — Enter B/L, vessel, ETD/ETA/ATA, IGM. Upload B/L and container photos.
              </li>
              <li>
                <strong>PSW / Customs</strong> — Enter GD number, PSID, PSSID, collectorate, channel (Green/Yellow/Red).
                Upload GD print, PSID slip, assessment, duty challans.
              </li>
              <li>
                <strong>All Charges</strong> — Enter ocean freight, clearing agent, port THC, demurrage, local trucking,
                bank charges, and per-item duties/taxes. Mark shared vs item-specific. Attach invoices &amp; payment proofs.
              </li>
              <li>
                <strong>Landed Cost</strong> — Choose allocation method (by value / weight / qty / CBM), calculate, review
                unit landed cost for every item, then <strong>lock</strong> when final.
              </li>
              <li>
                <strong>Warehouse Receive</strong> — Confirm received qty (shortages), warehouse location, upload GRN, mark received.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Landed cost formula</h3>
            <div className="rounded-md border bg-[hsl(var(--muted))]/20 p-3 font-mono text-[12px] space-y-1">
              <p>Product PKR = Qty × Foreign unit price × FX rate</p>
              <p>Shared costs (freight, clearing, truck…) → split across items</p>
              <p>Direct costs (duty on one HS line) → that item only</p>
              <p className="pt-1 font-semibold">Unit landed = (Product + Shared share + Direct) ÷ Received qty</p>
            </div>
            <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
              <strong>By value</strong> is usual for mixed commercial goods. Use <strong>by weight</strong> or{" "}
              <strong>by CBM</strong> when freight is charged by mass/volume (common for batteries/panels).
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Pakistan / PSW tips</h3>
            <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
              <li><strong>PSW</strong> = Pakistan Single Window portal where the Goods Declaration (GD) is filed.</li>
              <li><strong>PSID</strong> = payment slip ID generated for duties/taxes; keep the receipt attached.</li>
              <li><strong>PSSID</strong> = related payment identity used in your purchase/finance trail — store it here.</li>
              <li><strong>IGM</strong> comes from the shipping line when the vessel manifests at the Pakistani port.</li>
              <li>Duties depend on <strong>HS code</strong> — put the correct HS on each item and attach assessment.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Attachments</h3>
            <p className="text-[13px]">
              Every step lets you upload <strong>multiple files</strong> (PDF/images). Pick the correct category
              (Contract, Invoice, B/L, PSW GD, PSID, freight invoice, etc.) so the file trail matches the real clearance file.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Example (one container, two items)</h3>
            <p className="text-[13px]">
              Item A invoice $10,000 · Item B $5,000 · FX 280 → product PKR 4,200,000.
              Shared freight+clearing+truck = PKR 300,000 allocated 2/3 and 1/3 by value.
              Add each item&apos;s own customs duty on top. Result = total landed and unit landed for A and B.
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
