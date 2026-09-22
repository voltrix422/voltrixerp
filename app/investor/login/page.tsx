"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Eye, EyeOff, Landmark, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { isInvestorUser, saveRememberedLogin, clearRememberedLogin } from "@/lib/auth"

export default function InvestorLoginPage() {
  const router = useRouter()
  const { user, login, logout } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [staySignedIn, setStaySignedIn] = useState(true)

  useEffect(() => {
    if (user && isInvestorUser(user.role)) router.replace("/investor")
  }, [user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const loggedInUser = await login(email.trim(), password)
    setLoading(false)

    if (!loggedInUser) {
      setError("Invalid email or password.")
      return
    }

    if (!isInvestorUser(loggedInUser.role)) {
      logout("/investor/login")
      setError("This login is for investors only. Use staff sign in for the ERP.")
      return
    }

    if (staySignedIn) saveRememberedLogin(email.trim(), password)
    else clearRememberedLogin()
    router.replace("/investor")
  }

  return (
    <div className="min-h-screen flex bg-white">
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 shrink-0 p-16"
        style={{ backgroundColor: "#1a9f9a" }}
      >
        <a href="/">
          <Image
            src="/logo.png"
            alt="Voltrix"
            width={110}
            height={36}
            className="h-8 w-auto object-contain brightness-0 invert"
          />
        </a>
        <div className="space-y-4">
          <Landmark className="h-10 w-10 text-white/90" />
          <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
            Investor
            <br />
            portal
          </h1>
          <p className="text-white/80 text-sm max-w-sm leading-relaxed">
            Follow company progress and review CRM 2 — the same customer records, in a separate investor workspace.
          </p>
        </div>
        <p className="text-xs text-white/50">© 2026 Voltrix</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white">
        <div className="lg:hidden mb-10">
          <Image src="/logo.png" alt="Voltrix" width={110} height={36} className="h-8 w-auto object-contain" />
        </div>

        <div className="w-full max-w-xs space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Investor sign in</h2>
            <p className="text-sm text-neutral-400 mt-1">Enter your investor credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-500" htmlFor="investor-email">Email</label>
              <input
                id="investor-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investor@voltrix.com"
                className="w-full h-10 rounded-lg border border-neutral-300 bg-transparent px-3 text-sm outline-none focus:border-[#1a9f9a] transition-colors placeholder:text-neutral-300"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-500" htmlFor="investor-password">Password</label>
              <div className="relative">
                <input
                  id="investor-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 rounded-lg border border-neutral-300 bg-transparent px-3 pr-10 text-sm outline-none focus:border-[#1a9f9a] transition-colors placeholder:text-neutral-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer">
              <input
                type="checkbox"
                checked={staySignedIn}
                onChange={(e) => setStaySignedIn(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#1a9f9a]"
              />
              Stay signed in on this phone
            </label>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "#1a9f9a" }}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="text-center space-y-2">
            <Link href="/login" className="block text-xs text-neutral-400 hover:text-neutral-600 hover:underline">
              Staff ERP login
            </Link>
            <a href="/" className="block text-xs text-neutral-400 hover:text-neutral-600 hover:underline">
              Back to website
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
