export interface PettyCashAllocation {
  id: string
  employeeId: string
  employeeName: string
  employeeRole: string
  amount: number
  purpose: string
  payoutMethod?: "cash" | "bank_transfer"
  paymentProof?: string
  paymentProofName?: string
  notes: string
  status: 'pending' | 'active' | 'settled' | 'cancelled' | 'rejected'
  allocatedBy: string
  allocatedAt: string
  settledAt?: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
  settlements?: PettyCashSettlement[]
}

export interface PettyCashSettlement {
  id: string
  allocationId: string
  amount: number
  description: string
  proofUrl?: string
  proofName?: string
  submittedBy: string
  submittedAt: string
}

export interface PettyCashReceipt {
  id: string
  allocationId: string
  employeeName: string
  description: string
  amount: number
  receiptProof?: string
  receiptProofName?: string
  notes: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
}

export async function getPettyCashAllocations(): Promise<PettyCashAllocation[]> {
  const res = await fetch('/api/db/petty-cash-allocations')
  if (!res.ok) throw new Error('Failed to fetch petty cash allocations')
  return res.json()
}

export async function createPettyCashAllocation(data: {
  employeeId: string
  employeeName: string
  employeeRole: string
  amount: number
  purpose: string
  paymentProof?: string
  paymentProofName?: string
  notes?: string
  allocatedBy: string
  status?: 'pending' | 'active'
}): Promise<PettyCashAllocation> {
  const res = await fetch('/api/db/petty-cash-allocations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to create petty cash allocation')
  return res.json()
}

export async function createPettyCashRequest(data: {
  employeeId: string
  employeeName: string
  employeeRole: string
  amount: number
  purpose: string
  notes?: string
}): Promise<PettyCashAllocation> {
  return createPettyCashAllocation({
    ...data,
    allocatedBy: data.employeeName,
    status: 'pending',
  })
}

export async function approvePettyCashAllocation(data: {
  id: string
  amount: number
  payoutMethod?: "cash" | "bank_transfer"
  paymentProof?: string | null
  paymentProofName?: string | null
  notes?: string
  reviewedBy: string
}): Promise<PettyCashAllocation> {
  const res = await fetch('/api/db/petty-cash-allocations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      status: 'active',
      reviewedAt: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error('Failed to approve petty cash request')
  return res.json()
}

export async function rejectPettyCashAllocation(
  id: string,
  reviewedBy: string,
  reviewNotes?: string
): Promise<PettyCashAllocation> {
  const res = await fetch('/api/db/petty-cash-allocations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      status: 'rejected',
      reviewedBy,
      reviewNotes,
      reviewedAt: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error('Failed to reject petty cash request')
  return res.json()
}

export async function updatePettyCashAllocationStatus(
  id: string, 
  status: 'pending' | 'active' | 'settled' | 'cancelled' | 'rejected',
  settledAt?: string
): Promise<PettyCashAllocation> {
  const res = await fetch('/api/db/petty-cash-allocations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status, settledAt })
  })
  if (!res.ok) throw new Error('Failed to update petty cash allocation')
  return res.json()
}

export async function deletePettyCashAllocation(id: string): Promise<void> {
  const res = await fetch(`/api/db/petty-cash-allocations?id=${id}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.error || "Failed to delete petty cash allocation")
  }
}

export async function getPettyCashReceipts(allocationId?: string): Promise<PettyCashReceipt[]> {
  const url = allocationId 
    ? `/api/db/petty-cash-receipts?allocationId=${allocationId}`
    : '/api/db/petty-cash-receipts'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch petty cash receipts')
  return res.json()
}

export async function createPettyCashReceipt(data: {
  allocationId: string
  employeeName: string
  description: string
  amount: number
  receiptProof?: string
  receiptProofName?: string
  notes?: string
}): Promise<PettyCashReceipt> {
  const res = await fetch('/api/db/petty-cash-receipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to create petty cash receipt')
  return res.json()
}

export async function updatePettyCashReceiptStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  reviewedBy: string,
  reviewNotes?: string
): Promise<PettyCashReceipt> {
  const res = await fetch('/api/db/petty-cash-receipts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status, reviewedBy, reviewNotes })
  })
  if (!res.ok) throw new Error('Failed to update petty cash receipt')
  return res.json()
}

export async function getPettyCashSettlements(allocationId?: string): Promise<PettyCashSettlement[]> {
  const url = allocationId
    ? `/api/db/petty-cash-settlements?allocationId=${allocationId}`
    : '/api/db/petty-cash-settlements'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch petty cash settlements')
  return res.json()
}

export async function createPettyCashSettlement(data: {
  allocationId: string
  amount: number
  description: string
  proofUrl?: string
  proofName?: string
  submittedBy: string
}): Promise<PettyCashSettlement> {
  const res = await fetch('/api/db/petty-cash-settlements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to create petty cash settlement')
  return res.json()
}
