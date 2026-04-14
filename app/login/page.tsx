"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/components/auth-provider"
import { Eye, EyeOff, Loader2, BarChart3, Package, Users2, Globe, Zap } from "lucide-react"
import RotatingText from "@/components/landing/rotating-text"

const modules = [
  { icon: BarChart3, label: "Dashboard"   },
  { icon: Package,   label: "Inventory"   },
  { icon: Users2,    label: "CRM"         },
  { icon: Globe,     label: "Website"     },
  { icon: Zap,       label: "Finance"     },
]

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail]     = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    await new Promise(r => setTimeout(r, 300))
    const ok = login(email.trim(), password)
    setLoading(false)
    if (!ok) { setError("Invalid email or password."); return }
    const redirectPath = sessionStorage.getItem("redirectAfterLogin")
    if (redirectPath) { sessionStorage.removeItem("redirectAfterLogin"); router.replace(redirectPath) }
    else router.replace("/dashboard")
  }

  return (
    <div className="min-h-screen flex bg-white">

      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 shrink-0 p-16" style={{ backgroundColor: "#1a9f9a" }}>
        <a href="/">
          <Image src="/logo.png" alt="Voltrix" width={110} height={36} className="h-8 w-auto object-contain brightness-0 invert" />
        </a>

        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Manage your<br />
              <span className="inline-flex items-center gap-2">
                <RotatingText
                  texts={["Dashboard", "Inventory", "CRM", "Website", "Finance"]}
                  mainClassName="bg-white text-[#1a9f9a] px-2 py-0.5 rounded-md font-bold"
                  splitLevelClassName="overflow-hidden"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-120%" }}
                  staggerFrom="last"
                  staggerDuration={0.025}
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  rotationInterval={2000}
                />
              </span>
              <br />from one place.
            </h1>
          </div>

          {/* Module pills */}
          <div className="flex flex-wrap gap-2">
          </div>
        </div>

        <p className="text-xs text-white/50">© 2026 Voltrix</p>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white">
        <div className="lg:hidden mb-10">
          <Image src="/logo.png" alt="Voltrix" width={110} height={36} className="h-8 w-auto object-contain" />
        </div>

        <div className="w-full max-w-xs space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Sign in</h2>
            <p className="text-sm text-neutral-400 mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-500" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@voltrix.com"
                className="w-full h-10 rounded-lg border border-neutral-300 bg-transparent px-3 text-sm outline-none focus:border-[#1a9f9a] transition-colors placeholder:text-neutral-300"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-neutral-500" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 rounded-lg border border-neutral-300 bg-transparent px-3 pr-10 text-sm outline-none focus:border-[#1a9f9a] transition-colors placeholder:text-neutral-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

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

          <div className="text-center">
            <a href="/" className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors hover:underline hover:decoration-dotted underline-offset-2">
              Back to website
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
