"use client"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { type User, getSession, setSession, clearSession, getUsers, login as authLogin } from "@/lib/auth"

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
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
    if (!user && pathname !== "/login" && pathname !== "/") {
      // Store the intended destination before redirecting to login
      if (typeof window !== "undefined") {
        sessionStorage.setItem("redirectAfterLogin", pathname)
      }
      router.replace("/login")
    }
  }, [user, checked, pathname, router])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const result = await authLogin(email, password)
    if (result) { setUser(result); return true }
    return false
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
