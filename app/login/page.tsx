"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    await new Promise(r => setTimeout(r, 300))
    const ok = login(email.trim(), password)
    setLoading(false)
    if (!ok) {
      setError("Invalid email or password.")
      return
    }
    
    // Check if there's a stored redirect path
    const redirectPath = sessionStorage.getItem("redirectAfterLogin")
    if (redirectPath) {
      sessionStorage.removeItem("redirectAfterLogin")
      router.replace(redirectPath)
    } else {
      router.replace("/dashboard")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="VoltrixERP" width={120} height={36} className="object-contain" priority />
        </div>

        <div className="rounded-xl border bg-[hsl(var(--card))] p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@voltrix.com"
                className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 pr-9 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-500/10 rounded-md px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[hsl(var(--muted-foreground))] mt-6">
          VoltrixERP · Enterprise Resource Planning
        </p>
      </div>
    </div>
  )
}
