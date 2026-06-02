export interface Staff {
  id: string
  name: string
  role: string
  department: string
  email: string
  phone: string
  address: string
  salary: number
  currency: string
  joinDate: string
  status: string
  notes: string
  points: number
  warnings: any[]
  lastReset: string
  createdBy: string
  createdAt: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountTitle?: string
  erp_user_id?: string | null
}

export async function getStaff(): Promise<Staff[]> {
  const res = await fetch('/api/hrm/staff')
  if (!res.ok) throw new Error('Failed to fetch staff')
  return res.json()
}
