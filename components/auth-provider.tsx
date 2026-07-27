"use client"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { type User, getSession, setSession, clearSession, getUsers, login as authLogin, canWriteErp, isViewOnlyUser } from "@/lib/auth"

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<User | null>
  logout: (redirectTo?: string) => void
  refreshUser: () => Promise<void>
  syncSessionUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => null,
  logout: () => {},
  refreshUser: async () => {},
  syncSessionUser: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthWithRole() {
  const { user, ...rest } = useContext(AuthContext)
  return {
    user,
    userRole: user?.role || "user",
    readOnly: isViewOnlyUser(user?.role),
    canWrite: canWriteErp(user),
    ...rest,
  }
}

const PUBLIC_PATH_PREFIXES = [
  "/quote",
  "/products",
  "/services",
  "/vision",
  "/rd",
  "/about",
  "/contact",
  "/outlets",
  "/dealerships",
  "/technology",
  "/warranty",
  "/blog",
  "/careers",
  "/privacy",
  "/terms",
  "/cookies",
  "/documentation",
  "/solar-calculator",
]

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/pos/login" || pathname === "/") return true
  if (pathname.startsWith("/pos")) return pathname === "/pos/login"
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))
}

export { isPublicPath }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const publicPage = !pathname || isPublicPath(pathname)

  useEffect(() => {
    // Restore session from localStorage, then verify against Supabase
    const session = getSession()
    if (session) {
      getUsers()
        .then(users => {
          const fresh = users.find(u => u.id === session.id) ?? session
          setUser(fresh)
          setSession(fresh)
          setChecked(true)
        })
        .catch(() => setChecked(true))
    } else {
      setChecked(true)
    }
  }, [])

  useEffect(() => {
    if (!checked) return
    if (!user) {
      const session = getSession()
      if (session && pathname?.startsWith("/pos") && pathname !== "/pos/login") {
        setUser(session)
        return
      }
    }
    if (!user && pathname && !isPublicPath(pathname)) {
      // Store the intended destination before redirecting to login
      if (typeof window !== "undefined") {
        sessionStorage.setItem("redirectAfterLogin", pathname)
      }
      router.replace(pathname.startsWith("/pos") ? "/pos/login" : "/login")
    }
  }, [user, checked, pathname, router])

  const login = useCallback(async (email: string, password: string): Promise<User | null> => {
    const result = await authLogin(email, password)
    if (result) { setUser(result); return result }
    return null
  }, [])

  const syncSessionUser = useCallback((sessionUser: User) => {
    setSession(sessionUser)
    setUser(sessionUser)
  }, [])

  const logout = useCallback((redirectTo = "/login") => {
    clearSession()
    setUser(null)
    router.replace(redirectTo)
  }, [router])

  const refreshUser = useCallback(async () => {
    const session = getSession()
    if (!session) return
    const users = await getUsers()
    const fresh = users.find(u => u.id === session.id) ?? session
    setUser(fresh)
    setSession(fresh)
  }, [])

  // Don't block public website while session check runs (keeps tracking + SEO content visible)
  if (!checked && !publicPage) return null

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, syncSessionUser }}>
      {children}
    </AuthContext.Provider>
  )
}
