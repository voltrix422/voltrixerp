"use client"
import { useState } from "react"
import {
  ShoppingCart, Package, Truck, DollarSign, Users, BarChart3,
  ChevronDown, ChevronRight, ArrowRight, CheckCircle2,
  FileText, Warehouse, UserCog, Globe, BookOpen, GitBranch, Lightbulb,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  label: string
  desc?: string
}

interface Section {
  id: string
  icon: React.ReactNode
  title: string
  color: string
  summary: string
  topics: Topic[]
}

interface Topic {
  title: string
  content: React.ReactNode
  keywords?: string
}

type FlowNodeVariant = "start" | "action" | "decision" | "end" | "warning"

interface FlowNode {
  title: string
  body?: string
  variant?: FlowNodeVariant
}

// ── Flow components ───────────────────────────────────────
function Flow({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-wrap items-start gap-1 mt-3">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 bg-[hsl(var(--muted))]/60 border rounded-md px-2.5 py-1.5">
              <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{i + 1}</span>
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            {s.desc && <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 text-center max-w-[100px]">{s.desc}</p>}
          </div>
          {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0 mt-1.5" />}
        </div>
      ))}
    </div>
  )
}

function VerticalFlowchart({ nodes, className }: { nodes: FlowNode[]; className?: string }) {
  const styles: Record<FlowNodeVariant, string> = {
    start: "bg-[#1faca6]/15 border-[#1faca6]/40 text-[#0d6b67]",
    action: "bg-[hsl(var(--muted))]/50 border-[hsl(var(--border))]",
    decision: "bg-amber-50 border-amber-200 text-amber-900",
    warning: "bg-orange-50 border-orange-200 text-orange-900",
    end: "bg-emerald-50 border-emerald-200 text-emerald-900",
  }
  return (
    <div className={cn("flex flex-col items-stretch gap-0 mt-3 max-w-lg", className)}>
      {nodes.map((node, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className={cn("w-full rounded-lg border px-3 py-2.5 text-center", styles[node.variant || "action"])}>
            <p className="text-xs font-semibold leading-snug">{node.title}</p>
            {node.body && <p className="text-[10px] opacity-80 mt-1 leading-relaxed">{node.body}</p>}
          </div>
          {i < nodes.length - 1 && (
            <div className="flex flex-col items-center py-1 text-[hsl(var(--muted-foreground))]">
              <div className="w-0.5 h-2 bg-[hsl(var(--border))]" />
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function NumberedSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 mt-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-2.5 text-xs">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1faca6]/15 text-[10px] font-bold text-[#0d6b67]">
            {i + 1}
          </span>
          <span className="pt-0.5 leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  )
}

function TipBox({ children, type = "tip" }: { children: React.ReactNode; type?: "tip" | "warning" | "info" }) {
  const styles = {
    tip: "bg-[#1faca6]/10 border-[#1faca6]/30 text-[#0d6b67]",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  }
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 mt-3 text-xs leading-relaxed flex gap-2", styles[type])}>
      <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  )
}

function Status({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${color}`}>
      {label}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5 border-b last:border-0 text-xs">
      <span className="text-[hsl(var(--muted-foreground))] w-36 shrink-0">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 mt-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#1faca6] shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function CompareTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-lg border overflow-hidden mt-3 overflow-x-auto">
      <table className="w-full text-xs min-w-[280px]">
        <thead>
          <tr className="bg-[hsl(var(--muted))]/40 border-b">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-[hsl(var(--muted))]/20">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? "font-medium" : ""}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Sections ──────────────────────────────────────────────
const SECTIONS: Section[] = [
  {
    id: "start",
    icon: <BookOpen className="h-4 w-4" />,
    title: "Getting Started — How the ERP Works",
    color: "text-[#1faca6]",
    summary: "Simple explanation of what Voltrix ERP does and how every module connects.",
    topics: [
      {
        title: "What is Voltrix ERP? (in plain English)",
        keywords: "beginner introduction overview what is erp",
        content: (
          <div className="space-y-2 text-xs leading-relaxed">
            <p>
              Voltrix ERP is your <strong>one place to run the business</strong>. Instead of WhatsApp messages,
              Excel sheets, and paper slips, everything lives here: clients, sales orders, stock, purchases,
              payments, deliveries, and staff records.
            </p>
            <BulletList items={[
              "You <strong>buy</strong> goods → Purchase module → stock goes into Inventory",
              "You <strong>sell</strong> to clients → CRM creates orders → Finance collects money → Inventory ships stock",
              "You <strong>move</strong> stock between branches → Branches tab inside Inventory",
              "You <strong>track</strong> everything → History, Finance reports, Dashboard approvals",
            ]} />
          </div>
        ),
      },
      {
        title: "The big picture — full business flowchart",
        keywords: "flowchart diagram flow purchase sell inventory finance",
        content: (
          <div className="space-y-2 text-xs">
            <p>Follow this path from buying to selling. Every arrow is an action someone does in the system.</p>
            <VerticalFlowchart nodes={[
              { title: "1. BUY STOCK", body: "Purchase → create PO → receive goods", variant: "start" },
              { title: "Stock enters Main Warehouse", body: "Inventory tab shows available qty", variant: "action" },
              { title: "Optional: move to a branch", body: "Inventory → Branches → transfer", variant: "action" },
              { title: "2. SELL TO CLIENT", body: "CRM → create order → admin approves", variant: "action" },
              { title: "Payment received?", body: "Full payment OR credit (pay later)", variant: "decision" },
              { title: "Finance records payment", body: "Finance → Client Orders tab", variant: "action" },
              { title: "3. DISPATCH & DELIVER", body: "Inventory → Client Orders → fulfill + dispatch note", variant: "action" },
              { title: "Stock deducted automatically", body: "History shows OUT movement", variant: "action" },
              { title: "DONE — order delivered", variant: "end" },
            ]} />
          </div>
        ),
      },
      {
        title: "Who does what? (quick roles guide)",
        keywords: "roles admin sales finance purchase inventory",
        content: (
          <CompareTable
            headers={["Person", "Main modules they use"]}
            rows={[
              ["CEO / Superadmin", "Everything — approvals on Dashboard"],
              ["Sales / CRM user", "CRM — clients & orders"],
              ["Finance team", "Finance — payments, credit, PO payments, reports"],
              ["Warehouse / Inventory", "Inventory — stock, branches, dispatch client orders"],
              ["Purchase team", "Purchase — POs and suppliers"],
              ["HR", "HRM — staff, attendance, KPIs"],
            ]}
          />
        ),
      },
      {
        title: "Daily cheat sheet — most common tasks",
        keywords: "quick daily common tasks how to",
        content: (
          <div className="space-y-3 text-xs">
            <InfoRow label="New sale" value="CRM → Orders → + Order" />
            <InfoRow label="Approve an order" value="Dashboard or CRM → open order → Approve" />
            <InfoRow label="Take payment" value="Finance → Client Orders → + Payment" />
            <InfoRow label="Ship to client" value="Inventory → Client Orders → Fulfill / Dispatch" />
            <InfoRow label="Send stock to branch" value="Inventory → Branches → Send" />
            <InfoRow label="Add stock manually" value="Inventory → Manual added inventory" />
            <InfoRow label="Buy from supplier" value="Purchase → + New PO" />
            <InfoRow label="Check what's owed" value="Finance → Client Orders → filter Outstanding credit" />
          </div>
        ),
      },
    ],
  },
  {
    id: "dashboard",
    icon: <BarChart3 className="h-4 w-4" />,
    title: "Dashboard",
    color: "text-cyan-600",
    summary: "Your home screen — pending approvals, alerts, and quick actions.",
    topics: [
      {
        title: "What you see on the Dashboard",
        content: (
          <BulletList items={[
            "Pending client orders waiting for your approval",
            "Branch transfer requests that need approval",
            "Petty cash requests from staff",
            "Quick counts and recent activity",
            "Shortcuts to jump into CRM, Finance, or Inventory",
          ]} />
        ),
      },
      {
        title: "How to approve items from Dashboard",
        content: (
          <div className="space-y-2 text-xs">
            <NumberedSteps steps={[
              "Open Dashboard from the sidebar (first item).",
              "Find the card for Client Orders, Branch Transfers, or Petty Cash.",
              "Click the order/request to expand details.",
              "Click Approve or Reject — add a note if rejecting.",
              "The person who submitted it gets notified automatically.",
            ]} />
          </div>
        ),
      },
    ],
  },
  {
    id: "crm",
    icon: <Users className="h-4 w-4" />,
    title: "CRM — Clients & Orders",
    color: "text-blue-600",
    summary: "Add clients, create sales orders, get approval, invoice, and send to inventory for dispatch.",
    topics: [
      {
        title: "How to add a new client (step by step)",
        keywords: "add client create customer new client ntn tax",
        content: (
          <div className="space-y-2 text-xs">
            <p>Go to <strong>CRM → Clients</strong> tab.</p>
            <NumberedSteps steps={[
              'Click "Add Client".',
              "Enter client name (required).",
              "Fill phone, email, address, city — used on invoices and dispatch notes.",
              "Add NTN and Tax ID if the client is a business (shows on invoice PDF).",
              "Add Focal Person — the main contact at that company.",
              "Save. The client now appears when creating orders.",
            ]} />
            <TipBox>You can also edit NTN inline on the client card after saving.</TipBox>
          </div>
        ),
      },
      {
        title: "How to create a normal sales order (full payment)",
        keywords: "create order new order sales order step",
        content: (
          <div className="space-y-3 text-xs">
            <p>Go to <strong>CRM → Orders</strong> → click <strong>+ Order</strong>.</p>
            <NumberedSteps steps={[
              "Select the client from the dropdown.",
              "Click Add from Inventory to pick products already in stock, OR add custom line items manually.",
              "Set quantity, unit price, and unit (pcs, boxes, etc.) for each line.",
              "Enter delivery address and expected delivery date.",
              "Add notes if needed (visible internally).",
              'Click "Create Order" — status becomes Pending Approval.',
              "Wait for admin/CEO to approve on Dashboard or CRM.",
              "After approval: Finalize Order to add tax, transport costs, and generate invoice.",
              "Finance records payment before or after dispatch (see Finance section).",
              "Inventory team fulfills and dispatches from Inventory → Client Orders.",
            ]} />
            <VerticalFlowchart nodes={[
              { title: "Create order", variant: "start" },
              { title: "Pending Approval", body: "Waits for admin", variant: "warning" },
              { title: "Approved", variant: "action" },
              { title: "Finalized", body: "Invoice PDF ready", variant: "action" },
              { title: "Payment added", body: "Finance module", variant: "action" },
              { title: "Processing → Shipped → Delivered", body: "Inventory dispatch", variant: "action" },
              { title: "Complete", variant: "end" },
            ]} />
          </div>
        ),
      },
      {
        title: "How to create a CREDIT order (client pays later)",
        keywords: "credit order pay later udhar outstanding balance",
        content: (
          <div className="space-y-3 text-xs">
            <p>
              A <strong>credit order</strong> lets you deliver goods even when the client has not paid the full
              amount yet. Finance must approve sending on credit.
            </p>
            <NumberedSteps steps={[
              "Create and get the order Approved and Finalized as normal.",
              "Go to Finance → Client Orders tab.",
              "Open the order — you will see how much is paid vs remaining balance.",
              'If no payment or partial payment: click "Approve on credit" (or similar credit action).',
              "Finance approves — order can move to inventory for dispatch.",
              "Invoice shows Credit terms and balance due.",
              "Record partial or full payments later as money comes in.",
              "Filter Finance → Outstanding credit to see who still owes money.",
            ]} />
            <TipBox type="warning">
              Credit orders stay flagged in Finance until the full balance is cleared. Check
              Finance → Client Orders → filter <strong>Outstanding credit</strong> regularly.
            </TipBox>
            <CompareTable
              headers={["", "Full payment order", "Credit order"]}
              rows={[
                ["When to use", "Client pays before/at delivery", "Trusted client, pays later"],
                ["Payment timing", "Before or at dispatch", "After delivery (agreed terms)"],
                ["Invoice shows", "Payment due → Paid in full", "Credit terms + balance due"],
                ["Finance step", "Record payment", "Approve on credit + record payments later"],
              ]}
            />
          </div>
        ),
      },
      {
        title: "Order statuses explained",
        keywords: "status pending approved rejected finalized delivered",
        content: (
          <div className="space-y-3">
            <Flow steps={[
              { label: "Pending Approval", desc: "Just created" },
              { label: "Approved", desc: "Admin OK" },
              { label: "Finalized", desc: "Invoice ready" },
              { label: "Confirmed", desc: "Payment/credit OK" },
              { label: "Processing", desc: "Being prepared" },
              { label: "Delivered", desc: "Done" },
            ]} />
            <div className="space-y-1.5 mt-2">
              {[
                ["Pending Approval", "bg-yellow-100 text-yellow-800 border-yellow-200", "Sales created it — admin must approve or reject"],
                ["Approved", "bg-blue-100 text-blue-800 border-blue-200", "Approved — ready to finalize with invoice details"],
                ["Rejected", "bg-red-100 text-red-800 border-red-200", "Not accepted — order stops here"],
                ["Finalized", "bg-green-100 text-green-800 border-green-200", "Invoice generated — tax, transport, costs added"],
                ["Payment Added", "bg-teal-100 text-teal-800 border-teal-200", "At least one payment recorded in Finance"],
                ["Processing / Shipped", "bg-indigo-100 text-indigo-800 border-indigo-200", "Warehouse is preparing or shipping"],
                ["Delivered", "bg-emerald-100 text-emerald-800 border-emerald-200", "Goods delivered — stock deducted"],
                ["Cancelled", "bg-gray-100 text-gray-800 border-gray-200", "Order cancelled — stock restored if was deducted"],
              ].map(([label, color, desc]) => (
                <div key={label} className="flex items-start gap-3 text-xs">
                  <Status label={label} color={color} />
                  <span className="text-[hsl(var(--muted-foreground))]">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: "How to finalize an order & download invoice",
        keywords: "finalize invoice pdf tax transport",
        content: (
          <div className="space-y-2 text-xs">
            <p>After approval, open the order and click <strong>Finalize Order</strong>:</p>
            <NumberedSteps steps={[
              "Set tax percentage if applicable.",
              "Add transport cost and label (e.g. Delivery Lahore).",
              "Add other costs if any (installation, etc.).",
              "Assign dispatcher name (optional).",
              "Save — order status becomes Finalized.",
              "Click Preview Invoice or Download PDF.",
              "Invoice shows client details, line items, payment status, and balance due.",
            ]} />
          </div>
        ),
      },
      {
        title: "CRM FAQs — common questions",
        keywords: "faq question help problem",
        content: (
          <div className="space-y-3 text-xs">
            <div>
              <p className="font-semibold">Can I edit an order after creating it?</p>
              <p className="text-[hsl(var(--muted-foreground))] mt-0.5">Yes, before it is delivered. Open the order and edit lines, address, or notes.</p>
            </div>
            <div>
              <p className="font-semibold">Why can't I dispatch an order?</p>
              <p className="text-[hsl(var(--muted-foreground))] mt-0.5">It must be approved, finalized, and either paid or approved on credit. Dispatch happens in Inventory → Client Orders, not CRM.</p>
            </div>
            <div>
              <p className="font-semibold">What if the client pays in two installments?</p>
              <p className="text-[hsl(var(--muted-foreground))] mt-0.5">Finance → Client Orders → + Payment for each installment. Balance updates automatically.</p>
            </div>
            <div>
              <p className="font-semibold">Where does the invoice email go?</p>
              <p className="text-[hsl(var(--muted-foreground))] mt-0.5">Download the PDF from CRM or Finance and send manually to the client's email on file.</p>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "finance",
    icon: <DollarSign className="h-4 w-4" />,
    title: "Finance",
    color: "text-teal-600",
    summary: "Record payments, manage credit, pay suppliers, petty cash, payroll, and reports.",
    topics: [
      {
        title: "Finance module map — where to click",
        keywords: "finance tabs overview navigate",
        content: (
          <div className="space-y-2 text-xs">
            <p>Open <strong>Finance</strong> from the sidebar. Tabs inside:</p>
            <BulletList items={[
              "Overview — summary cards and quick stats",
              "Client Orders — payments & credit for sales orders",
              "Purchase Orders — payments owed to suppliers for POs",
              "Salaries & Payroll — staff and sales agent salaries",
              "Records & Petty Cash — general expenses, receipts, petty cash claims",
              "Reports — financial reports by period",
            ]} />
            <VerticalFlowchart nodes={[
              { title: "Money IN", body: "Client order payments", variant: "start" },
              { title: "Finance → Client Orders", variant: "action" },
              { title: "Money OUT", body: "Supplier PO payments, expenses, salaries", variant: "warning" },
              { title: "Finance → Purchase Orders / Records / Payroll", variant: "action" },
              { title: "Reports show the full picture", variant: "end" },
            ]} />
          </div>
        ),
      },
      {
        title: "How to record a client payment (step by step)",
        keywords: "payment record receive money client order",
        content: (
          <div className="space-y-2 text-xs">
            <NumberedSteps steps={[
              "Go to Finance → Client Orders tab.",
              "Search for the order number or client name.",
              "Click the order row to expand it.",
              'Click "+ Payment" or Add Payment.',
              "Enter amount received (can be partial).",
              "Select method: Cash, Bank Transfer, Cheque, etc.",
              "Upload proof of payment (screenshot/photo) — optional but recommended.",
              "Save — balance due updates. Invoice shows Paid in full when complete.",
            ]} />
            <TipBox>Before payment, the invoice PDF shows Payment due and the full balance. After payment, it shows Paid in full.</TipBox>
          </div>
        ),
      },
      {
        title: "How to approve & track credit orders",
        keywords: "credit approve outstanding balance udhar",
        content: (
          <div className="space-y-2 text-xs">
            <NumberedSteps steps={[
              "Finance → Client Orders.",
              "Use filter: Outstanding credit or On credit.",
              "Open an order with remaining balance.",
              'Click "Approve on credit" to allow dispatch without full payment.',
              "Warehouse can now fulfill the order in Inventory.",
              "When client pays later, add payments — balance reduces.",
              "When balance = 0, credit is cleared.",
            ]} />
          </div>
        ),
      },
      {
        title: "How to pay a supplier (Purchase Order payments)",
        keywords: "supplier po payment purchase pay",
        content: (
          <div className="space-y-2 text-xs">
            <NumberedSteps steps={[
              "Go to Finance → Purchase Orders tab.",
              "Find the finalized PO that needs payment.",
              "Record payment amount and upload bank receipt.",
              "PO payment status updates.",
              "After goods received, PO moves to In Inventory (stock added).",
            ]} />
          </div>
        ),
      },
      {
        title: "Records, expenses & petty cash",
        keywords: "expense record petty cash receipt",
        content: (
          <div className="space-y-2 text-xs">
            <p><strong>Records & Petty Cash</strong> tab has two sections:</p>
            <BulletList items={[
              "Finance Records — general payments, expenses, salaries, taxes, refunds",
              "Petty Cash — staff submit small expense claims; manager approves on Dashboard",
            ]} />
            <p className="mt-2">To add a finance record:</p>
            <NumberedSteps steps={[
              "Finance → Records & Petty Cash → Finance section.",
              '+ Add Record → title, amount, category, tag, notes.',
              "Upload proof (image/PDF).",
              "Use Filters to search by date, category, or tag.",
            ]} />
          </div>
        ),
      },
    ],
  },
  {
    id: "inventory",
    icon: <Warehouse className="h-4 w-4" />,
    title: "Inventory — Stock, Branches & Dispatch",
    color: "text-green-600",
    summary: "Main warehouse stock, manual items, branch transfers, client order dispatch, and history.",
    topics: [
      {
        title: "Inventory tabs — what each one does",
        keywords: "inventory tabs client orders manual branches history",
        content: (
          <CompareTable
            headers={["Tab", "Purpose"]}
            rows={[
              ["Client Orders", "Orders ready to dispatch — fulfill, scan serials, download dispatch note"],
              ["Inventory", "Main warehouse stock — serial numbers and quantities"],
              ["Manual added inventory", "Products without QR/serial — qty only (e.g. cables, tape)"],
              ["Branches", "Branch warehouses — send stock, transfer between branches"],
              ["History", "Full audit trail — every stock IN and OUT movement"],
            ]}
          />
        ),
      },
      {
        title: "How stock enters inventory (from Purchase)",
        keywords: "stock receive po inventory in",
        content: (
          <VerticalFlowchart nodes={[
            { title: "Purchase team creates PO", variant: "start" },
            { title: "PO finalized & paid", body: "Finance", variant: "action" },
            { title: "Goods physically arrive", variant: "action" },
            { title: "PO marked In Inventory", body: "Purchase module", variant: "action" },
            { title: "Items appear in Inventory tab", body: "With qty, model, supplier", variant: "end" },
          ]} />
        ),
      },
      {
        title: "How to add manual inventory (no serial numbers)",
        keywords: "manual inventory add stock quantity without serial",
        content: (
          <div className="space-y-2 text-xs">
            <p>For items tracked by <strong>quantity only</strong> (no QR scan per unit):</p>
            <NumberedSteps steps={[
              "Inventory → Manual added inventory tab.",
              'Click "Add Item".',
              "Enter product name — system generates a model code (MAN-...).",
              "Set total quantity and unit (pcs, boxes, etc.).",
              "Save — item appears in main warehouse inventory.",
              "Use +/- buttons to adjust stock or total units later if needed.",
            ]} />
            <TipBox>Manual items appear in CRM orders and branch transfers like normal stock.</TipBox>
          </div>
        ),
      },
      {
        title: "How to send stock to a branch (transfer flowchart)",
        keywords: "branch transfer send move stock warehouse",
        content: (
          <div className="space-y-3 text-xs">
            <p>Go to <strong>Inventory → Branches</strong>.</p>
            <VerticalFlowchart nodes={[
              { title: "Open Main warehouse (or source branch)", variant: "start" },
              { title: "Click Send or Send multiple", variant: "action" },
              { title: "Select destination branch", variant: "action" },
              { title: "Pick product & quantity", variant: "action" },
              { title: "Confirm transfer", body: "Transfer slip PDF generated", variant: "action" },
              { title: "Stock leaves source", body: "Deducted from main warehouse", variant: "warning" },
              { title: "Stock arrives at branch", body: "Shows in branch inventory", variant: "end" },
            ]} />
            <NumberedSteps steps={[
              "Select the source branch card (e.g. Main warehouse BR001).",
              "Click Send on a product row, or Send multiple for batch.",
              "Choose destination branch and quantity.",
              "Add a note if needed → Confirm.",
              "Download transfer PDF from branch Transfer history.",
              "To return stock: open destination branch → Send back to Main warehouse.",
            ]} />
            <TipBox type="warning">When stock returns to Main warehouse, quantities update automatically. Check History tab if numbers look wrong.</TipBox>
          </div>
        ),
      },
      {
        title: "How to dispatch a client order (fulfillment flowchart)",
        keywords: "dispatch fulfill deliver client order scan serial",
        content: (
          <div className="space-y-3 text-xs">
            <p>Orders appear here after CRM approval + Finance payment/credit OK.</p>
            <VerticalFlowchart nodes={[
              { title: "Inventory → Client Orders", variant: "start" },
              { title: "Find order (search by # or client)", variant: "action" },
              { title: "Click Fulfill / Create Dispatch Note", variant: "action" },
              { title: "Has serial numbers?", variant: "decision" },
              { title: "Scan QR codes for each unit", body: "Or dispatch qty only for manual items", variant: "action" },
              { title: "Enter dispatcher, receiver name, CNIC, vehicle", variant: "action" },
              { title: "Download Dispatch Note PDF", variant: "action" },
              { title: "Order → Delivered", body: "Stock deducted from inventory", variant: "end" },
            ]} />
            <NumberedSteps steps={[
              "Open Inventory → Client Orders.",
              "Click the order — check items and quantities.",
              'Click "Fulfill" or dispatch button.',
              "For serial-tracked items: scan each unit's QR code.",
              "For manual items: enter quantity to dispatch (no scan needed).",
              "Fill receiver details (name, CNIC, vehicle number) for the dispatch slip.",
              "Generate and download Dispatch Note PDF.",
              "Order status becomes Delivered — stock is reduced automatically.",
            ]} />
          </div>
        ),
      },
      {
        title: "Inventory History — tracking every movement",
        keywords: "history audit movement in out trace",
        content: (
          <div className="space-y-2 text-xs">
            <p>Go to <strong>Inventory → History</strong>.</p>
            <BulletList items={[
              "See every IN (stock received) and OUT (stock sent) movement",
              "Filter by date, type (in/out), item, client, branch",
              "Export to Excel or PDF for audits",
              "Shows: what moved, how many, from where, to where, who did it",
              "Branch transfers, order dispatches, and PO receipts all appear here",
            ]} />
          </div>
        ),
      },
    ],
  },
  {
    id: "purchase",
    icon: <ShoppingCart className="h-4 w-4" />,
    title: "Purchase — PO Management",
    color: "text-purple-600",
    summary: "Three PO types: Regular (quotes), Direct (fast), and Imported (from abroad).",
    topics: [
      {
        title: "PO types — which one to use?",
        keywords: "po type regular direct imported compare",
        content: (
          <CompareTable
            headers={["Type", "When to use", "Approval", "Speed"]}
            rows={[
              ["Regular PO", "Compare multiple supplier quotes", "Admin approval required", "Slower — best price"],
              ["Direct PO", "Known supplier, fixed price", "Skipped — straight to Finance", "Fastest"],
              ["Imported PO", "Goods from abroad (China, etc.)", "Multi-stage admin + finance", "Longest — most steps"],
            ]}
          />
        ),
      },
      {
        title: "Regular PO flow",
        content: (
          <div className="space-y-3">
            <Flow steps={[
              { label: "Draft" },
              { label: "Sent to Admin" },
              { label: "Approved" },
              { label: "Sharing" },
              { label: "Quoted" },
              { label: "Finalized" },
              { label: "In Inventory" },
            ]} />
            <NumberedSteps steps={[
              "Purchase → POs → + New PO.",
              "Add items, quantities, delivery date.",
              "Send to Admin for approval.",
              "Share with suppliers (WhatsApp) — collect quotes.",
              "Select best quote and finalize.",
              "Finance pays supplier → goods received → In Inventory.",
            ]} />
          </div>
        ),
      },
      {
        title: "Direct PO flow (fastest)",
        content: (
          <div className="space-y-2 text-xs">
            <Flow steps={[
              { label: "Create Direct PO" },
              { label: "Send to Finance" },
              { label: "Paid & In Inventory" },
            ]} />
            <NumberedSteps steps={[
              "Purchase → + Direct PO.",
              "Select single supplier, add items with prices.",
              "Add tax/transport if needed.",
              "Send to Finance — no admin approval.",
              "Finance pays → receive goods → In Inventory.",
            ]} />
          </div>
        ),
      },
      {
        title: "Imported PO flow",
        content: (
          <div className="space-y-2 text-xs">
            <Flow steps={[
              { label: "Admin Draft" },
              { label: "Purchase" },
              { label: "Finance" },
              { label: "Approved" },
              { label: "Inventory" },
            ]} />
            <p className="mt-2">Used for international shipments. Multiple document upload stages between Purchase, Finance, and Admin. See Purchase module for current stage of each PO.</p>
          </div>
        ),
      },
      {
        title: "Managing suppliers",
        content: (
          <BulletList items={[
            "Purchase → Suppliers tab",
            "Add name, type (local/imported), contact, email, bank details",
            "Suppliers appear when creating POs",
          ]} />
        ),
      },
    ],
  },
  {
    id: "dispatches",
    icon: <Truck className="h-4 w-4" />,
    title: "Dispatches",
    color: "text-orange-600",
    summary: "Standalone delivery tracking — separate from CRM order dispatch notes.",
    topics: [
      {
        title: "Dispatches vs Inventory dispatch — what's the difference?",
        keywords: "dispatch difference inventory crm",
        content: (
          <CompareTable
            headers={["", "Inventory → Client Orders", "Dispatches module"]}
            rows={[
              ["Linked to", "CRM sales orders", "Standalone delivery records"],
              ["Stock impact", "Yes — deducts inventory", "No automatic stock change"],
              ["PDF", "Dispatch Note (DN-ORD-...)", "Dispatch PDF (ORD-...)"],
              ["When to use", "Normal sales fulfillment", "Extra tracking, non-order deliveries"],
            ]}
          />
        ),
      },
      {
        title: "How to create a standalone dispatch",
        content: (
          <NumberedSteps steps={[
            "Dispatches → + New Dispatch.",
            "Enter customer name, phone, delivery address.",
            "Add items with qty, unit, price.",
            "Set dispatch and expected delivery dates.",
            "Choose courier: Own Driver, TCS, Leopards, M&P, or Trax.",
            "For own driver: enter driver name, phone, vehicle.",
            "For courier: enter tracking ID.",
            "Save and update status: Pending → In Transit → Delivered.",
          ]} />
        ),
      },
    ],
  },
  {
    id: "hrm",
    icon: <UserCog className="h-4 w-4" />,
    title: "HRM — Human Resources",
    color: "text-pink-600",
    summary: "Staff records, attendance, KPIs, and salary slips.",
    topics: [
      {
        title: "Managing employees",
        content: (
          <BulletList items={[
            "HRM → add staff with name, role, department, contact details",
            "Upload employee documents",
            "Track joining date and status",
            "KPI Dashboard (sidebar) — assign KPIs and track performance",
            "My KPIs — staff view their own targets",
          ]} />
        ),
      },
    ],
  },
  {
    id: "docs",
    icon: <FileText className="h-4 w-4" />,
    title: "Documentation",
    color: "text-indigo-600",
    summary: "Store and organize company files.",
    topics: [
      {
        title: "Uploading documents",
        content: (
          <NumberedSteps steps={[
            "Docs → + Upload.",
            "Enter title, category, tags.",
            "Upload file (PDF, image, Word, Excel).",
            "Search and filter later by category or tag.",
          ]} />
        ),
      },
    ],
  },
  {
    id: "roles",
    icon: <Globe className="h-4 w-4" />,
    title: "User Roles & Access",
    color: "text-amber-600",
    summary: "Who can see which modules.",
    topics: [
      {
        title: "Role overview",
        content: (
          <CompareTable
            headers={["Role", "Access"]}
            rows={[
              ["Superadmin (CEO)", "Everything — all modules, user management, all approvals"],
              ["User (custom modules)", "Only modules assigned — e.g. CRM only, or Finance + Inventory"],
              ["Sales Agent", "CRM — own clients and orders"],
              ["Sales Manager", "CRM + sales agents area"],
            ]}
          />
        ),
      },
      {
        title: "Managing users (Superadmin only)",
        content: (
          <NumberedSteps steps={[
            "Click Users icon (top-right).",
            "Create user with username and password.",
            "Assign role and tick which modules they can access.",
            "User only sees those modules in the sidebar.",
            "Disable account or reset password as needed.",
          ]} />
        ),
      },
    ],
  },
]

// ── UI components ─────────────────────────────────────────
function TopicItem({ topic }: { topic: Topic }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[hsl(var(--muted))]/30 transition-colors"
      >
        <span className="text-xs font-medium pr-2">{topic.title}</span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
        }
      </button>
      {open && <div className="px-4 pb-4 text-[hsl(var(--foreground))]">{topic.content}</div>}
    </div>
  )
}

function SectionCard({ section, defaultOpen }: { section: Section; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="rounded-xl border bg-[hsl(var(--card))] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[hsl(var(--muted))]/20 transition-colors"
      >
        <div className={`h-8 w-8 rounded-lg bg-[hsl(var(--muted))]/60 flex items-center justify-center ${section.color}`}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{section.title}</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">{section.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{section.topics.length} topics</span>
          {open
            ? <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            : <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          }
        </div>
      </button>
      {open && (
        <div className="border-t divide-y">
          {section.topics.map((topic, i) => (
            <TopicItem key={i} topic={topic} />
          ))}
        </div>
      )}
    </div>
  )
}

export function HelpContent() {
  const [search, setSearch] = useState("")
  const totalTopics = SECTIONS.reduce((s, sec) => s + sec.topics.length, 0)
  const q = search.trim().toLowerCase()

  const filtered = q
    ? SECTIONS.map((s) => ({
        ...s,
        topics: s.topics.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            s.title.toLowerCase().includes(q) ||
            s.summary.toLowerCase().includes(q) ||
            (t.keywords?.toLowerCase().includes(q) ?? false),
        ),
      })).filter((s) => s.topics.length > 0)
    : SECTIONS

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="rounded-xl border bg-gradient-to-br from-[#1faca6]/10 to-[hsl(var(--card))] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#1faca6]/20 flex items-center justify-center shrink-0">
            <GitBranch className="h-5 w-5 text-[#0d6b67]" />
          </div>
          <div>
            <p className="text-sm font-semibold">Voltrix ERP Help Center</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">
              Step-by-step guides and flowcharts for every module. Start with{" "}
              <strong>Getting Started</strong> if you are new, or search below for a specific task.
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search help topics... e.g. credit order, branch transfer, dispatch"
          className="w-full h-10 rounded-lg border bg-[hsl(var(--background))] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6] transition-colors"
        />
      </div>

      {!search && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Modules", value: SECTIONS.length },
            { label: "Guides", value: totalTopics },
            { label: "Flowcharts", value: "12+" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-[hsl(var(--card))] px-4 py-3 text-center">
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((section, i) => (
          <SectionCard key={section.id} section={section} defaultOpen={!search && i === 0} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">
          No topics found for &ldquo;{search}&rdquo; — try words like order, credit, transfer, dispatch, payment, inventory
        </div>
      )}
    </div>
  )
}
