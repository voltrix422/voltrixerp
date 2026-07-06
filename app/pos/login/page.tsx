"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { clearSession, login, roleHasAllModules } from "@/lib/auth"
import { Eye, EyeOff, Loader2, Store } from "lucide-react"

export default function PosLoginPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.branchId) router.replace("/pos")
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

    const canPos =
      roleHasAllModules(loggedInUser.role) || loggedInUser.modules.includes("pos")

    if (!canPos || !loggedInUser.branchId) {
      clearSession()
      setError("This login is for branch POS accounts only.")
      return
    }

    router.replace("/pos")
  }

  return (
    <div className="min-h-screen flex bg-[hsl(var(--background))]">
      <div
        className="hidden lg:flex flex-col justify-between w-[42%] max-w-lg p-12 text-white shrink-0"
        style={{ background: "linear-gradient(160deg, #0d4f4c 0%, #1a9f9a 100%)" }}
      >
        <Image src="/logo.png" alt="Voltrix" width={100} height={32} className="h-7 w-auto object-contain brightness-0 invert" />
        <div className="space-y-4">
          <Store className="h-10 w-10 opacity-90" />
          <h1 className="text-2xl font-bold leading-snug">Branch Point of Sale</h1>
          <p className="text-white/75 text-sm leading-relaxed">
            Sign in with your branch username and password to sell, create orders and quotations.
          </p>
        </div>
        <p className="text-xs text-white/40">© 2026 Voltrix</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex justify-center mb-2">
            <Image src="/logo.png" alt="Voltrix" width={100} height={32} className="h-7 w-auto" />
          </div>

          <div>
            <h2 className="text-xl font-bold">POS sign in</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Enter your branch username and password
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" htmlFor="pos-email">Email / username</label>
              <input
                id="pos-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. pos-br006@branch.voltrix"
                className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" htmlFor="pos-password">Password</label>
              <div className="relative">
                <input
                  id="pos-password"
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] cursor-pointer"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md text-sm font-medium text-white bg-[#1faca6] hover:bg-[#17857f] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
            <Link href="/login" className="hover:underline">Admin ERP login</Link>
            {" · "}
            <Link href="/" className="hover:underline">Website</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
