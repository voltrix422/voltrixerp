"use client"
import { useState } from "react"
import {
  ShoppingCart, Package, Truck, DollarSign, Users, BarChart3,
  ChevronDown, ChevronRight, ArrowRight, CheckCircle2, Circle,
  FileText, Warehouse, CreditCard, UserCog, Globe, BookOpen
} from "lucide-react"

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
}

// ── Flow component ────────────────────────────────────────
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
            {s.desc && <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 text-center max-w-[90px]">{s.desc}</p>}
          </div>
          {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0 mt-1.5" />}
        </div>
      ))}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────
function Status({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${color}`}>
      {label}
    </span>
  )
}

// ── Info row ──────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5 border-b last:border-0 text-xs">
      <span className="text-[hsl(var(--muted-foreground))] w-32 shrink-0">{label}</span>
      <span>{value}</span>
    </div>
  )
}

// ── Bullet list ───────────────────────────────────────────
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

// ── Comparison table ──────────────────────────────────────
function CompareTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-lg border overflow-hidden mt-3">
      <table className="w-full text-xs">
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

// ── All sections data ─────────────────────────────────────
const SECTIONS: Section[] = [
  {
    id: "crm",
    icon: <Users className="h-4 w-4" />,
    title: "CRM — Clients & Orders",
    color: "text-blue-600",
    summary: "Manage clients and create sales orders that go through approval, finalization, and payment.",
    topics: [
      {
        title: "How to Add a Client",
        content: (
          <div className="space-y-2 text-xs">
            <p>Go to <strong>CRM → Clients</strong> tab.</p>
            <BulletList items={[
              'Click "Add Client"',
              "Fill in name, phone, email, and address",
              "Save — client is now available when creating orders",
            ]} />
          </div>
        ),
      },
      {
        title: "How to Create a Client Order",
        content: (
          <div className="space-y-3 text-xs">
            <p>Go to <strong>CRM → Orders</strong> tab and click <strong>+ Order</strong>.</p>
            <BulletList items={[
              "Select a client from the dropdown",
              "Add items from inventory or create custom items",
              "Set delivery address and expected delivery date",
              "Add notes if needed",
              'Click "Create Order" — status becomes Pending Approval',
            ]} />
            <p className="text-[hsl(var(--muted-foreground))]">The order is sent to admin for approval before it can be finalized.</p>
          </div>
        ),
      },
      {
        title: "Order Status Flow",
        content: (
          <div className="space-y-3">
            <Flow steps={[
              { label: "Pending Approval", desc: "Awaiting admin" },
              { label: "Approved", desc: "Admin approved" },
              { label: "Finalized", desc: "Invoice ready" },
              { label: "Delivered", desc: "Complete" },
            ]} />
            <div className="mt-3 space-y-1.5">
              {[
                ["Pending Approval", "bg-yellow-100 text-yellow-800 border-yellow-200", "Order created, waiting for admin to approve"],
                ["Approved", "bg-blue-100 text-blue-800 border-blue-200", "Admin approved, can now be finalized with invoice details"],
                ["Rejected", "bg-red-100 text-red-800 border-red-200", "Admin rejected the order"],
                ["Finalized", "bg-green-100 text-green-800 border-green-200", "Invoice generated with tax, transport, and other costs"],
                ["Delivered", "bg-emerald-100 text-emerald-800 border-emerald-200", "Order delivered to customer"],
                ["Cancelled", "bg-gray-100 text-gray-800 border-gray-200", "Order cancelled"],
              ].map(([label, color, desc]) => (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <Status label={label} color={color} />
                  <span className="text-[hsl(var(--muted-foreground))]">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: "Finalizing an Order",
        content: (
          <div className="space-y-2 text-xs">
            <p>Once an order is <strong>Approved</strong>, click <strong>Finalize Order</strong> to add invoice details:</p>
            <BulletList items={[
              "Set tax percentage",
              "Add transport cost and label",
              "Add other costs if any",
              "Assign a dispatcher",
              "System generates a PDF invoice automatically",
            ]} />
          </div>
        ),
      },
      {
        title: "Capturing Payments",
        content: (
          <div className="space-y-2 text-xs">
            <p>On a finalized order, click <strong>+ Payment</strong>:</p>
            <BulletList items={[
              "Enter amount received",
              "Select payment method (cash, bank transfer, etc.)",
              "Upload proof of payment (optional)",
              "Multiple partial payments are supported",
              "Remaining balance is tracked automatically",
            ]} />
          </div>
        ),
      },
    ],
  },
  {
    id: "purchase",
    icon: <Package className="h-4 w-4" />,
    title: "Purchase — PO Management",
    color: "text-purple-600",
    summary: "Three types of purchase orders: Regular (multi-supplier quotes), Direct (single supplier), and Imported (goods from abroad).",
    topics: [
      {
        title: "PO Types Overview",
        content: (
          <CompareTable
            headers={["Type", "Suppliers", "Approval", "Stages", "Use Case"]}
            rows={[
              ["Regular PO", "Multiple", "Required", "7 stages", "Competitive bidding"],
              ["Direct PO", "Single", "Skipped", "2 stages", "Known supplier, fast"],
              ["Imported PO", "Single", "Required", "10+ stages", "Goods from abroad"],
            ]}
          />
        ),
      },
      {
        title: "Regular PO Flow",
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
            <div className="space-y-1.5 mt-2">
              <InfoRow label="Draft" value="PO created, not yet submitted" />
              <InfoRow label="Sent to Admin" value="Submitted for admin approval" />
              <InfoRow label="Approved" value="Admin approved, ready to share with suppliers" />
              <InfoRow label="Sharing" value="PO sent to multiple suppliers via WhatsApp" />
              <InfoRow label="Quoted" value="Suppliers have submitted their quotes" />
              <InfoRow label="Finalized" value="Best supplier selected, PO finalized" />
              <InfoRow label="In Inventory" value="Items received and added to inventory" />
            </div>
          </div>
        ),
      },
      {
        title: "How to Create a Regular PO",
        content: (
          <div className="space-y-2 text-xs">
            <p>Go to <strong>Purchase → POs</strong> and click <strong>+ New PO</strong>.</p>
            <BulletList items={[
              "Select supplier type (Local or Imported)",
              "Add items with descriptions, quantities, and units",
              "Set delivery date and receiving location",
              "Add notes",
              'Click "Send to Admin" — status becomes Sent to Admin',
            ]} />
          </div>
        ),
      },
      {
        title: "Direct PO Flow",
        content: (
          <div className="space-y-3">
            <Flow steps={[
              { label: "Direct", desc: "Goes to Finance" },
              { label: "In Inventory", desc: "Items received" },
            ]} />
            <div className="space-y-2 text-xs mt-2">
              <p>Click <strong>+ Direct PO</strong> from the dropdown:</p>
              <BulletList items={[
                "Select a single supplier",
                "Add items with unit prices",
                "Add tax, transport, and other costs",
                'Click "Send to Finance" — PO is immediately active',
                "No admin approval needed",
                "Finance processes payment, then moves to inventory",
              ]} />
            </div>
          </div>
        ),
      },
      {
        title: "Imported PO Flow",
        content: (
          <div className="space-y-3">
            <Flow steps={[
              { label: "Admin Draft" },
              { label: "Purchase" },
              { label: "Finance 1" },
              { label: "Purchase 2" },
              { label: "Pending Approval" },
              { label: "Approved" },
              { label: "Finance 2" },
              { label: "Purchase Final" },
              { label: "Inventory" },
            ]} />
            <div className="space-y-1.5 mt-2 text-xs">
              <InfoRow label="Admin Draft" value="Admin creates PO and uploads initial documents" />
              <InfoRow label="Purchase" value="Purchase team adds items, supplier, and prices" />
              <InfoRow label="Finance 1" value="Finance uploads payment documents" />
              <InfoRow label="Purchase 2" value="Purchase adds PSSID number and additional docs" />
              <InfoRow label="Pending Approval" value="Sent to admin for final approval" />
              <InfoRow label="Approved" value="Admin approves the imported PO" />
              <InfoRow label="Finance 2" value="Finance processes payments and duties" />
              <InfoRow label="Purchase Final" value="Purchase reviews the complete flow" />
              <InfoRow label="Inventory" value="Items added to inventory" />
            </div>
          </div>
        ),
      },
      {
        title: "Managing Suppliers",
        content: (
          <div className="space-y-2 text-xs">
            <p>Go to <strong>Purchase → Suppliers</strong> tab.</p>
            <BulletList items={[
              "Add suppliers with name, type (local/imported), contact, email",
              "Add bank details for payment processing",
              "Suppliers appear in PO creation dropdowns",
              "Local suppliers: used for regular and direct POs",
              "Imported suppliers: used for imported PO flows",
            ]} />
          </div>
        ),
      },
    ],
  },
  {
    id: "inventory",
    icon: <Warehouse className="h-4 w-4" />,
    title: "Inventory",
    color: "text-green-600",
    summary: "Track stock levels. Items enter inventory from finalized POs and leave when used in client orders.",
    topics: [
      {
        title: "How Inventory Works",
        content: (
          <div className="space-y-2 text-xs">
            <BulletList items={[
              'Items are added to inventory when a PO reaches "In Inventory" status',
              "Items are deducted when a client order is delivered",
              "If an order is deleted, inventory is automatically restored",
              "Each item tracks: description, quantity, unit, unit price, supplier, PO number",
            ]} />
          </div>
        ),
      },
      {
        title: "Inventory History",
        content: (
          <div className="space-y-2 text-xs">
            <p>Go to <strong>Inventory → History</strong> tab to see all transactions:</p>
            <BulletList items={[
              "IN transactions: items received from POs",
              "OUT transactions: items used in client orders",
              "Each transaction shows date, quantity, reference order/PO",
            ]} />
          </div>
        ),
      },
      {
        title: "Stock in Client Orders",
        content: (
          <div className="space-y-2 text-xs">
            <p>When creating a client order:</p>
            <BulletList items={[
              'Click "Add from Inventory" to pick items from stock',
              "Available quantity is shown and enforced",
              "Cost price is pre-filled; you can adjust the selling price",
              "Stock is deducted only when the order is delivered",
            ]} />
          </div>
        ),
      },
    ],
  },
  {
    id: "dispatches",
    icon: <Truck className="h-4 w-4" />,
    title: "Dispatches",
    color: "text-orange-600",
    summary: "Track deliveries with courier details, driver info, and expected delivery dates.",
    topics: [
      {
        title: "How to Create a Dispatch",
        content: (
          <div className="space-y-2 text-xs">
            <p>Go to <strong>Dispatches</strong> and click <strong>+ New Dispatch</strong>.</p>
            <BulletList items={[
              "Order ID is auto-generated (editable)",
              "Enter customer name, phone, and delivery address",
              "Add items with specs, quantity, unit, and price",
              "Set dispatch date and expected delivery date",
              "Choose courier service: Own Driver, TCS, Leopards, M&P, Trax",
              "For Own Driver: enter driver name, phone, vehicle number",
              "For courier companies: enter tracking ID",
              "Add notes if needed",
            ]} />
          </div>
        ),
      },
      {
        title: "Dispatch Statuses",
        content: (
          <div className="space-y-2">
            {[
              ["Pending", "bg-yellow-500/10 text-yellow-600 border-yellow-200", "Dispatch created, not yet picked up"],
              ["In Transit", "bg-blue-500/10 text-blue-600 border-blue-200", "Package is on the way"],
              ["Delivered", "bg-green-500/10 text-green-600 border-green-200", "Successfully delivered"],
              ["Cancelled", "bg-red-500/10 text-red-600 border-red-200", "Dispatch cancelled"],
            ].map(([label, color, desc]) => (
              <div key={label} className="flex items-center gap-3 text-xs">
                <Status label={label} color={color} />
                <span className="text-[hsl(var(--muted-foreground))]">{desc}</span>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "Downloading Dispatch PDF",
        content: (
          <div className="space-y-2 text-xs">
            <p>Click on any dispatch to open the detail view, then click <strong>Download PDF</strong>.</p>
            <BulletList items={[
              "PDF includes all dispatch details, items, courier info, and dates",
              "Voltrix logo and branding included",
              "File is saved as: ORD-XXXXXXXX-dispatch.pdf",
            ]} />
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
    summary: "Track payments, expenses, and financial records. Also view client order payments and purchase order finances.",
    topics: [
      {
        title: "Finance Tabs",
        content: (
          <div className="space-y-2 text-xs">
            <BulletList items={[
              "Manage: Add and track general finance records (payments, expenses, invoices, salaries, taxes, refunds)",
              "Client Orders: View and manage payments for client orders",
              "Purchase Orders: View finalized POs and their payment status",
            ]} />
          </div>
        ),
      },
      {
        title: "How to Add a Finance Record",
        content: (
          <div className="space-y-2 text-xs">
            <p>Go to <strong>Finance → Manage</strong> and click <strong>+ Add Record</strong>.</p>
            <BulletList items={[
              "Enter title and amount",
              "Select currency (PKR, USD, EUR, GBP, AED)",
              "Choose category: Payment, Expense, Invoice, Salary, Tax, Refund, Other",
              "Add a tag/label for grouping (e.g. Q1, Ahmed, HQ)",
              "Enter purpose and notes",
              "Upload proof (image or PDF, max 2MB)",
            ]} />
          </div>
        ),
      },
      {
        title: "Filtering Records",
        content: (
          <div className="space-y-2 text-xs">
            <p>Click the <strong>Filters</strong> button to show/hide filters:</p>
            <BulletList items={[
              "Search by title, purpose, tag, or notes",
              "Filter by category",
              "Filter by tag",
              "Filter by date range — total updates automatically",
              "Click Clear to reset all filters",
            ]} />
          </div>
        ),
      },
    ],
  },
  {
    id: "hrm",
    icon: <UserCog className="h-4 w-4" />,
    title: "HRM — Human Resources",
    color: "text-pink-600",
    summary: "Manage employees, track attendance, and handle HR records.",
    topics: [
      {
        title: "Managing Employees",
        content: (
          <div className="space-y-2 text-xs">
            <p>Go to <strong>HRM</strong> to manage your team.</p>
            <BulletList items={[
              "Add employees with name, role, department, phone, email",
              "Upload employee documents",
              "Track joining date and employment status",
              "View employee details and history",
            ]} />
          </div>
        ),
      },
    ],
  },
  {
    id: "docs",
    icon: <FileText className="h-4 w-4" />,
    title: "Docs — Document Management",
    color: "text-indigo-600",
    summary: "Upload, organize, and manage all company documents in one place.",
    topics: [
      {
        title: "How to Upload a Document",
        content: (
          <div className="space-y-2 text-xs">
            <p>Go to <strong>Docs</strong> and click <strong>+ Upload</strong>.</p>
            <BulletList items={[
              "Enter document title and select category",
              "Add tags for easy searching",
              "Upload file (PDF, images, Word, Excel)",
              "Documents are stored and accessible to authorized users",
            ]} />
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
    summary: "Overview of pending approvals, recent activity, and key metrics.",
    topics: [
      {
        title: "Dashboard Overview",
        content: (
          <div className="space-y-2 text-xs">
            <BulletList items={[
              "Pending client order approvals — approve or reject directly",
              "Recent orders and their statuses",
              "Quick access to key modules",
              "Real-time updates via Supabase",
            ]} />
          </div>
        ),
      },
    ],
  },
  {
    id: "roles",
    icon: <Globe className="h-4 w-4" />,
    title: "User Roles & Access",
    color: "text-amber-600",
    summary: "Different roles have access to different modules. Superadmin has full access.",
    topics: [
      {
        title: "Role Overview",
        content: (
          <CompareTable
            headers={["Role", "Access"]}
            rows={[
              ["Superadmin", "Full access to all modules including user management"],
              ["Admin", "Access to dashboard, CRM, purchase approval, finance"],
              ["Purchase", "Purchase orders, inventory, suppliers"],
              ["Finance", "Finance records, PO payments, client order payments"],
              ["Sales / CRM", "Client management, order creation"],
              ["HR", "HRM module"],
              ["Dispatch", "Dispatches module"],
            ]}
          />
        ),
      },
      {
        title: "Managing Users",
        content: (
          <div className="space-y-2 text-xs">
            <p>Only <strong>Superadmin</strong> can manage users. Go to the <strong>Users panel</strong> (top-right icon).</p>
            <BulletList items={[
              "Create new users with username and password",
              "Assign roles and module access",
              "Enable or disable user accounts",
              "Reset passwords",
            ]} />
          </div>
        ),
      },
    ],
  },
]

// ── Topic accordion ───────────────────────────────────────
function TopicItem({ topic }: { topic: Topic }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[hsl(var(--muted))]/30 transition-colors"
      >
        <span className="text-xs font-medium">{topic.title}</span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 text-[hsl(var(--foreground))]">
          {topic.content}
        </div>
      )}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────
function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border bg-[hsl(var(--card))] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[hsl(var(--muted))]/20 transition-colors"
      >
        <div className={`h-8 w-8 rounded-lg bg-[hsl(var(--muted))]/60 flex items-center justify-center ${section.color}`}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{section.title}</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{section.summary}</p>
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

// ── Main export ───────────────────────────────────────────
export function HelpContent() {
  const [search, setSearch] = useState("")

  const filtered = search
    ? SECTIONS.map(s => ({
        ...s,
        topics: s.topics.filter(t =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          s.title.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(s => s.topics.length > 0)
    : SECTIONS

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Search */}
      <div className="relative">
        <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search help topics..."
          className="w-full h-10 rounded-lg border bg-[hsl(var(--background))] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6] transition-colors"
        />
      </div>

      {/* Quick stats */}
      {!search && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Modules", value: SECTIONS.length },
            { label: "Topics", value: SECTIONS.reduce((s, sec) => s + sec.topics.length, 0) },
            { label: "Flows", value: "3 PO types" },
          ].map(s => (
            <div key={s.label} className="rounded-lg border bg-[hsl(var(--card))] px-4 py-3 text-center">
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-2">
        {filtered.map(section => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">
          No topics found for "{search}"
        </div>
      )}
    </div>
  )
}
