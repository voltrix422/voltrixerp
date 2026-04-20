"use client"
import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { saveUser } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Check, User, Lock, AlertCircle } from "lucide-react"

const inputCls = "w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6] transition-colors"

export function AccountSettings() {
  const { user, refreshUser } = useAuth()

  // username section
  const [newName, setNewName]       = useState(user?.name ?? "")
  const [newEmail, setNewEmail]     = useState(user?.email ?? "")
  const [savingName, setSavingName] = useState(false)
  const [nameDone, setNameDone]     = useState(false)
  const [nameError, setNameError]   = useState("")

  // password section
  const [currentPw, setCurrentPw]   = useState("")
  const [newPw, setNewPw]           = useState("")
  const [confirmPw, setConfirmPw]   = useState("")
  const [showCur, setShowCur]       = useState(false)
  const [showNew, setShowNew]       = useState(false)
  const [showCon, setShowCon]       = useState(false)
  const [savingPw, setSavingPw]     = useState(false)
  const [pwDone, setPwDone]         = useState(false)
  const [pwError, setPwError]       = useState("")

  if (!user) return null

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newEmail.trim()) return
    setSavingName(true); setNameError(""); setNameDone(false)
    try {
      if (!user?.id) throw new Error("User ID not found")
      const updated = { ...user, id: user.id, name: newName.trim(), email: newEmail.trim() }
      await saveUser(updated)
      await refreshUser()
      setNameDone(true)
      setTimeout(() => setNameDone(false), 3000)
    } catch {
      setNameError("Failed to save. Please try again.")
    }
    setSavingName(false)
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(""); setPwDone(false)

    if (!user?.password) {
      setPwError("User not found.")
      return
    }
    if (currentPw !== user.password) {
      setPwError("Current password is incorrect.")
      return
    }
    if (newPw.length < 4) {
      setPwError("New password must be at least 4 characters.")
      return
    }
    if (newPw !== confirmPw) {
      setPwError("Passwords do not match.")
      return
    }

    setSavingPw(true)
    try {
      const updated = { ...user, password: newPw }
      await saveUser(updated)
      await refreshUser()
      setCurrentPw(""); setNewPw(""); setConfirmPw("")
      setPwDone(true)
      setTimeout(() => setPwDone(false), 3000)
    } catch {
      setPwError("Failed to save. Please try again.")
    }
    setSavingPw(false)
  }

  return (
    <div className="max-w-lg space-y-6">

      {/* Profile section */}
      <div className="rounded-xl border bg-[hsl(var(--card))]">
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <div className="h-8 w-8 rounded-lg bg-[#1faca6]/10 flex items-center justify-center">
            <User className="h-4 w-4 text-[#1faca6]" />
          </div>
          <div>
            <p className="text-sm font-semibold">Profile</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Update your display name and email</p>
          </div>
        </div>
        <form onSubmit={handleSaveName} className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Display Name</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Your name"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Email / Username</label>
            <input
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="your@email.com"
              className={inputCls}
            />
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              This is used to log in. Changes reflect immediately in the admin users panel.
            </p>
          </div>

          {nameError && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {nameError}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white"
              disabled={savingName || (newName === user.name && newEmail === user.email)}
            >
              {savingName ? "Saving..." : "Save Changes"}
            </Button>
            {nameDone && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Password section */}
      <div className="rounded-xl border bg-[hsl(var(--card))]">
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <div className="h-8 w-8 rounded-lg bg-[#1faca6]/10 flex items-center justify-center">
            <Lock className="h-4 w-4 text-[#1faca6]" />
          </div>
          <div>
            <p className="text-sm font-semibold">Password</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Change your login password</p>
          </div>
        </div>
        <form onSubmit={handleSavePassword} className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Current Password</label>
            <div className="relative">
              <input
                type={showCur ? "text" : "password"}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Enter current password"
                className={inputCls + " pr-9"}
              />
              <button type="button" onClick={() => setShowCur(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                {showCur ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">New Password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Enter new password"
                className={inputCls + " pr-9"}
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Confirm New Password</label>
            <div className="relative">
              <input
                type={showCon ? "text" : "password"}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                className={inputCls + " pr-9"}
              />
              <button type="button" onClick={() => setShowCon(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                {showCon ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {pwError && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {pwError}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white"
              disabled={savingPw || !currentPw || !newPw || !confirmPw}
            >
              {savingPw ? "Saving..." : "Update Password"}
            </Button>
            {pwDone && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Password updated
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Current session info */}
      <div className="rounded-xl border bg-[hsl(var(--card))] px-5 py-4">
        <p className="text-xs font-semibold mb-3">Current Session</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex gap-3">
            <span className="text-[hsl(var(--muted-foreground))] w-20 shrink-0">Name</span>
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[hsl(var(--muted-foreground))] w-20 shrink-0">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[hsl(var(--muted-foreground))] w-20 shrink-0">Role</span>
            <span className="capitalize">{user.role}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
