"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { branchPosLoginAndSession } from "@/lib/auth"
import { branchPosEmail, branchPosPassword } from "@/lib/branch-pos"
import { Eye, EyeOff, Loader2, Store } from "lucide-react"

export default function PosLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const branchCode = searchParams?.get("branch")?.trim().toUpperCase() || ""
  const { user, refreshUser } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!branchCode) return
    setEmail(branchPosEmail(branchCode))
    setPassword(branchPosPassword(branchCode))
  }, [branchCode])

  useEffect(() => {
    if (user?.branchId) router.replace("/pos")
  }, [user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!branchCode) {
      setError("Open POS from Inventory → Branches (use the branch link).")
      return
    }
    setError("")
    setLoading(true)
    const loggedInUser = await branchPosLoginAndSession(branchCode, email.trim(), password)
    setLoading(false)
    if (!loggedInUser?.branchId) {
      setError("Invalid email or password. Ask admin to run Setup branch POS.")
      return
    }
    await refreshUser()
    router.replace("/pos")
  }

  return (
    <div className="min-h-screen flex bg-neutral-950 text-white">
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-16"
        style={{ background: "linear-gradient(135deg, #0d4f4c 0%, #1a9f9a 100%)" }}
      >
        <Image src="/logo.png" alt="Voltrix" width={110} height={36} className="h-8 w-auto brightness-0 invert" />
        <div className="space-y-4">
          <Store className="h-12 w-12 opacity-90" />
          <h1 className="text-3xl font-bold leading-tight">
            Voltrix
            <br />
            Branch Point of Sale
          </h1>
          <p className="text-white/70 text-sm max-w-sm">
            Sell, create orders and quotations from your branch stock only.
          </p>
        </div>
        <p className="text-xs text-white/40">© 2026 Voltrix</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white text-neutral-900">
        <div className="lg:hidden mb-8">
          <Image src="/logo.png" alt="Voltrix" width={110} height={36} className="h-8 w-auto" />
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Branch POS sign in</h2>
            <p className="text-sm text-neutral-500 mt-1">
              {branchCode ? `Branch ${branchCode}` : "Use the Open POS link from your branch row"}
            </p>
          </div>

          {!branchCode && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Go to <strong>Inventory → Branches</strong> and click <strong>Open POS</strong> on your branch.
            </div>
          )}

          {branchCode && (
            <div className="rounded-lg border border-[#1a9f9a]/30 bg-[#1a9f9a]/5 px-3 py-2 text-xs text-neutral-600">
              <p className="font-medium text-neutral-800 mb-1">Branch login</p>
              <p>Email: <span className="font-mono">{branchPosEmail(branchCode)}</span></p>
              <p>Password: <span className="font-mono">{branchPosPassword(branchCode)}</span></p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-500" htmlFor="pos-email">Email</label>
              <input
                id="pos-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-[#1a9f9a]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-500" htmlFor="pos-password">Password</label>
              <div className="relative">
                <input
                  id="pos-password"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 rounded-lg border border-neutral-300 px-3 pr-10 text-sm outline-none focus:border-[#1a9f9a]"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 cursor-pointer" tabIndex={-1}>
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading || !branchCode}
              className="w-full h-10 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "#1a9f9a" }}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Open branch POS
            </button>
          </form>

          <div className="flex flex-col gap-2 text-center text-xs text-neutral-400">
            <Link href="/login" className="hover:text-neutral-600 hover:underline">ERP sign in (admin)</Link>
            <Link href="/" className="hover:text-neutral-600">Back to website</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
