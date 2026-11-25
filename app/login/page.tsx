"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/components/auth-provider"
import { clearRememberedLogin, getRememberedLogin, homePathForUser, saveRememberedLogin } from "@/lib/auth"
import { subscribeUserToPush } from "@/lib/push-client"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import Link from "next/link"
import { PwaProvider } from "@/components/pwa/pwa-provider"
import { markErpEntrySplashDone, PostLoginSplash } from "@/components/layout/post-login-splash"

export default function LoginPage() {
  const router = useRouter()
  const { login, user } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [staySignedIn, setStaySignedIn] = useState(true)
  const [enteringApp, setEnteringApp] = useState(false)
  const autoTried = useRef(false)
  const loginInFlight = useRef(false)
  const homePathRef = useRef("/dashboard")

  useEffect(() => {
    const remembered = getRememberedLogin()
    if (remembered) {
      setEmail(remembered.email)
      setPassword(remembered.password)
    }
  }, [])

  useEffect(() => {
    if (user && !enteringApp && !loginInFlight.current) {
      router.replace(homePathForUser(user))
      return
    }
    const timer = window.setTimeout(() => {
      if (autoTried.current || user || loginInFlight.current || enteringApp) return
      const remembered = getRememberedLogin()
      if (!remembered) return
      autoTried.current = true
      void completeLogin(remembered.email, remembered.password)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [user, router, enteringApp])

  async function completeLogin(nextEmail: string, nextPassword: string) {
    if (loginInFlight.current || enteringApp) return
    const trimmedEmail = nextEmail.trim()
    const trimmedPassword = nextPassword
    if (!trimmedEmail || !trimmedPassword) {
      setError("Enter email and password.")
      return
    }

    loginInFlight.current = true
    setError("")
    setLoading(true)
    try {
      const loggedInUser = await login(trimmedEmail, trimmedPassword)
      if (!loggedInUser) {
        setError("Invalid email or password.")
        loginInFlight.current = false
        setLoading(false)
        return
      }
      if (staySignedIn) saveRememberedLogin(trimmedEmail, trimmedPassword)
      else clearRememberedLogin()

      homePathRef.current = homePathForUser(loggedInUser)
      setEnteringApp(true)
      setLoading(true)
      void subscribeUserToPush(loggedInUser.id)
    } catch {
      setError("Sign in failed. Please try again.")
      loginInFlight.current = false
      setLoading(false)
    }
  }

  const finishEnterApp = useCallback(() => {
    markErpEntrySplashDone()
    window.location.assign(homePathRef.current || "/dashboard")
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await completeLogin(email, password)
  }

  return (
    <PwaProvider>
      {enteringApp && <PostLoginSplash force onDone={finishEnterApp} />}
      <div
        className={`relative min-h-screen flex flex-col items-center justify-center px-5 py-10 overflow-hidden ${
          enteringApp ? "invisible pointer-events-none" : ""
        }`}
        aria-hidden={enteringApp}
      >
        {/* macOS-style soft wallpaper */}
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
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Floating glass window */}
        <div className="relative w-full max-w-[400px]">
          <div
            className="rounded-[22px] border border-white/60 bg-white/55 backdrop-blur-[40px] backdrop-saturate-[180%] shadow-[0_8px_40px_rgba(0,0,0,0.12),0_1px_0_rgba(255,255,255,0.8)_inset] overflow-hidden"
          >
            {/* Traffic-light chrome */}
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-black/[0.04]">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[0_0_0_0.5px_rgba(0,0,0,0.12)]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e] shadow-[0_0_0_0.5px_rgba(0,0,0,0.12)]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[0_0_0_0.5px_rgba(0,0,0,0.12)]" />
              <p className="flex-1 text-center text-[12px] font-medium text-[#86868b] tracking-[-0.01em] pr-10">
                Sign in
              </p>
            </div>

            <div className="px-8 pt-8 pb-7">
              <div className="flex flex-col items-center text-center mb-7">
                <Image
                  src="/logo.png"
                  alt="Voltrix"
                  width={120}
                  height={40}
                  className="h-9 w-auto object-contain mb-5"
                  priority
                />
                <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                  Welcome back
                </h1>
                <p className="mt-1 text-[13px] text-[#86868b] tracking-[-0.01em]">
                  Enter your credentials to continue
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[11px] font-medium text-[#86868b] mb-1.5 tracking-[0.01em]"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@voltrix.com"
                    className="w-full h-[42px] rounded-[10px] border border-black/[0.08] bg-white/80 px-3.5 text-[14px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-[#007aff]/50 focus:ring-[3px] focus:ring-[#007aff]/15 transition-shadow"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-[11px] font-medium text-[#86868b] mb-1.5 tracking-[0.01em]"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-[42px] rounded-[10px] border border-black/[0.08] bg-white/80 px-3.5 pr-10 text-[14px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-[#007aff]/50 focus:ring-[3px] focus:ring-[#007aff]/15 transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aeaeb2] hover:text-[#86868b] transition-colors cursor-pointer"
                      tabIndex={-1}
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 pt-0.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={staySignedIn}
                    onChange={(e) => setStaySignedIn(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                      staySignedIn
                        ? "border-[#007aff] bg-[#007aff]"
                        : "border-black/15 bg-white"
                    }`}
                  >
                    {staySignedIn && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="text-[13px] text-[#1d1d1f]/80 tracking-[-0.01em]">
                    Stay signed in on this phone
                  </span>
                </label>

                {error && (
                  <p className="text-[12px] text-[#ff3b30] bg-[#ff3b30]/08 rounded-[10px] px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || enteringApp}
                  className="mt-1 w-full h-[42px] rounded-full text-[14px] font-semibold text-white flex items-center justify-center gap-2 bg-[#007aff] hover:bg-[#0066d6] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-[0_1px_3px_rgba(0,122,255,0.35)]"
                >
                  {(loading || enteringApp) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {enteringApp ? "Entering…" : loading ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-black/[0.06] space-y-3">
                <Link
                  href="/pos/login"
                  className="flex items-center justify-center w-full h-[40px] rounded-full border border-black/[0.08] bg-white/50 text-[13px] font-medium text-[#1d1d1f] hover:bg-white/80 active:scale-[0.98] transition-all"
                >
                  Sign in to POS
                </Link>
                <a
                  href="/"
                  className="block text-center text-[12px] text-[#007aff] hover:underline underline-offset-2 tracking-[-0.01em]"
                >
                  Back to website
                </a>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-[#86868b]/80 tracking-[-0.01em]">
            © 2026 Voltrix
          </p>
        </div>
      </div>
    </PwaProvider>
  )
}
