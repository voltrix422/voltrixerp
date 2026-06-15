import {
  ShoppingCart, Package, Truck, DollarSign, Users, BarChart3,
  FileText, Warehouse, UserCog, Globe, BookOpen, Wallet,
} from "lucide-react"
import {
  Flow, VerticalFlowchart, NumberedSteps, TipBox, Status,
  InfoRow, BulletList, CompareTable, GuideBody,
} from "./help-primitives"

export interface HelpTopic {
  title: string
  summary?: string
  content: React.ReactNode
  keywords?: string
}

export interface HelpSection {
  id: string
  icon: React.ReactNode
  title: string
  color: string
  bgColor: string
  summary: string
  topics: HelpTopic[]
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "start",
    icon: <BookOpen className="h-5 w-5" />,
    title: "Getting Started",
    color: "text-[#0d6b67]",
    bgColor: "bg-[#1faca6]/15",
    summary: "What Voltrix ERP does and how every module connects.",
    topics: [
      {
        title: "What is Voltrix ERP?",
        summary: "Plain-English overview of the system.",
        keywords: "beginner introduction overview what is erp",
        content: (
          <GuideBody>
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
          </GuideBody>
        ),
      },
      {
        title: "Full business flowchart",
        summary: "From buying stock to delivering to clients.",
        keywords: "flowchart diagram flow purchase sell inventory finance",
        content: (
          <GuideBody>
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
          </GuideBody>
        ),
      },
      {
        title: "Who does what?",
        summary: "Quick roles guide — which module each person uses.",
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
        title: "Daily cheat sheet",
        summary: "Most common tasks in one place.",
        keywords: "quick daily common tasks how to",
        content: (
          <GuideBody>
            <InfoRow label="New sale" value="CRM → Orders → + Order" />
            <InfoRow label="Approve an order" value="Dashboard or CRM → open order → Approve" />
            <InfoRow label="Take payment" value="Finance → Client Orders → + Payment" />
            <InfoRow label="Ship to client" value="Inventory → Client Orders → Fulfill / Dispatch" />
            <InfoRow label="Send stock to branch" value="Inventory → Branches → Send" />
            <InfoRow label="Add stock manually" value="Inventory → Manual added inventory" />
            <InfoRow label="Request petty cash" value="Finance → Records & Petty Cash → Request Cash" />
            <InfoRow label="Buy from supplier" value="Purchase → + New PO" />
            <InfoRow label="Check what's owed" value="Finance → Client Orders → filter Outstanding credit" />
          </GuideBody>
        ),
      },
    ],
  },
  {
    id: "dashboard",
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Dashboard",
    color: "text-cyan-700",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    summary: "Pending approvals, alerts, and quick actions.",
    topics: [
      {
        title: "What you see on the Dashboard",
        summary: "Cards and notifications on your home screen.",
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
        title: "How to approve items",
        summary: "Approve or reject orders, transfers, and petty cash.",
        content: (
          <NumberedSteps steps={[
            "Open Dashboard from the sidebar (first item).",
            "Find the card for Client Orders, Branch Transfers, or Petty Cash.",
            "Click the order/request to expand details.",
            "Click Approve or Reject — add a note if rejecting.",
            "The person who submitted it gets notified automatically.",
          ]} />
        ),
      },
    ],
  },
  {
    id: "crm",
    icon: <Users className="h-5 w-5" />,
    title: "CRM — Clients & Orders",
    color: "text-blue-700",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    summary: "Add clients, create orders, invoice, and send to inventory.",
    topics: [
      {
        title: "How to add a new client",
        summary: "Step-by-step client creation with NTN and contact details.",
        keywords: "add client create customer new client ntn tax",
        content: (
          <GuideBody>
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
          </GuideBody>
        ),
      },
      {
        title: "How to create a normal sales order",
        summary: "Full payment order from start to dispatch.",
        keywords: "create order new order sales order step",
        content: (
          <GuideBody>
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
              "Finance records payment before or after dispatch.",
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
          </GuideBody>
        ),
      },
      {
        title: "How to create a CREDIT order",
        summary: "Client pays later — credit approval flow.",
        keywords: "credit order pay later udhar outstanding balance",
        content: (
          <GuideBody>
            <p>
              A <strong>credit order</strong> lets you deliver goods even when the client has not paid the full
              amount yet. Finance must approve sending on credit.
            </p>
            <NumberedSteps steps={[
              "Create and get the order Approved and Finalized as normal.",
              "Go to Finance → Client Orders tab.",
              "Open the order — you will see how much is paid vs remaining balance.",
              'If no payment or partial payment: click "Approve on credit".',
              "Finance approves — order can move to inventory for dispatch.",
              "Invoice shows Credit terms and balance due.",
              "Record partial or full payments later as money comes in.",
              "Filter Finance → Outstanding credit to see who still owes money.",
            ]} />
            <TipBox type="warning">
              Credit orders stay flagged in Finance until the full balance is cleared. Check
              Finance → Client Orders → filter <strong>Outstanding credit</strong> regularly.
            </TipBox>
          </GuideBody>
        ),
      },
      {
        title: "Order statuses explained",
        summary: "What each status means from Pending to Delivered.",
        keywords: "status pending approved rejected finalized delivered",
        content: (
          <GuideBody>
            <Flow steps={[
              { label: "Pending Approval", desc: "Just created" },
              { label: "Approved", desc: "Admin OK" },
              { label: "Finalized", desc: "Invoice ready" },
              { label: "Confirmed", desc: "Payment/credit OK" },
              { label: "Processing", desc: "Being prepared" },
              { label: "Delivered", desc: "Done" },
            ]} />
            <div className="space-y-2 mt-4">
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
                <div key={label} className="flex items-start gap-3">
                  <Status label={label} color={color} />
                  <span className="text-[hsl(var(--muted-foreground))]">{desc}</span>
                </div>
              ))}
            </div>
          </GuideBody>
        ),
      },
      {
        title: "How to finalize an order & download invoice",
        summary: "Add tax, transport, and generate the invoice PDF.",
        keywords: "finalize invoice pdf tax transport",
        content: (
          <GuideBody>
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
          </GuideBody>
        ),
      },
      {
        title: "CRM FAQs",
        summary: "Common questions about orders and clients.",
        keywords: "faq question help problem",
        content: (
          <GuideBody>
            <div>
              <p className="font-semibold">Can I edit an order after creating it?</p>
              <p className="text-[hsl(var(--muted-foreground))] mt-1">Yes, before it is delivered. Open the order and edit lines, address, or notes.</p>
            </div>
            <div>
              <p className="font-semibold">Why can't I dispatch an order?</p>
              <p className="text-[hsl(var(--muted-foreground))] mt-1">It must be approved, finalized, and either paid or approved on credit. Dispatch happens in Inventory → Client Orders, not CRM.</p>
            </div>
            <div>
              <p className="font-semibold">What if the client pays in two installments?</p>
              <p className="text-[hsl(var(--muted-foreground))] mt-1">Finance → Client Orders → + Payment for each installment. Balance updates automatically.</p>
            </div>
          </GuideBody>
        ),
      },
    ],
  },
  {
    id: "finance",
    icon: <DollarSign className="h-5 w-5" />,
    title: "Finance",
    color: "text-teal-700",
    bgColor: "bg-teal-100 dark:bg-teal-900/30",
    summary: "Payments, credit, supplier payments, and reports.",
    topics: [
      {
        title: "Finance module map",
        summary: "Where to click inside Finance.",
        keywords: "finance tabs overview navigate",
        content: (
          <GuideBody>
            <p>Open <strong>Finance</strong> from the sidebar. Tabs inside:</p>
            <BulletList items={[
              "Overview — summary cards and quick stats",
              "Client Orders — payments & credit for sales orders",
              "Purchase Orders — payments owed to suppliers for POs",
              "Salaries & Payroll — staff and sales agent salaries",
              "Records & Petty Cash — general expenses and petty cash (see Petty Cash guide)",
              "Reports — financial reports by period",
            ]} />
          </GuideBody>
        ),
      },
      {
        title: "How to record a client payment",
        summary: "Record full or partial payments from clients.",
        keywords: "payment record receive money client order",
        content: (
          <GuideBody>
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
          </GuideBody>
        ),
      },
      {
        title: "How to approve & track credit orders",
        summary: "Allow dispatch before full payment.",
        keywords: "credit approve outstanding balance udhar",
        content: (
          <NumberedSteps steps={[
            "Finance → Client Orders.",
            "Use filter: Outstanding credit or On credit.",
            "Open an order with remaining balance.",
            'Click "Approve on credit" to allow dispatch without full payment.',
            "Warehouse can now fulfill the order in Inventory.",
            "When client pays later, add payments — balance reduces.",
            "When balance = 0, credit is cleared.",
          ]} />
        ),
      },
      {
        title: "How to pay a supplier",
        summary: "Record PO payments to suppliers.",
        keywords: "supplier po payment purchase pay",
        content: (
          <NumberedSteps steps={[
            "Go to Finance → Purchase Orders tab.",
            "Find the finalized PO that needs payment.",
            "Record payment amount and upload bank receipt.",
            "PO payment status updates.",
            "After goods received, PO moves to In Inventory (stock added).",
          ]} />
        ),
      },
      {
        title: "Finance records & expenses",
        summary: "General expense records (not petty cash).",
        keywords: "expense record finance record",
        content: (
          <GuideBody>
            <p>For general company expenses (not petty cash claims):</p>
            <NumberedSteps steps={[
              "Finance → Records & Petty Cash → Finance Records section.",
              '+ Add Record → title, amount, category, tag, notes.',
              "Upload proof (image/PDF).",
              "Use Filters to search by date, category, or tag.",
            ]} />
            <TipBox type="info">For staff petty cash (request money, receipts, settle), see the <strong>Petty Cash</strong> module guide.</TipBox>
          </GuideBody>
        ),
      },
    ],
  },
  {
    id: "petty-cash",
    icon: <Wallet className="h-5 w-5" />,
    title: "Petty Cash",
    color: "text-green-700",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    summary: "Request money, spend it, add receipts, and settle.",
    topics: [
      {
        title: "What is petty cash?",
        summary: "Small cash for daily office expenses.",
        keywords: "petty cash what is introduction",
        content: (
          <GuideBody>
            <p>
              Petty cash is <strong>small amounts of money</strong> given to staff for day-to-day expenses
              like fuel, tea, stationery, or small purchases. Everything is tracked in the system so
              nothing gets lost.
            </p>
            <BulletList items={[
              "Staff <strong>request</strong> cash when they need money",
              "Admin/CEO <strong>approves</strong> on Dashboard or Petty Cash page",
              "Staff <strong>spend</strong> and upload <strong>receipts</strong> for each expense",
              "When done, the allocation is <strong>settled</strong> — accounts are closed",
            ]} />
            <p className="mt-2">Open: <strong>Finance → Records & Petty Cash</strong> (Petty Cash section at the bottom).</p>
          </GuideBody>
        ),
      },
      {
        title: "Petty cash full flowchart",
        summary: "Request → approve → spend → settle.",
        keywords: "petty cash flowchart flow request settle",
        content: (
          <VerticalFlowchart nodes={[
            { title: "Employee requests cash", body: "Amount + purpose", variant: "start" },
            { title: "Status: Pending", body: "Waits for admin approval", variant: "warning" },
            { title: "Admin approves", body: "Dashboard or Petty Cash → Approve", variant: "action" },
            { title: "Status: Active", body: "Employee can spend", variant: "action" },
            { title: "Employee adds receipts", body: "Each expense with proof photo", variant: "action" },
            { title: "Receipts reviewed", body: "Approved or rejected", variant: "action" },
            { title: "Settle allocation", body: "When all expenses recorded", variant: "action" },
            { title: "Status: Settled", body: "Case closed", variant: "end" },
          ]} />
        ),
      },
      {
        title: "How to request money (employee)",
        summary: "Submit a petty cash request.",
        keywords: "request petty cash ask money employee",
        content: (
          <GuideBody>
            <NumberedSteps steps={[
              "Go to Finance → Records & Petty Cash.",
              "Scroll to the Petty Cash section.",
              'Click "Request Cash" (top-right of petty cash area).',
              "Enter the amount you need (PKR).",
              "Enter purpose — e.g. Office tea & snacks for Lahore trip.",
              "Add notes if needed (optional).",
              'Click Submit — status becomes Pending.',
              "Wait for admin to approve on Dashboard or Petty Cash page.",
              "You will see your balance update once approved (status: Active).",
            ]} />
            <TipBox>Only one active request at a time per person. Wait for approval before requesting again.</TipBox>
          </GuideBody>
        ),
      },
      {
        title: "How to approve a request (admin)",
        summary: "Approve or reject staff petty cash requests.",
        keywords: "approve petty cash admin dashboard manager",
        content: (
          <GuideBody>
            <p>Admins can approve from <strong>two places</strong>:</p>
            <p className="font-semibold mt-3">Option A — Dashboard</p>
            <NumberedSteps steps={[
              "Open Dashboard.",
              "Find the Petty Cash card with pending requests.",
              "Click the request to see employee name, amount, and purpose.",
              "Click Approve or Reject.",
            ]} />
            <p className="font-semibold mt-4">Option B — Petty Cash page</p>
            <NumberedSteps steps={[
              "Finance → Records & Petty Cash → Petty Cash section.",
              "See Pending requests banner at the top.",
              'Click "Approve" on the request.',
              "Upload bank transfer proof or record cash payout details.",
              "Confirm — allocation becomes Active.",
            ]} />
            <TipBox type="warning">Reject with a note if the purpose is unclear or amount seems wrong.</TipBox>
          </GuideBody>
        ),
      },
      {
        title: "How to add expense receipts",
        summary: "Record what you spent and upload proof.",
        keywords: "receipt expense petty cash spend upload",
        content: (
          <GuideBody>
            <NumberedSteps steps={[
              "Finance → Records & Petty Cash → Petty Cash section.",
              'Click "Add Receipt".',
              "Select your active allocation (the approved cash amount).",
              "Enter expense title — e.g. Petrol for delivery van.",
              "Enter amount spent.",
              "Upload photo of the bill/receipt (required).",
              "Add notes if needed.",
              "Save — receipt status is Pending until reviewed.",
            ]} />
            <p className="mt-3">Your remaining balance = allocated amount minus approved receipts.</p>
            <TipBox>Always upload a clear photo of the receipt. Blurry images may get rejected.</TipBox>
          </GuideBody>
        ),
      },
      {
        title: "How to settle petty cash",
        summary: "Close an allocation when all expenses are recorded.",
        keywords: "settle petty cash close finish done",
        content: (
          <GuideBody>
            <p>Settlement closes the petty cash case — no more receipts can be added.</p>
            <NumberedSteps steps={[
              "Make sure all expenses have receipts uploaded and approved.",
              "Open the allocation in Petty Cash → Allocations tab.",
              "Check remaining balance — should be zero or small change returned.",
              'Click "Settle" on the allocation.',
              "Confirm — status becomes Settled.",
            ]} />
            <TipBox type="info">
              If you spent less than allocated, the remaining amount should be returned to finance.
              If you spent more, admin may create a new allocation or reimburse separately.
            </TipBox>
            <CompareTable
              headers={["Status", "Meaning"]}
              rows={[
                ["Pending", "Request waiting for approval"],
                ["Active", "Approved — employee can spend and add receipts"],
                ["Settled", "All done — case closed"],
                ["Rejected", "Request was not approved"],
                ["Cancelled", "Allocation was cancelled"],
              ]}
            />
          </GuideBody>
        ),
      },
      {
        title: "Petty cash FAQs",
        summary: "Common questions about balances and receipts.",
        keywords: "petty cash faq balance negative",
        content: (
          <GuideBody>
            <div>
              <p className="font-semibold">What does a negative balance mean?</p>
              <p className="text-[hsl(var(--muted-foreground))] mt-1">Approved expenses exceed allocated amount. Admin reimburses when paying you back.</p>
            </div>
            <div>
              <p className="font-semibold">Can I add a receipt without an allocation?</p>
              <p className="text-[hsl(var(--muted-foreground))] mt-1">You need an active (approved) allocation first. Request cash, get approved, then add receipts.</p>
            </div>
            <div>
              <p className="font-semibold">Who can allocate cash directly?</p>
              <p className="text-[hsl(var(--muted-foreground))] mt-1">Finance managers and admins can use Allocate Cash to give money without a request (e.g. field staff float).</p>
            </div>
          </GuideBody>
        ),
      },
    ],
  },
  {
    id: "inventory",
    icon: <Warehouse className="h-5 w-5" />,
    title: "Inventory",
    color: "text-green-700",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    summary: "Stock, branches, QR scanning, and client order dispatch.",
    topics: [
      {
        title: "Inventory tabs explained",
        summary: "What each tab does.",
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
        title: "How to scan QR and receive stock",
        summary: "Add boxes to warehouse by scanning QR codes.",
        keywords: "scan qr receive stock inventory serial add",
        content: (
          <GuideBody>
            <p>When goods arrive from a PO, add them to inventory by scanning each box QR code.</p>
            <NumberedSteps steps={[
              "Go to Inventory → Inventory tab (main warehouse).",
              'Click "Scan QR" button.',
              "Point camera at the QR label on each box/unit.",
              "System reads serial number and product model automatically.",
              "Scan all boxes in the shipment.",
              'Click "Complete scan" to save all units to inventory.',
              "Stock appears in the inventory list with serial numbers.",
            ]} />
            <VerticalFlowchart nodes={[
              { title: "Goods arrive from supplier", variant: "start" },
              { title: "Inventory → Scan QR", variant: "action" },
              { title: "Scan each box label", body: "Serial + model captured", variant: "action" },
              { title: "Complete scan → saved", variant: "action" },
              { title: "Units appear in stock list", variant: "end" },
            ]} />
            <TipBox>Each QR code is unique per unit. Scanning the same code twice will warn you it's already in stock.</TipBox>
          </GuideBody>
        ),
      },
      {
        title: "How to scan & dispatch a client order",
        summary: "Full guide — QR scan mode vs qty-only mode.",
        keywords: "dispatch fulfill deliver client order scan serial qr",
        content: (
          <GuideBody>
            <p>Orders appear in <strong>Inventory → Client Orders</strong> after CRM approval and Finance payment/credit OK.</p>
            <VerticalFlowchart nodes={[
              { title: "Open order in Client Orders", variant: "start" },
              { title: 'Click "Create dispatch note"', variant: "action" },
              { title: "Choose dispatch method", body: "With QR scanning OR Without scanning", variant: "decision" },
              { title: "Step 1: Dispatcher tab", body: "Name, receiver, CNIC, vehicle", variant: "action" },
              { title: "Step 2: Scan QR tab", body: "Only if With QR scanning", variant: "action" },
              { title: "Submit → Dispatch Note PDF", variant: "action" },
              { title: "Order Delivered — stock deducted", variant: "end" },
            ]} />
            <p className="font-semibold mt-4">With QR scanning (recommended)</p>
            <NumberedSteps steps={[
              "Select With QR scanning.",
              "Dispatcher tab: enter dispatcher name, receiver name, CNIC, vehicle number.",
              "Scan QR tab: scan each unit's QR code — one per ordered quantity.",
              "All serials must match order qty before you can submit.",
              "Click Create dispatch note — PDF downloads with serial numbers for warranty.",
            ]} />
            <p className="font-semibold mt-4">Without scanning (qty only)</p>
            <NumberedSteps steps={[
              "Select Without scanning.",
              "Enter dispatcher and receiver details.",
              "Inventory qty is reduced without linking serial numbers.",
              "Use when QR labels are missing or for urgent dispatch.",
              "No warranty serials on dispatch note.",
            ]} />
            <TipBox type="warning">Without scanning does not record which serial went to which client. Use QR scanning whenever possible for warranty tracking.</TipBox>
          </GuideBody>
        ),
      },
      {
        title: "Dispatch note — what to fill in",
        summary: "Dispatcher, receiver, and vehicle fields explained.",
        keywords: "dispatch note dispatcher receiver cnic vehicle",
        content: (
          <GuideBody>
            <CompareTable
              headers={["Field", "What to enter"]}
              rows={[
                ["Dispatcher name", "Your name or warehouse staff sending the goods"],
                ["Receiver name", "Person receiving at client site"],
                ["Receiver CNIC", "National ID of receiver (for proof of delivery)"],
                ["Vehicle number", "Truck/van plate number or courier reference"],
                ["Delivery address", "Pre-filled from CRM order — verify before dispatch"],
              ]}
            />
            <p className="mt-3">After dispatch, download the PDF from the order card. It includes client details (NTN, tax ID, focal person) and all line items.</p>
          </GuideBody>
        ),
      },
      {
        title: "How to add manual inventory",
        summary: "Stock tracked by quantity only (no serial).",
        keywords: "manual inventory add stock quantity without serial",
        content: (
          <GuideBody>
            <NumberedSteps steps={[
              "Inventory → Manual added inventory tab.",
              'Click "Add Item".',
              "Enter product name — system generates a model code (MAN-...).",
              "Set total quantity and unit (pcs, boxes, etc.).",
              "Save — item appears in main warehouse inventory.",
              "Use +/- buttons to adjust stock later if needed.",
            ]} />
            <TipBox>Manual items dispatch without QR scan — just enter quantity.</TipBox>
          </GuideBody>
        ),
      },
      {
        title: "How to send stock to a branch",
        summary: "Transfer stock between main warehouse and branches.",
        keywords: "branch transfer send move stock warehouse",
        content: (
          <GuideBody>
            <NumberedSteps steps={[
              "Inventory → Branches → select source branch (e.g. Main warehouse).",
              "Click Send on a product row, or Send multiple for batch.",
              "Choose destination branch and quantity.",
              "Add a note if needed → Confirm.",
              "Download transfer PDF from branch Transfer history.",
              "To return stock: open destination branch → Send back to Main warehouse.",
            ]} />
            <TipBox type="warning">When stock returns to Main warehouse, quantities update automatically. Check History tab if numbers look wrong.</TipBox>
          </GuideBody>
        ),
      },
      {
        title: "Inventory History",
        summary: "Audit trail of every stock movement.",
        keywords: "history audit movement in out trace",
        content: (
          <BulletList items={[
            "See every IN (stock received) and OUT (stock sent) movement",
            "Filter by date, type (in/out), item, client, branch",
            "Export to Excel or PDF for audits",
            "Branch transfers, order dispatches, and PO receipts all appear here",
          ]} />
        ),
      },
    ],
  },
  {
    id: "purchase",
    icon: <ShoppingCart className="h-5 w-5" />,
    title: "Purchase",
    color: "text-purple-700",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    summary: "Regular, Direct, and Imported PO workflows.",
    topics: [
      {
        title: "PO types — which one to use?",
        summary: "Compare Regular, Direct, and Imported POs.",
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
        summary: "Quote comparison and admin approval.",
        content: (
          <GuideBody>
            <Flow steps={[
              { label: "Draft" }, { label: "Sent to Admin" }, { label: "Approved" },
              { label: "Sharing" }, { label: "Quoted" }, { label: "Finalized" }, { label: "In Inventory" },
            ]} />
            <NumberedSteps steps={[
              "Purchase → POs → + New PO.",
              "Add items, quantities, delivery date.",
              "Send to Admin for approval.",
              "Share with suppliers (WhatsApp) — collect quotes.",
              "Select best quote and finalize.",
              "Finance pays supplier → goods received → In Inventory.",
            ]} />
          </GuideBody>
        ),
      },
      {
        title: "Direct PO flow",
        summary: "Fastest path — no admin approval.",
        content: (
          <GuideBody>
            <Flow steps={[
              { label: "Create Direct PO" }, { label: "Send to Finance" }, { label: "Paid & In Inventory" },
            ]} />
            <NumberedSteps steps={[
              "Purchase → + Direct PO.",
              "Select single supplier, add items with prices.",
              "Add tax/transport if needed.",
              "Send to Finance — no admin approval.",
              "Finance pays → receive goods → In Inventory.",
            ]} />
          </GuideBody>
        ),
      },
      {
        title: "Imported PO flow",
        summary: "International shipments with multi-stage approval.",
        content: (
          <GuideBody>
            <Flow steps={[
              { label: "Admin Draft" }, { label: "Purchase" }, { label: "Finance" },
              { label: "Approved" }, { label: "Inventory" },
            ]} />
            <p className="mt-3">Used for international shipments. Multiple document upload stages between Purchase, Finance, and Admin.</p>
          </GuideBody>
        ),
      },
      {
        title: "Managing suppliers",
        summary: "Add and edit supplier records.",
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
    icon: <Truck className="h-5 w-5" />,
    title: "Dispatches",
    color: "text-orange-700",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    summary: "Standalone delivery tracking (separate from CRM dispatch).",
    topics: [
      {
        title: "Dispatches vs Inventory dispatch",
        summary: "When to use which module.",
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
        summary: "Track a delivery not linked to a CRM order.",
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
    icon: <UserCog className="h-5 w-5" />,
    title: "HRM",
    color: "text-pink-700",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    summary: "Staff records, attendance, KPIs, and salary slips.",
    topics: [
      {
        title: "Managing employees",
        summary: "Add staff and track performance.",
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
    icon: <FileText className="h-5 w-5" />,
    title: "Documentation",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    summary: "Store and organize company files.",
    topics: [
      {
        title: "Uploading documents",
        summary: "Add files with categories and tags.",
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
    icon: <Globe className="h-5 w-5" />,
    title: "User Roles & Access",
    color: "text-amber-700",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    summary: "Who can see which modules.",
    topics: [
      {
        title: "Role overview",
        summary: "What each role can access.",
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
        title: "Managing users",
        summary: "Create users and assign module access (Superadmin only).",
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

export function getTotalTopicCount() {
  return HELP_SECTIONS.reduce((s, sec) => s + sec.topics.length, 0)
}

export function findTopic(sectionId: string, topicIndex: number) {
  const section = HELP_SECTIONS.find((s) => s.id === sectionId)
  if (!section || topicIndex < 0 || topicIndex >= section.topics.length) return null
  return { section, topic: section.topics[topicIndex], topicIndex }
}

export function searchTopics(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const results: { section: HelpSection; topic: HelpTopic; topicIndex: number }[] = []
  for (const section of HELP_SECTIONS) {
    section.topics.forEach((topic, topicIndex) => {
      const match =
        topic.title.toLowerCase().includes(q) ||
        topic.summary?.toLowerCase().includes(q) ||
        section.title.toLowerCase().includes(q) ||
        section.summary.toLowerCase().includes(q) ||
        (topic.keywords?.toLowerCase().includes(q) ?? false)
      if (match) results.push({ section, topic, topicIndex })
    })
  }
  return results
}
