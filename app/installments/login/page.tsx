"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  canAccessInstallmentsPortal,
  clearRememberedLogin,
  getRememberedLogin,
  saveRememberedLogin,
} from "@/lib/auth"

export default function InstallmentsLoginPage() {
  const { login, user } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [staySignedIn, setStaySignedIn] = useState(true)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const loginInFlight = useRef(false)
  const autoTried = useRef(false)

  useEffect(() => {
    if (user && canAccessInstallmentsPortal(user.role)) {
      window.location.assign("/installments")
    }
  }, [user])

  useEffect(() => {
    if (autoTried.current || user || loginInFlight.current) return
    const remembered = getRememberedLogin()
    if (!remembered) return
    autoTried.current = true
    setEmail(remembered.email)
    setPassword(remembered.password)
  }, [user])

  const completeLogin = useCallback(
    async (rawEmail: string, rawPassword: string) => {
      if (loginInFlight.current) return
      const trimmedEmail = rawEmail.trim()
      if (!trimmedEmail || !rawPassword) {
        setError("Enter email and password.")
        return
      }
      loginInFlight.current = true
      setError("")
      setLoading(true)
      try {
        const loggedInUser = await login(trimmedEmail, rawPassword)
        if (!loggedInUser) {
          setError("Invalid email or password.")
          return
        }
        if (!canAccessInstallmentsPortal(loggedInUser.role)) {
          setError("This account is for Installments Portal only. Create it from ERP → Manage Users.")
          return
        }
        if (staySignedIn) saveRememberedLogin(trimmedEmail, rawPassword)
        else clearRememberedLogin()
        window.location.assign("/installments")
      } catch {
        setError("Sign in failed. Please try again.")
      } finally {
        loginInFlight.current = false
        setLoading(false)
      }
    },
    [login, staySignedIn],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await completeLogin(email, password)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 15%, rgba(26, 159, 154, 0.28), transparent 55%),
            radial-gradient(ellipse 70% 50% at 85% 20%, rgba(90, 200, 250, 0.22), transparent 50%),
            radial-gradient(ellipse 60% 55% at 70% 85%, rgba(175, 82, 222, 0.12), transparent 55%),
            linear-gradient(165deg, #e8eef5 0%, #f5f5f7 40%, #eef2f7 100%)
          `,
        }}
      />

      <div className="relative w-full max-w-[340px]">
        <div className="rounded-[18px] border border-white/60 bg-white/55 backdrop-blur-[40px] backdrop-saturate-[180%] shadow-[0_8px_40px_rgba(0,0,0,0.12),0_1px_0_rgba(255,255,255,0.8)_inset] overflow-hidden">
          <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-black/[0.04]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <p className="flex-1 text-center text-[11px] font-medium text-[#86868b] pr-8 tracking-[-0.01em]">
              Installments
            </p>
          </div>

          <div className="px-5 pt-5 pb-5">
            <div className="flex justify-center mb-5">
              <Image
                src="/logo.png"
                alt="Voltrix"
                width={100}
                height={32}
                className="h-7 w-auto object-contain"
                priority
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <input
                type="email"
                autoComplete="username"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[38px] rounded-[9px] border border-black/[0.08] bg-white/80 px-3 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-[#007aff]/50 focus:ring-[3px] focus:ring-[#007aff]/15 transition-shadow"
              />
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[38px] rounded-[9px] border border-black/[0.08] bg-white/80 px-3 pr-9 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-[#007aff]/50 focus:ring-[3px] focus:ring-[#007aff]/15 transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#aeaeb2] hover:text-[#86868b] transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-[#6e6e73] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={staySignedIn}
                  onChange={(e) => setStaySignedIn(e.target.checked)}
                  className="rounded border-black/20"
                />
                Stay signed in
              </label>

              {error ? (
                <p className="text-[11px] text-[#ff3b30] bg-[#ff3b30]/08 rounded-[8px] px-2.5 py-1.5">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[38px] rounded-full text-[13px] font-semibold text-white flex items-center justify-center gap-1.5 bg-[#007aff] hover:bg-[#0066d6] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Sign in
              </button>
            </form>

            <div className="mt-4 pt-3.5 border-t border-black/[0.06] flex items-center justify-between gap-3">
              <Link
                href="/login"
                className="text-[12px] font-medium text-[#1d1d1f]/70 hover:text-[#1d1d1f] transition-colors"
              >
                ERP
              </Link>
              <Link
                href="/"
                className="text-[12px] text-[#007aff] hover:underline underline-offset-2"
              >
                Website
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
