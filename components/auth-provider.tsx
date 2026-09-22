"use client"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { type User, getSession, setSession, clearSession, clearRememberedLogin, getUsers, login as authLogin, canWriteErp, isViewOnlyUser, isInvestorUser, homePathForUser } from "@/lib/auth"

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
  if (pathname === "/login" || pathname === "/pos/login" || pathname === "/investor/login" || pathname === "/") return true
  if (pathname.startsWith("/pos")) return pathname === "/pos/login"
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))
}

function isInvestorPortalPath(pathname: string): boolean {
  if (pathname === "/investor/login") return false
  return pathname === "/investor" || pathname.startsWith("/investor/")
}

export { isPublicPath }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const publicPage = !pathname || isPublicPath(pathname)

  useEffect(() => {
    const session = getSession()
    if (session) {
      setUser(session)
      setSession(session)
    }
    setChecked(true)
    if (!session) return
    getUsers()
      .then(users => {
        const fresh = users.find(u => u.id === session.id) ?? session
        setUser(fresh)
        setSession(fresh)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!checked) return
    if (!user) {
      const session = getSession()
      if (session && pathname?.startsWith("/pos") && pathname !== "/pos/login") {
        setUser(session)
        return
      }
      if (session && pathname?.startsWith("/investor") && pathname !== "/investor/login") {
        setUser(session)
        return
      }
    }
    if (!user && pathname && !isPublicPath(pathname)) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("redirectAfterLogin", pathname)
      }
      if (pathname.startsWith("/pos")) {
        router.replace("/pos/login")
      } else if (isInvestorPortalPath(pathname)) {
        router.replace("/investor/login")
      } else {
        router.replace("/login")
      }
      return
    }

    if (user && pathname) {
      const investor = isInvestorUser(user.role)
      if (investor && pathname === "/investor/login") {
        router.replace("/investor")
        return
      }
      if (investor && !isPublicPath(pathname) && !isInvestorPortalPath(pathname)) {
        router.replace("/investor")
        return
      }
      if (!investor && isInvestorPortalPath(pathname)) {
        router.replace(homePathForUser(user))
      }
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
    clearRememberedLogin()
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
