export interface PettyCashAllocation {
  id: string
  employeeId: string
  employeeName: string
  employeeRole: string
  amount: number
  purpose: string
  paymentProof?: string
  paymentProofName?: string
  notes: string
  status: 'active' | 'settled' | 'cancelled'
  allocatedBy: string
  allocatedAt: string
  settledAt?: string
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
}): Promise<PettyCashAllocation> {
  const res = await fetch('/api/db/petty-cash-allocations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to create petty cash allocation')
  return res.json()
}

export async function updatePettyCashAllocationStatus(
  id: string, 
  status: 'active' | 'settled' | 'cancelled',
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
