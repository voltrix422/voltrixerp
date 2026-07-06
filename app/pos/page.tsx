"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { BranchPosApp } from "@/components/pos/branch-pos-app"
import { Loader2 } from "lucide-react"

export default function PosPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !user.branchId) {
      router.replace("/pos/login")
    }
  }, [user, router])

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a9f9a]" />
      </div>
    )
  }

  if (!user.branchId) return null

  return <BranchPosApp />
}
