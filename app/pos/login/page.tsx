"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { roleHasAllModules } from "@/lib/auth"
import { ensurePosSetup } from "@/lib/pos"
import {
  DEFAULT_POS_EMAIL,
  DEFAULT_POS_PASSWORD,
} from "@/lib/pos-defaults"
import { Eye, EyeOff, Loader2, Store } from "lucide-react"

export default function PosLoginPage() {
  const router = useRouter()
  const { login, user } = useAuth()
  const [email, setEmail] = useState(DEFAULT_POS_EMAIL)
  const [password, setPassword] = useState(DEFAULT_POS_PASSWORD)
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [setupReady, setSetupReady] = useState(false)

  useEffect(() => {
    void ensurePosSetup().then(() => setSetupReady(true))
  }, [])

  useEffect(() => {
    if (!user) return
    const canPos =
      roleHasAllModules(user.role) || user.modules.includes("pos")
    if (canPos) router.replace("/pos")
  }, [user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    await ensurePosSetup()
    const loggedInUser = await login(email.trim(), password)
    setLoading(false)
    if (!loggedInUser) {
      setError("Invalid email or password.")
      return
    }
    const canPos =
      roleHasAllModules(loggedInUser.role) || loggedInUser.modules.includes("pos")
    if (!canPos) {
      setError("This account does not have POS access.")
      return
    }
    router.replace("/pos")
  }

  return (
    <div className="min-h-screen flex bg-neutral-950 text-white">
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-16"
        style={{ background: "linear-gradient(135deg, #0d4f4c 0%, #1a9f9a 100%)" }}
      >
        <Image
          src="/logo.png"
          alt="Voltrix"
          width={110}
          height={36}
          className="h-8 w-auto brightness-0 invert"
        />
        <div className="space-y-4">
          <Store className="h-12 w-12 opacity-90" />
          <h1 className="text-3xl font-bold leading-tight">
            Voltrix
            <br />
            Point of Sale
          </h1>
          <p className="text-white/70 text-sm max-w-sm">
            Fast checkout tied to inventory. Create terminals, ring sales, and view receipts.
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
            <h2 className="text-xl font-semibold">POS sign in</h2>
            <p className="text-sm text-neutral-500 mt-1">Cashier access for the register</p>
          </div>

          {setupReady && (
            <div className="rounded-lg border border-[#1a9f9a]/30 bg-[#1a9f9a]/5 px-3 py-2 text-xs text-neutral-600">
              <p className="font-medium text-neutral-800 mb-1">Default login</p>
              <p>
                Email: <span className="font-mono">{DEFAULT_POS_EMAIL}</span>
              </p>
              <p>
                Password: <span className="font-mono">{DEFAULT_POS_PASSWORD}</span>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-500" htmlFor="pos-email">
                Email
              </label>
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
              <label className="text-xs text-neutral-500" htmlFor="pos-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="pos-password"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 rounded-lg border border-neutral-300 px-3 pr-10 text-sm outline-none focus:border-[#1a9f9a]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "#1a9f9a" }}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Open POS
            </button>
          </form>

          <div className="flex flex-col gap-2 text-center text-xs text-neutral-400">
            <Link href="/login" className="hover:text-neutral-600 hover:underline">
              ERP sign in (Finance, Inventory, CRM…)
            </Link>
            <Link href="/" className="hover:text-neutral-600">
              Back to website
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
