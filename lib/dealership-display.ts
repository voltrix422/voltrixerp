export type DealershipRecord = {
  id: string
  name: string
  city: string
  address: string
  phone: string
  email: string
  contactPerson: string
  openingHours: string
  mapUrl: string
}

export type NormalizedDealership = DealershipRecord & {
  displayName: string
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function titleCase(value: string) {
  return clean(value)
    .split(" ")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

/** Pull structured fields out of pasted blobs like "Company name : X Address Y Phone number : Z". */
function parseCombinedBlob(text: string) {
  const blob = clean(text)
  if (!/company\s*name\s*:/i.test(blob) && !/phone\s*(?:number)?\s*:/i.test(blob)) {
    return null
  }

  const company = blob.match(/company\s*name\s*:\s*(.+?)(?=\s+address\s+|\s+phone\s*(?:number)?\s*:|$)/i)?.[1]
  const address = blob.match(/address\s+(.+?)(?=\s+phone\s*(?:number)?\s*:|$)/i)?.[1]
  const phone = blob.match(/phone\s*(?:number)?\s*:\s*(.+)$/i)?.[1]

  return {
    name: company ? clean(company) : "",
    address: address ? clean(address) : "",
    phone: phone ? clean(phone) : "",
  }
}

function normalizePhone(phone: string) {
  return clean(phone).replace(/[^\d+\-\s()]/g, "")
}

function sameText(a: string, b: string) {
  return clean(a).toLowerCase() === clean(b).toLowerCase()
}

export function normalizeDealership(dealership: DealershipRecord): NormalizedDealership {
  const parsed = parseCombinedBlob(dealership.name)

  let name = parsed?.name || clean(dealership.name)
  let address = clean(dealership.address)
  let phone = normalizePhone(dealership.phone)

  if (parsed?.address && !address) address = parsed.address
  if (parsed?.phone && !phone) phone = normalizePhone(parsed.phone)

  if (address && sameText(address, name)) address = ""

  const displayName = titleCase(name)

  return {
    ...dealership,
    name,
    address,
    phone,
    contactPerson: clean(dealership.contactPerson),
    city: clean(dealership.city),
    email: clean(dealership.email),
    openingHours: clean(dealership.openingHours),
    mapUrl: clean(dealership.mapUrl),
    displayName,
  }
}

export function mapsHref(dealership: Pick<NormalizedDealership, "mapUrl" | "address" | "city">) {
  if (dealership.mapUrl) return dealership.mapUrl
  const query = [dealership.address, dealership.city].filter(Boolean).join(", ")
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
