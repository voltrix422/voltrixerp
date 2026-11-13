"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  clearRememberedLogin,
  getRememberedLogin,
  isChinaMoneyUser,
  isErpAdmin,
  saveRememberedLogin,
} from "@/lib/auth"

export default function MoneyToChinaLoginPage() {
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
    if (user && (isChinaMoneyUser(user.role) || isErpAdmin(user.role))) {
      window.location.assign("/money-to-china")
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
        if (!isChinaMoneyUser(loggedInUser.role) && !isErpAdmin(loggedInUser.role)) {
          setError("This account cannot access Money to China. Use a Money to China role from Manage Users.")
          return
        }
        if (staySignedIn) saveRememberedLogin(trimmedEmail, rawPassword)
        else clearRememberedLogin()
        window.location.assign("/money-to-china")
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
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[20px] border border-black/[0.06] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="px-6 pt-7 pb-2 text-center space-y-2">
          <Image src="/logo.png" alt="Voltrix" width={110} height={36} className="h-8 w-auto mx-auto object-contain" />
          <h1 className="text-[18px] font-semibold tracking-tight text-[#1d1d1f]">Money sent to China</h1>
          <p className="text-[12px] text-[#86868b]">Sign in with the account created in Manage Users</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 pb-7 pt-3 space-y-2.5">
          <input
            type="email"
            autoComplete="username"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-10 rounded-[11px] border-0 bg-[#f2f2f7] px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
          />
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 rounded-[11px] border-0 bg-[#f2f2f7] px-3 pr-10 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] cursor-pointer"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-full bg-[#1d1d1f] text-white text-[13px] font-semibold hover:bg-black disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </button>
          <p className="text-center text-[11px] text-[#86868b] pt-1">
            <Link href="/" className="text-[#0071e3] font-medium hover:underline">
              Back to website
            </Link>
            {" · "}
            <Link href="/login" className="text-[#0071e3] font-medium hover:underline">
              ERP login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
