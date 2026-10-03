"use client"
import { useState, useEffect } from "react"
import { getUsers, saveUser, deleteUser, ALL_MODULES, MODULE_LABELS, ASSIGNABLE_ROLES, ROLE_LABELS, roleHasAllModules, modulesForRole, isViewOnlyUser, isInvestorUser, normalizePurchaseScopes, type User, type Module, type UserRole } from "@/lib/auth"
import { getPurchaseScopes, formatPurchaseScope, type PurchaseScope } from "@/lib/purchase-scopes"
import { investorCrm2Stats } from "@/lib/investor-fake-crm"
import {
  formatInvestorCrore,
  formatInvestorRs,
  investorPayoutSummary,
  INVESTOR_SALES_POOL_RATE,
  normalizeInvestorInvestedAt,
  normalizeInvestorRoiPeriod,
  type InvestorRoiPeriod,
} from "@/lib/investor-payout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Eye, EyeOff, Pencil, Check, Trash2, Copy, Search } from "lucide-react"
import { NotificationEmailsEditor } from "@/components/settings/notification-emails-editor"

type InvestorTermsNext = {
  investorInvestment: number
  investorRoiPercent: number
  investorRoiPeriod: InvestorRoiPeriod
  investorInvestedAt: string
  investorInvestedUntil: string
}

function InvestorTermsFields({
  investment,
  roiPercent,
  period,
  investedAt,
  investedUntil,
  editing,
  onChange,
}: {
  investment: number
  /** Stored as investorRoiPercent — share of investor pool (%). */
  roiPercent: number
  period: InvestorRoiPeriod
  investedAt: string
  investedUntil: string
  editing: boolean
  onChange: (next: InvestorTermsNext) => void
}) {
  const salesAmount = investorCrm2Stats().augSep
  const summary = investorPayoutSummary({
    investment,
    poolSharePercent: roiPercent,
    salesAmount,
    salesLabel: "Aug–Sep sales",
  })
  const patch = (partial: Partial<InvestorTermsNext>) =>
    onChange({
      investorInvestment: investment,
      investorRoiPercent: roiPercent,
      investorRoiPeriod: period,
      investorInvestedAt: investedAt,
      investorInvestedUntil: investedUntil,
      ...partial,
    })

  return (
    <div className="rounded-md border border-[#1a9f9a]/30 bg-[#1a9f9a]/5 p-2.5 space-y-2">
      <p className="text-[10px] font-semibold text-[#1a9f9a]">Investor returns (their dashboard only)</p>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="space-y-0.5">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Investment (PKR)</span>
          <input
            type="number"
            min={0}
            disabled={!editing}
            value={investment || ""}
            onChange={(e) => patch({ investorInvestment: Number(e.target.value) || 0 })}
            className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-70"
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Share of investor pool (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            disabled={!editing}
            value={roiPercent || ""}
            onChange={(e) => patch({ investorRoiPercent: Number(e.target.value) || 0 })}
            className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-70"
          />
        </label>
      </div>
      {summary.configured ? (
        <div className="rounded border border-[#1a9f9a]/40 bg-[hsl(var(--background))]/80 px-2.5 py-2 space-y-0.5">
          <p className="text-xs font-semibold text-[#1a9f9a]">
            They receive {formatInvestorRs(summary.due)}
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            ROI = {formatInvestorCrore(salesAmount)} × {INVESTOR_SALES_POOL_RATE}% × {roiPercent}% ={" "}
            {formatInvestorRs(summary.due)}
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Set Investment (PKR) and Share of investor pool (%). ROI = Aug–Sep sales ×{" "}
          {INVESTOR_SALES_POOL_RATE}% × pool share %.
        </p>
      )}
    </div>
  )
}

function PurchaseScopePicker({
  scopes,
  selected,
  editing,
  onChange,
}: {
  scopes: PurchaseScope[]
  selected: string[]
  editing: boolean
  onChange: (next: string[]) => void
}) {
  function toggle(id: string) {
    const has = selected.includes(id)
    onChange(has ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div className="space-y-1">
      <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Purchase ledgers</label>
      <div className="flex flex-wrap gap-1.5">
        {scopes.map(scope => {
          const active = selected.includes(scope.id)
          return (
            <button
              key={scope.id}
              type="button"
              disabled={!editing}
              onClick={() => toggle(scope.id)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${
                active
                  ? "bg-[#1faca6] text-white border-transparent"
                  : "text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:border-[#1faca6]/40"
              } disabled:cursor-default`}
            >
              {scope.name}
              <span className="opacity-70 ml-1">({scope.id})</span>
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        User will only see selected purchase ledgers (e.g. Attock, Wah Cantt, Main Office).
      </p>
    </div>
  )
}

function UserRow({
  u,
  onSave,
  onDelete,
  purchaseScopes,
}: {
  u: User
  onSave: (u: User) => void
  onDelete: (id: string) => void
  purchaseScopes: PurchaseScope[]
}) {
  const [editing, setEditing] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [draft, setDraft] = useState<User>(u)

  useEffect(() => {
    setDraft(u)
  }, [u])

  function toggleModule(m: Module) {
    setDraft(d => ({
      ...d,
      modules: d.modules.includes(m) ? d.modules.filter(x => x !== m) : [...d.modules, m],
    }))
  }

  function save() {
    onSave({
      ...draft,
      modules: modulesForRole(draft.role, draft.modules),
      purchaseScopes: normalizePurchaseScopes(draft.purchaseScopes),
    })
    setEditing(false)
  }
  function cancel() { setDraft(u); setEditing(false) }

  return (
    <div className="border rounded-lg p-3 space-y-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          {editing ? (
            <>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <p className="font-medium truncate">{u.name}</p>
              </div>
              <div className="flex items-center gap-1">
                <p className="text-[hsl(var(--muted-foreground))] truncate">{u.email}</p>
                <button type="button" onClick={() => navigator.clipboard.writeText(u.email)} className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer" title="Copy email">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
          <div className="relative flex items-center">
            <input readOnly={!editing} type={showPw ? "text" : "password"} value={draft.password}
              onChange={e => setDraft(d => ({ ...d, password: e.target.value }))}
              className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 pr-14 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
            <div className="absolute right-1.5 flex items-center gap-1">
              <button type="button" onClick={() => navigator.clipboard.writeText(draft.password)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer" title="Copy password">
                <Copy className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => setShowPw(v => !v)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer">
                {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <Badge variant={roleHasAllModules(u.role) ? "default" : isInvestorUser(u.role) ? "default" : isViewOnlyUser(u.role) ? "outline" : "secondary"} className={`text-[10px] ${isInvestorUser(u.role) ? "bg-[#1a9f9a] hover:bg-[#1a9f9a]" : ""}`}>
            {ROLE_LABELS[u.role] ?? u.role}
          </Badge>
          {editing ? (
            <>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600 cursor-pointer" onClick={save}><Check className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 cursor-pointer" onClick={cancel}><X className="h-3 w-3" /></Button>
            </>
          ) : (
            <>
              <Button size="icon" variant="ghost" className="h-6 w-6 cursor-pointer" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
              {u.role !== "superadmin" && (
                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 cursor-pointer" onClick={() => onDelete(u.id)}><Trash2 className="h-3 w-3" /></Button>
              )}
            </>
          )}
        </div>
      </div>
      {!isInvestorUser(draft.role) && (
        <div className="pt-1 border-t border-dashed">
          <NotificationEmailsEditor
            emails={draft.notificationEmails ?? []}
            enabled={draft.emailNotificationsEnabled !== false}
            onEmailsChange={emails => setDraft(d => ({ ...d, notificationEmails: emails }))}
            onEnabledChange={enabled => setDraft(d => ({ ...d, emailNotificationsEnabled: enabled }))}
            compact
            readOnly={!editing}
          />
        </div>
      )}
      {isInvestorUser(draft.role) && (
        <InvestorTermsFields
          investment={draft.investorInvestment || 0}
          roiPercent={draft.investorRoiPercent || 0}
          period={normalizeInvestorRoiPeriod(draft.investorRoiPeriod)}
          investedAt={normalizeInvestorInvestedAt(draft.investorInvestedAt)}
          investedUntil={normalizeInvestorInvestedAt(draft.investorInvestedUntil)}
          editing={editing}
          onChange={(next) =>
            setDraft((d) => ({
              ...d,
              investorInvestment: next.investorInvestment,
              investorRoiPercent: next.investorRoiPercent,
            }))
          }
        />
      )}
      {editing && u.role !== "superadmin" && (
        <div className="space-y-2">
          <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Role</label>
          <select
            value={draft.role}
            onChange={e => {
              const role = e.target.value as UserRole
              setDraft(d => ({
                ...d,
                role,
                modules: modulesForRole(role, d.modules),
              }))
            }}
            className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            {ASSIGNABLE_ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          {isViewOnlyUser(draft.role) && !isInvestorUser(draft.role) && (
            <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              View only users can open the selected pages and browse data, but cannot create, edit, or delete records.
            </p>
          )}
          {(draft.modules.includes("purchase") || roleHasAllModules(draft.role)) && (
            <PurchaseScopePicker
              scopes={purchaseScopes}
              selected={draft.purchaseScopes ?? []}
              editing={editing}
              onChange={next => setDraft(d => ({ ...d, purchaseScopes: next }))}
            />
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {roleHasAllModules(draft.role) ? (
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">All pages</span>
        ) : isInvestorUser(draft.role) ? (
          <span className="text-[10px] text-[#1a9f9a]">
            Login: {draft.email} + password at /investor/login
          </span>
        ) : ALL_MODULES.map(m => {
          const has = draft.modules.includes(m)
          return (
            <button key={m} type="button" disabled={!editing} onClick={() => toggleModule(m)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                has ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-transparent"
                    : "text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
              } disabled:cursor-default`}>
              {MODULE_LABELS[m]}
            </button>
          )
        })}
      </div>
      {(draft.modules.includes("purchase") || roleHasAllModules(draft.role)) && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Purchase ledgers: {(draft.purchaseScopes ?? []).map(id => formatPurchaseScope(id, purchaseScopes)).join(" · ") || "None"}
        </p>
      )}
    </div>
  )
}

function AddUserForm({
  onAdd,
  onCancel,
  purchaseScopes,
  initialRole = "user",
}: {
  onAdd: (u: User) => void
  onCancel: () => void
  purchaseScopes: PurchaseScope[]
  initialRole?: UserRole
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>(initialRole)
  const [modules, setModules] = useState<Module[]>(() => modulesForRole(initialRole, []))
  const [notificationEmails, setNotificationEmails] = useState<string[]>([])
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["P1"])
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true)
  const [showPw, setShowPw] = useState(false)
  const [investorInvestment, setInvestorInvestment] = useState(0)
  const [investorRoiPercent, setInvestorRoiPercent] = useState(0)
  const [investorRoiPeriod] = useState<InvestorRoiPeriod>("annual")
  const [investorInvestedAt] = useState("")
  const [investorInvestedUntil] = useState("")

  function toggleModule(m: Module) {
    setModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onAdd({
      id: Date.now().toString(),
      name,
      email,
      password,
      role,
      modules: modulesForRole(role, modules),
      notificationEmails,
      emailNotificationsEnabled,
      purchaseScopes: normalizePurchaseScopes(selectedScopes),
      investorInvestment: isInvestorUser(role) ? investorInvestment : 0,
      investorRoiPercent: isInvestorUser(role) ? investorRoiPercent : 0,
      investorRoiPeriod: isInvestorUser(role) ? investorRoiPeriod : "annual",
      investorInvestedAt: isInvestorUser(role) ? normalizeInvestorInvestedAt(investorInvestedAt) : "",
      investorInvestedUntil: isInvestorUser(role) ? normalizeInvestorInvestedAt(investorInvestedUntil) : "",
    })
  }

  return (
    <form onSubmit={submit} className="border rounded-lg p-3 space-y-2 bg-[hsl(var(--muted))]/30 text-xs">
      <p className="font-semibold text-xs">{isInvestorUser(role) ? "New investor" : "New User"}</p>
      {isInvestorUser(role) && (
        <p className="text-[10px] text-[#1a9f9a]">
          They sign in at /investor/login with this email and password. Each investor gets their own login.
        </p>
      )}
      <input required placeholder="Full name" value={name} onChange={e => setName(e.target.value)}
        className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
      <input required type="email" placeholder={isInvestorUser(role) ? "Investor login email" : "Email"} value={email} onChange={e => setEmail(e.target.value)}
        className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
      <div className="relative">
        <input required type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
          {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Role</label>
        <select
          value={role}
          onChange={e => {
            const next = e.target.value as UserRole
            setRole(next)
            if (roleHasAllModules(next)) setModules([...ALL_MODULES])
            else if (next === "sales_agent") setModules(["crm"])
            else if (next === "investor") setModules(["dashboard", "crm"])
          }}
          className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          {ASSIGNABLE_ROLES.map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        {isInvestorUser(role) && (
          <>
            <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              Give them this email and password. They cannot open the staff ERP — only the investor dashboard and CRM.
            </p>
            <InvestorTermsFields
              investment={investorInvestment}
              roiPercent={investorRoiPercent}
              period={investorRoiPeriod}
              investedAt={investorInvestedAt}
              investedUntil={investorInvestedUntil}
              editing
              onChange={(next) => {
                setInvestorInvestment(next.investorInvestment)
                setInvestorRoiPercent(next.investorRoiPercent)
              }}
            />
          </>
        )}
        {isViewOnlyUser(role) && !isInvestorUser(role) && (
          <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            Assign the pages this user can view. They will not be able to change anything in the ERP.
          </p>
        )}
      </div>
      {!isInvestorUser(role) && (
        <NotificationEmailsEditor
          emails={notificationEmails}
          enabled={emailNotificationsEnabled}
          onEmailsChange={setNotificationEmails}
          onEnabledChange={setEmailNotificationsEnabled}
          compact
        />
      )}
      {(modules.includes("purchase") || roleHasAllModules(role)) && (
        <PurchaseScopePicker
          scopes={purchaseScopes}
          selected={selectedScopes}
          editing
          onChange={setSelectedScopes}
        />
      )}
      {roleHasAllModules(role) ? (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">All pages — full access to every module</p>
      ) : isInvestorUser(role) ? (
        <p className="text-[10px] text-[#1a9f9a]">
          Investor portal login: /investor/login
        </p>
      ) : (
      <div className="flex flex-wrap gap-1">
        {ALL_MODULES.map(m => {
          const has = modules.includes(m)
          return (
            <button key={m} type="button" onClick={() => toggleModule(m)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                has ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-transparent"
                    : "text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
              }`}>
              {MODULE_LABELS[m]}
            </button>
          )
        })}
      </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" className="h-7 text-xs flex-1 cursor-pointer">
          {isInvestorUser(role) ? "Create investor login" : "Create"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

export function UsersManager() {
  const [users, setUsers] = useState<User[]>([])
  const [purchaseScopes, setPurchaseScopes] = useState<PurchaseScope[]>([])
  const [adding, setAdding] = useState<"user" | "investor" | false>(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    setLoading(true)
    Promise.all([getUsers(), getPurchaseScopes()]).then(([u, scopes]) => {
      setUsers(u)
      setPurchaseScopes(scopes)
      setLoading(false)
    })
  }, [])

  async function handleSave(updated: User) {
    await saveUser(updated)
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
  }

  async function handleDelete(id: string) {
    await deleteUser(id)
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  async function handleAdd(newUser: User) {
    await saveUser(newUser)
    setUsers(prev => [...prev, newUser])
    setAdding(false)
  }

  const q = search.trim().toLowerCase()
  const filteredUsers = !q
    ? users
    : users.filter((u) => {
        const roleLabel = (ROLE_LABELS[u.role] ?? u.role).toLowerCase()
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          roleLabel.includes(q) ||
          String(u.role).toLowerCase().includes(q)
        )
      })

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 max-w-3xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold">User Accounts</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Staff ERP users, plus investors who sign in at /investor/login with the email and password you set
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs cursor-pointer"
              onClick={() => setAdding(v => v === "investor" ? false : "investor")}
            >
              <Plus className="h-3.5 w-3.5" /> Add investor
            </Button>
            <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setAdding(v => v === "user" ? false : "user")}>
              <Plus className="h-3.5 w-3.5" /> Add user
            </Button>
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role…"
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-3">
          {loading && <p className="text-xs text-center text-[hsl(var(--muted-foreground))] py-8">Loading...</p>}
          {adding && (
            <AddUserForm
              key={adding}
              initialRole={adding === "investor" ? "investor" : "user"}
              onAdd={handleAdd}
              onCancel={() => setAdding(false)}
              purchaseScopes={purchaseScopes}
            />
          )}
          {!loading && filteredUsers.length === 0 && (
            <p className="text-xs text-center text-[hsl(var(--muted-foreground))] py-8">
              {q ? `No users match “${search.trim()}”.` : "No users yet."}
            </p>
          )}
          {!loading && filteredUsers.map(u => (
            <UserRow key={u.id} u={u} onSave={handleSave} onDelete={handleDelete} purchaseScopes={purchaseScopes} />
          ))}
        </div>
      </div>
    </div>
  )
}
