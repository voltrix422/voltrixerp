export interface Client {
  id: string
  name: string
  company: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  website: string
  taxId: string
  industry: string
  contactPerson: string
  imageUrl?: string
  notes: string
  createdAt: string
  createdBy: string
}

function mapRow(r: Record<string, unknown>): Client {
  return {
    id: r.id as string,
    name: r.name as string,
    company: (r.company as string) ?? "",
    email: (r.email as string) ?? "",
    phone: (r.phone as string) ?? "",
    address: (r.address as string) ?? "",
    city: (r.city as string) ?? "",
    country: (r.country as string) ?? "",
    website: (r.website as string) ?? "",
    taxId: (r.taxId as string) ?? "",
    industry: (r.industry as string) ?? "",
    contactPerson: (r.contactPerson as string) ?? "",
    imageUrl: (r.imageUrl as string) ?? undefined,
    notes: (r.notes as string) ?? "",
    createdAt: r.createdAt as string,
    createdBy: r.createdBy as string,
  }
}

export async function getClients(): Promise<Client[]> {
  const res = await fetch("/api/db/clients")
  if (!res.ok) return []
  const data = await res.json()
  return data.map(mapRow)
}

export async function saveClient(client: Client): Promise<void> {
  await fetch("/api/db/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(client),
  })
}

export async function deleteClient(id: string): Promise<void> {
  await fetch("/api/db/clients", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}
