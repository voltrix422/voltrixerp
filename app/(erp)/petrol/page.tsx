"use client"

import { Topbar } from "@/components/layout/topbar"
import { PetrolFuelDashboard } from "@/components/purchase/petrol-fuel-dashboard"
import { useAuth } from "@/components/auth-provider"

export default function PetrolPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <Topbar
        title="Petrol / fuel"
        description="Allot fuel money · settle with KM + spending proofs"
      />
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 max-w-7xl">
          <PetrolFuelDashboard />
        </div>
      </div>
    </>
  )
}
