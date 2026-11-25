"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { branchPosLoginAndSession, clearSession } from "@/lib/auth"
import { branchCodeFromPosEmail } from "@/lib/branch-pos"
import { Eye, EyeOff, Loader2 } from "lucide-react"

export default function PosLoginPage() {
  const router = useRouter()
  const { user, syncSessionUser } = useAuth()
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

    const trimmedEmail = email.trim().toLowerCase()
    const code = branchCodeFromPosEmail(trimmedEmail)
    if (!code) {
      setLoading(false)
      setError("Enter a valid branch POS email (e.g. pos-br006@branch.voltrix).")
      return
    }

    const { user: loggedInUser, error: loginError } = await branchPosLoginAndSession(
      trimmedEmail,
      password,
      code,
    )
    setLoading(false)

    if (!loggedInUser) {
      if (loginError === "Branch not found") {
        setError("No branch found for this login. Check the branch code in Inventory → Branches.")
      } else {
        setError(
          loginError === "Invalid email or password"
            ? "Invalid email or password."
            : loginError || "Login failed.",
        )
      }
      return
    }

    if (!loggedInUser.branchId) {
      clearSession()
      setError("This login is for branch POS accounts only.")
      return
    }

    syncSessionUser(loggedInUser)
    router.replace("/pos")
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
            radial-gradient(ellipse 50% 40% at 10% 80%, rgba(255, 214, 10, 0.10), transparent 50%),
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
              POS
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
                id="pos-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full h-[38px] rounded-[9px] border border-black/[0.08] bg-white/80 px-3 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-[#007aff]/50 focus:ring-[3px] focus:ring-[#007aff]/15 transition-shadow"
              />

              <div className="relative">
                <input
                  id="pos-password"
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
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

              {error && (
                <p className="text-[11px] text-[#ff3b30] bg-[#ff3b30]/08 rounded-[8px] px-2.5 py-1.5">
                  {error}
                </p>
              )}

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
