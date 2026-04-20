"use client"
import { useState, useEffect } from "react"
import { getUsers, saveUser, deleteUser, ALL_MODULES, MODULE_LABELS, type User, type Module } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Eye, EyeOff, Pencil, Check, Trash2, Users, Copy } from "lucide-react"

function UserRow({ u, onSave, onDelete }: { u: User; onSave: (u: User) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [draft, setDraft] = useState<User>(u)

  function toggleModule(m: Module) {
    setDraft(d => ({
      ...d,
      modules: d.modules.includes(m) ? d.modules.filter(x => x !== m) : [...d.modules, m],
    }))
  }

  function save() { onSave(draft); setEditing(false) }
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
          <Badge variant={u.role === "superadmin" ? "default" : "secondary"} className="text-[10px]">{u.role}</Badge>
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
      <div className="flex flex-wrap gap-1">
        {u.role === "superadmin" ? (
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">All pages</span>
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
    </div>
  )
}

function AddUserForm({ onAdd, onCancel }: { onAdd: (u: User) => void; onCancel: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [modules, setModules] = useState<Module[]>([])
  const [showPw, setShowPw] = useState(false)

  function toggleModule(m: Module) {
    setModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onAdd({ id: Date.now().toString(), name, email, password, role: "user", modules })
  }

  return (
    <form onSubmit={submit} className="border rounded-lg p-3 space-y-2 bg-[hsl(var(--muted))]/30 text-xs">
      <p className="font-semibold text-xs">New User</p>
      <input required placeholder="Full name" value={name} onChange={e => setName(e.target.value)}
        className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
      <input required type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
        className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
      <div className="relative">
        <input required type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
          {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
      </div>
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
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" className="h-7 text-xs flex-1 cursor-pointer">Create</Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

export function UsersPanel() {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getUsers().then(u => { setUsers(u); setLoading(false) })
  }, [open])

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

  return (
    <>
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 cursor-pointer" onClick={() => setOpen(true)}>
        <Users className="h-3.5 w-3.5" /> Manage Users
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative z-10 flex flex-col w-full max-w-sm h-full bg-[hsl(var(--background))] border-l shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <div>
                <p className="text-sm font-semibold">User Accounts</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Manage credentials & page access</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" className="h-7 text-xs cursor-pointer" onClick={() => setAdding(v => !v)}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && <p className="text-xs text-center text-[hsl(var(--muted-foreground))] py-8">Loading...</p>}
              {adding && <AddUserForm onAdd={handleAdd} onCancel={() => setAdding(false)} />}
              {users.map(u => (
                <UserRow key={u.id} u={u} onSave={handleSave} onDelete={handleDelete} />
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
