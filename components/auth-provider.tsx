"use client"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { type User, getSession, setSession, clearSession, getUsers, login as authLogin } from "@/lib/auth"

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<User | null>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => null,
  logout: () => {},
  refreshUser: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Restore session from localStorage, then verify against Supabase
    const session = getSession()
    if (session) {
      getUsers().then(users => {
        const fresh = users.find(u => u.id === session.id) ?? session
        setUser(fresh)
        setSession(fresh)
        setChecked(true)
      })
    } else {
      setChecked(true)
    }
  }, [])

  useEffect(() => {
    if (!checked) return
    if (!user && pathname !== "/login" && pathname !== "/" && !pathname.startsWith("/quote") && !pathname.startsWith("/products") && !pathname.startsWith("/services") && !pathname.startsWith("/vision") && !pathname.startsWith("/rd") && !pathname.startsWith("/about") && !pathname.startsWith("/contact") && !pathname.startsWith("/technology")) {
      // Store the intended destination before redirecting to login
      if (typeof window !== "undefined") {
        sessionStorage.setItem("redirectAfterLogin", pathname)
      }
      router.replace("/login")
    }
  }, [user, checked, pathname, router])

  const login = useCallback(async (email: string, password: string): Promise<User | null> => {
    const result = await authLogin(email, password)
    if (result) { setUser(result); return result }
    return null
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    router.replace("/login")
  }, [router])

  const refreshUser = useCallback(async () => {
    const session = getSession()
    if (!session) return
    const users = await getUsers()
    const fresh = users.find(u => u.id === session.id) ?? session
    setUser(fresh)
    setSession(fresh)
  }, [])

  if (!checked) return null

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
