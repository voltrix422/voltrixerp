export async function fetchJson<T>(
  url: string,
  options?: { timeoutMs?: number; init?: RequestInit },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 20_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { ...options?.init, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}
