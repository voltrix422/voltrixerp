import { supabase } from "@/lib/supabase"

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

function rowToClient(r: Record<string, unknown>): Client {
  return {
    id: r.id as string,
    name: r.name as string,
    company: r.company as string,
    email: r.email as string,
    phone: r.phone as string,
    address: r.address as string,
    city: r.city as string,
    country: r.country as string,
    website: (r.website as string) ?? "",
    taxId: (r.tax_id as string) ?? "",
    industry: (r.industry as string) ?? "",
    contactPerson: (r.contact_person as string) ?? "",
    imageUrl: (r.image_url as string) ?? undefined,
    notes: r.notes as string,
    createdAt: r.created_at as string,
    createdBy: r.created_by as string,
  }
}

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("erp_clients")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error(error); return [] }
  return (data ?? []).map(rowToClient)
}

export async function saveClient(client: Client): Promise<void> {
  const { error } = await supabase.from("erp_clients").upsert({
    id: client.id,
    name: client.name,
    company: client.company,
    email: client.email,
    phone: client.phone,
    address: client.address,
    city: client.city,
    country: client.country,
    website: client.website,
    tax_id: client.taxId,
    industry: client.industry,
    contact_person: client.contactPerson,
    image_url: client.imageUrl,
    notes: client.notes,
    created_at: client.createdAt,
    created_by: client.createdBy,
  })
  if (error) console.error("saveClient error:", error.message)
}

export async function deleteClient(id: string): Promise<void> {
  await supabase.from("erp_clients").delete().eq("id", id)
}
