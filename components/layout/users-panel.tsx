"use client"
import { useState, useEffect } from "react"
import { getUsers, saveUser, deleteUser, ALL_MODULES, MODULE_LABELS, ASSIGNABLE_ROLES, ROLE_LABELS, roleHasAllModules, modulesForRole, isViewOnlyUser, isInvestorUser, isChinaMoneyUser, isInstallmentsUser, normalizePurchaseScopes, type User, type Module, type UserRole } from "@/lib/auth"
import { getPurchaseScopes, formatPurchaseScope, type PurchaseScope } from "@/lib/purchase-scopes"
import { investorCrm2SalesForInvestPeriod } from "@/lib/investor-fake-crm"
import {
  formatInvestorCrore,
  formatInvestorDay,
  formatInvestorRs,
  investorPayoutSummary,
  investorRoiEndDate,
  investorRoiRangeLabel,
  INVESTOR_ROI_PERIODS,
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
  const investLabel = investorRoiRangeLabel(investedAt, period, investedUntil)
  const { from: termFrom, to: termTo } = (() => {
    const from = investedAt
    const to = investedUntil || (investedAt ? investorRoiEndDate(investedAt, period) : "")
    return { from, to }
  })()
  const salesForPeriod = investorCrm2SalesForInvestPeriod(termFrom, termTo)
  const summary = investorPayoutSummary({
    investment,
    poolSharePercent: roiPercent,
    salesAmount: salesForPeriod.salesAmount,
    salesLabel: salesForPeriod.salesLabel,
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

  function applyTerm(nextPeriod: InvestorRoiPeriod) {
    const from = investedAt || new Date().toISOString().slice(0, 10)
    patch({
      investorRoiPeriod: nextPeriod,
      investorInvestedAt: from,
      investorInvestedUntil: investorRoiEndDate(from, nextPeriod),
    })
  }

  return (
    <div className="rounded-md border border-[#1a9f9a]/30 bg-[#1a9f9a]/5 p-2.5 space-y-2">
      <p className="text-[10px] font-semibold text-[#1a9f9a]">Investor returns (their dashboard only)</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
        <label className="space-y-0.5">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Quick term</span>
          <select
            disabled={!editing}
            value={period}
            onChange={(e) => applyTerm(normalizeInvestorRoiPeriod(e.target.value))}
            className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-70"
          >
            {INVESTOR_ROI_PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Invest from</span>
          <input
            type="date"
            disabled={!editing}
            value={investedAt || ""}
            onChange={(e) => {
              const from = normalizeInvestorInvestedAt(e.target.value)
              const until =
                investedUntil && investedUntil >= from
                  ? investedUntil
                  : from
                    ? investorRoiEndDate(from, period)
                    : ""
              patch({ investorInvestedAt: from, investorInvestedUntil: until })
            }}
            className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-70 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Invest to</span>
          <input
            type="date"
            disabled={!editing}
            min={investedAt || undefined}
            value={investedUntil || ""}
            onChange={(e) => patch({ investorInvestedUntil: normalizeInvestorInvestedAt(e.target.value) })}
            className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-70 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </label>
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        Investment period: {investLabel}
        {investedAt && investedUntil
          ? ` · ${formatInvestorDay(investedAt)} → ${formatInvestorDay(investedUntil)}`
          : ""}
      </p>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        CRM sales counted for ROI: {salesForPeriod.salesLabel}
      </p>
      {summary.configured ? (
        <div className="rounded border border-[#1a9f9a]/40 bg-[hsl(var(--background))]/80 px-2.5 py-2 space-y-0.5">
          <p className="text-xs font-semibold text-[#1a9f9a]">
            They receive {formatInvestorRs(summary.due)}
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            ROI = sales in invest period ({salesForPeriod.salesLabel}){" "}
            {formatInvestorCrore(salesForPeriod.salesAmount)} × {INVESTOR_SALES_POOL_RATE}% × {roiPercent}% ={" "}
            {formatInvestorRs(summary.due)}
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Set Investment (PKR), pool share %, and invest from/to. ROI = CRM sales inside that investment
          period × {INVESTOR_SALES_POOL_RATE}% × pool share %.
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

  const loginPath = isInstallmentsUser(u.role)
    ? "/installments/login"
    : isChinaMoneyUser(u.role)
      ? "/money-to-china/login"
      : "/login"

  return (
    <div className="rounded-[16px] border border-black/[0.06] bg-white p-4 space-y-2.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          {editing ? (
            <>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                className="w-full h-8 rounded-[10px] border-0 bg-[#f2f2f7] px-3 text-[13px] outline-none focus:ring-2 focus:ring-[#007aff]/25" />
              <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                className="w-full h-8 rounded-[10px] border-0 bg-[#f2f2f7] px-3 text-[13px] outline-none focus:ring-2 focus:ring-[#007aff]/25" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <p className="font-semibold tracking-tight text-[13px] text-[#1d1d1f] truncate">{u.name}</p>
              </div>
              <div className="flex items-center gap-1">
                <p className="text-[#86868b] truncate">{u.email}</p>
                <button type="button" onClick={() => navigator.clipboard.writeText(u.email)} className="shrink-0 text-[#aeaeb2] hover:text-[#1d1d1f] cursor-pointer" title="Copy email">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[10px] text-[#aeaeb2]">
                Login · <span className="font-medium text-[#6e6e73]">{loginPath}</span>
              </p>
            </>
          )}
          <div className="relative flex items-center">
            <input readOnly={!editing} type={showPw ? "text" : "password"} value={draft.password}
              onChange={e => setDraft(d => ({ ...d, password: e.target.value }))}
              className="w-full h-8 rounded-[10px] border-0 bg-[#f2f2f7] px-3 pr-14 text-[12px] font-mono outline-none focus:ring-2 focus:ring-[#007aff]/25" />
            <div className="absolute right-1.5 flex items-center gap-1">
              <button type="button" onClick={() => navigator.clipboard.writeText(draft.password)} className="text-[#aeaeb2] hover:text-[#1d1d1f] cursor-pointer" title="Copy password">
                <Copy className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => setShowPw(v => !v)} className="text-[#aeaeb2] hover:text-[#1d1d1f] cursor-pointer">
                {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <Badge
            variant={
              roleHasAllModules(u.role) || isInvestorUser(u.role) || isChinaMoneyUser(u.role) || isInstallmentsUser(u.role)
                ? "default"
                : isViewOnlyUser(u.role)
                  ? "outline"
                  : "secondary"
            }
            className={`text-[10px] ${
              isInvestorUser(u.role)
                ? "bg-[#1a9f9a] hover:bg-[#1a9f9a]"
                : isChinaMoneyUser(u.role)
                  ? "bg-[#ff9f0a] hover:bg-[#ff9f0a] text-[#1d1d1f]"
                  : isInstallmentsUser(u.role)
                    ? "bg-[#007aff] hover:bg-[#007aff] text-white"
                    : ""
            }`}
          >
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
      {!isInvestorUser(draft.role) && !isChinaMoneyUser(draft.role) && !isInstallmentsUser(draft.role) && (
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
      {isChinaMoneyUser(draft.role) && (
        <p className="text-[10px] text-[#b25000] pt-1 border-t border-dashed">
          Signs in at /money-to-china/login — Money to China portal only
          {draft.role === "china_money_view" ? " (view only)" : " (can add transfers + proofs)"}.
        </p>
      )}
      {isInstallmentsUser(draft.role) && (
        <p className="text-[10px] text-[#007aff] pt-1 border-t border-dashed">
          Signs in at /installments/login — Installments portal only (shared clients + documents). No ERP access.
        </p>
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
              investorRoiPeriod: next.investorRoiPeriod,
              investorInvestedAt: next.investorInvestedAt,
              investorInvestedUntil: next.investorInvestedUntil,
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
          {isChinaMoneyUser(draft.role) && (
            <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              Portal: https://voltrixbatteries.com/money-to-china/login — no ERP modules.
            </p>
          )}
          {isInstallmentsUser(draft.role) && (
            <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              Portal: https://voltrixbatteries.com/installments/login — no ERP modules.
            </p>
          )}
          {isViewOnlyUser(draft.role) && !isInvestorUser(draft.role) && !isChinaMoneyUser(draft.role) && !isInstallmentsUser(draft.role) && (
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
            Login: {draft.email} + password at /login
          </span>
        ) : isChinaMoneyUser(draft.role) ? (
          <span className="text-[10px] text-[#b25000]">
            Login: {draft.email} at /money-to-china/login
          </span>
        ) : isInstallmentsUser(draft.role) ? (
          <span className="text-[10px] text-[#007aff]">
            Login: {draft.email} at /installments/login
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
  error = "",
  saving = false,
}: {
  onAdd: (u: User) => void | Promise<void>
  onCancel: () => void
  purchaseScopes: PurchaseScope[]
  initialRole?: UserRole
  error?: string
  saving?: boolean
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
  const [investorRoiPeriod, setInvestorRoiPeriod] = useState<InvestorRoiPeriod>("annual")
  const [investorInvestedAt, setInvestorInvestedAt] = useState("")
  const [investorInvestedUntil, setInvestorInvestedUntil] = useState("")

  function toggleModule(m: Module) {
    setModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await onAdd({
      id: Date.now().toString(),
      name,
      email: email.trim().toLowerCase(),
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
    <form
      onSubmit={submit}
      className="rounded-[16px] border border-[#007aff]/20 bg-[#f5f8ff] p-4 space-y-2.5 text-xs shadow-[0_8px_30px_rgba(0,122,255,0.06)]"
    >
      <p className="font-semibold text-[13px] tracking-tight text-[#1d1d1f]">
        {isInvestorUser(role)
          ? "New investor"
          : isChinaMoneyUser(role)
            ? "New Money to China user"
            : isInstallmentsUser(role)
              ? "New Installments portal user"
              : "New staff user"}
      </p>
      {isInvestorUser(role) && (
        <p className="text-[10px] text-[#1a9f9a]">
          They sign in at /login with this email and password — same as staff. They only see the investor portal.
        </p>
      )}
      {isChinaMoneyUser(role) && (
        <p className="text-[10px] text-[#b25000]">
          They sign in at /money-to-china/login. Admin can add transfers + proofs; View can only browse.
        </p>
      )}
      {isInstallmentsUser(role) && (
        <p className="text-[10px] text-[#007aff]">
          Sign-in: /installments/login. Same email as an ERP user converts that account to Installments
          (portal only — no ERP modules).
        </p>
      )}
      {error ? (
        <p className="text-[12px] text-[#ff3b30] bg-[#ff3b30]/08 rounded-[10px] px-3 py-2">{error}</p>
      ) : null}
      <input required placeholder="Full name" value={name} onChange={e => setName(e.target.value)}
        className="w-full h-8 rounded-[10px] border-0 bg-white px-3 text-[13px] outline-none focus:ring-2 focus:ring-[#007aff]/25" />
      <input required type="email" placeholder={isInvestorUser(role) ? "Investor login email" : "Email"} value={email} onChange={e => setEmail(e.target.value)}
        className="w-full h-8 rounded-[10px] border-0 bg-white px-3 text-[13px] outline-none focus:ring-2 focus:ring-[#007aff]/25" />
      <div className="relative">
        <input required type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full h-8 rounded-[10px] border-0 bg-white px-3 pr-8 text-[13px] outline-none focus:ring-2 focus:ring-[#007aff]/25" />
        <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#aeaeb2]">
          {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
            else if (next === "china_money_admin" || next === "china_money_view" || next === "installments") setModules([])
          }}
          className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          {ASSIGNABLE_ROLES.map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        {isChinaMoneyUser(role) && (
          <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            Portal link: /money-to-china/login — no staff ERP access.
          </p>
        )}
        {isInstallmentsUser(role) && (
          <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            Portal link: /installments/login — no staff ERP access.
          </p>
        )}
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
                setInvestorRoiPeriod(next.investorRoiPeriod)
                setInvestorInvestedAt(next.investorInvestedAt)
                setInvestorInvestedUntil(next.investorInvestedUntil)
              }}
            />
          </>
        )}
        {isViewOnlyUser(role) && !isInvestorUser(role) && !isChinaMoneyUser(role) && !isInstallmentsUser(role) && (
          <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            Assign the pages this user can view. They will not be able to change anything in the ERP.
          </p>
        )}
      </div>
      {!isInvestorUser(role) && !isChinaMoneyUser(role) && !isInstallmentsUser(role) && (
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
          Investor login: /login (opens investor portal)
        </p>
      ) : isChinaMoneyUser(role) ? (
        <p className="text-[10px] text-[#b25000]">
          Money to China login: /money-to-china/login
        </p>
      ) : isInstallmentsUser(role) ? (
        <p className="text-[10px] text-[#007aff]">
          Installments login: /installments/login
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
        <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs flex-1 cursor-pointer rounded-full">
          {saving
            ? "Saving…"
            : isInvestorUser(role)
              ? "Create investor login"
              : isInstallmentsUser(role)
                ? "Create installments login"
                : isChinaMoneyUser(role)
                  ? "Create China login"
                  : "Create"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={saving} className="h-8 text-xs cursor-pointer rounded-full" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

type PortalFilter = "all" | "erp" | "investor" | "installments" | "china" | "sales"

function userPortalGroup(u: User): Exclude<PortalFilter, "all"> {
  if (isInstallmentsUser(u.role)) return "installments"
  if (isChinaMoneyUser(u.role)) return "china"
  if (isInvestorUser(u.role)) return "investor"
  if (u.role === "sales_agent") return "sales"
  return "erp"
}

function portalLoginHint(filter: PortalFilter) {
  switch (filter) {
    case "installments":
      return { path: "/installments/login", label: "Installments portal" }
    case "china":
      return { path: "/money-to-china/login", label: "Money to China" }
    case "investor":
      return { path: "/login", label: "Investor (opens investor portal)" }
    case "sales":
      return { path: "/login", label: "Sales agent ERP login" }
    case "erp":
      return { path: "/login", label: "Staff ERP login" }
    default:
      return null
  }
}

export function UsersManager() {
  const [users, setUsers] = useState<User[]>([])
  const [purchaseScopes, setPurchaseScopes] = useState<PurchaseScope[]>([])
  const [adding, setAdding] = useState<"user" | "investor" | "installments" | "china" | false>(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [portalFilter, setPortalFilter] = useState<PortalFilter>("all")
  const [formError, setFormError] = useState("")
  const [formSaving, setFormSaving] = useState(false)
  const [banner, setBanner] = useState("")

  useEffect(() => {
    setLoading(true)
    Promise.all([getUsers(), getPurchaseScopes()]).then(([u, scopes]) => {
      setUsers(u)
      setPurchaseScopes(scopes)
      setLoading(false)
    })
  }, [])

  async function handleSave(updated: User) {
    const saved = await saveUser(updated)
    setUsers((prev) => prev.map((u) => (u.id === saved.id ? saved : u)))
  }

  async function handleDelete(id: string) {
    await deleteUser(id)
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  async function handleAdd(newUser: User) {
    setFormSaving(true)
    setFormError("")
    setBanner("")
    try {
      const saved = await saveUser(newUser)
      setUsers((prev) => {
        const without = prev.filter((u) => u.id !== saved.id && u.email.toLowerCase() !== saved.email.toLowerCase())
        return [...without, saved]
      })
      setAdding(false)
      const group = userPortalGroup(saved)
      setPortalFilter(group)
      if (saved.converted) {
        setBanner(
          `Converted ${saved.email} to ${ROLE_LABELS[saved.role]}. Login: ${
            isInstallmentsUser(saved.role)
              ? "/installments/login"
              : isChinaMoneyUser(saved.role)
                ? "/money-to-china/login"
                : "/login"
          }`,
        )
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save user")
    } finally {
      setFormSaving(false)
    }
  }

  const counts = {
    all: users.length,
    erp: users.filter((u) => userPortalGroup(u) === "erp").length,
    investor: users.filter((u) => userPortalGroup(u) === "investor").length,
    installments: users.filter((u) => userPortalGroup(u) === "installments").length,
    china: users.filter((u) => userPortalGroup(u) === "china").length,
    sales: users.filter((u) => userPortalGroup(u) === "sales").length,
  }

  const portalTabs: { id: PortalFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "erp", label: "Staff ERP", count: counts.erp },
    { id: "investor", label: "Investors", count: counts.investor },
    { id: "installments", label: "Installments", count: counts.installments },
    { id: "china", label: "Money to China", count: counts.china },
    { id: "sales", label: "Sales agents", count: counts.sales },
  ]

  const q = search.trim().toLowerCase()
  const filteredUsers = users.filter((u) => {
    if (portalFilter !== "all" && userPortalGroup(u) !== portalFilter) return false
    if (!q) return true
    const roleLabel = (ROLE_LABELS[u.role] ?? u.role).toLowerCase()
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      roleLabel.includes(q) ||
      String(u.role).toLowerCase().includes(q)
    )
  })

  const hint = portalLoginHint(portalFilter)

  return (
    <div className="flex-1 overflow-auto bg-[#f5f5f7]">
      <div className="p-5 sm:p-6 max-w-3xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f]">User Accounts</h2>
            <p className="text-[12px] text-[#86868b] mt-0.5">
              Filter by portal to see which logins belong where
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => {
                setPortalFilter("investor")
                setAdding((v) => (v === "investor" ? false : "investor"))
              }}
              className="h-8 px-3 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.03] cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Investor
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalFilter("installments")
                setAdding((v) => (v === "installments" ? false : "installments"))
              }}
              className="h-8 px-3 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.03] cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Installments
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalFilter("china")
                setAdding((v) => (v === "china" ? false : "china"))
              }}
              className="h-8 px-3 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.03] cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> China
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalFilter("erp")
                setAdding((v) => (v === "user" ? false : "user"))
              }}
              className="h-8 px-3.5 rounded-full bg-[#007aff] text-white text-[12px] font-semibold hover:bg-[#0066d6] cursor-pointer inline-flex items-center gap-1 shadow-[0_1px_2px_rgba(0,122,255,0.25)]"
            >
              <Plus className="h-3.5 w-3.5" /> Staff
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {portalTabs.map((tab) => {
            const active = portalFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPortalFilter(tab.id)}
                className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  active
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-white border border-black/[0.08] text-[#6e6e73] hover:bg-black/[0.03]"
                }`}
              >
                {tab.label}
                <span
                  className={`tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    active ? "bg-white/20 text-white" : "bg-black/[0.06] text-[#86868b]"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {banner ? (
          <div className="rounded-[14px] border border-[#30d158]/30 bg-[#30d158]/10 px-3.5 py-2.5 text-[12px] text-[#248a3d]">
            {banner}
          </div>
        ) : null}

        {hint ? (
          <div className="rounded-[14px] border border-black/[0.06] bg-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                {hint.label}
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-[#1d1d1f] mt-0.5">
                {hint.path}
              </p>
            </div>
            <p className="text-[11px] text-[#aeaeb2]">
              Showing {filteredUsers.length} login{filteredUsers.length === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#aeaeb2]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or role…"
            className="w-full h-10 rounded-[12px] border-0 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] pl-9 pr-9 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#007aff]/25"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#aeaeb2] hover:text-[#1d1d1f] cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {loading && (
            <p className="text-center text-[12px] text-[#86868b] py-12">Loading…</p>
          )}
          {adding && (
            <AddUserForm
              key={adding}
              initialRole={
                adding === "investor"
                  ? "investor"
                  : adding === "installments"
                    ? "installments"
                    : adding === "china"
                      ? "china_money_admin"
                      : "user"
              }
              onAdd={handleAdd}
              onCancel={() => {
                setAdding(false)
                setFormError("")
              }}
              purchaseScopes={purchaseScopes}
              error={formError}
              saving={formSaving}
            />
          )}
          {!loading && filteredUsers.length === 0 && (
            <div className="rounded-[16px] border border-black/[0.06] bg-white px-4 py-12 text-center">
              <p className="text-[13px] font-medium text-[#1d1d1f]">
                {q
                  ? `No users match “${search.trim()}”`
                  : portalFilter === "installments"
                    ? "No Installments portal logins yet"
                    : portalFilter === "china"
                      ? "No Money to China logins yet"
                      : portalFilter === "investor"
                        ? "No investor logins yet"
                        : "No users in this filter"}
              </p>
              <p className="text-[12px] text-[#86868b] mt-1">
                Use the buttons above to create a login for this portal.
              </p>
            </div>
          )}
          {!loading &&
            filteredUsers.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                onSave={handleSave}
                onDelete={handleDelete}
                purchaseScopes={purchaseScopes}
              />
            ))}
        </div>
      </div>
    </div>
  )
}
