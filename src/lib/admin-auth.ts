const SESSION_KEY = 'exchange-reading-admin'

let memoryHash: string | null = null

export function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashSecret(secret: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${secret}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readSession(): string | null {
  if (memoryHash) return memoryHash
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function isAdminSession(hash: string | null): boolean {
  if (!hash) return false
  return readSession() === hash
}

export function rememberAdmin(hash: string) {
  memoryHash = hash
  try {
    sessionStorage.setItem(SESSION_KEY, hash)
  } catch {
    // the tab still keeps the session in memory
  }
}

export function forgetAdmin() {
  memoryHash = null
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}
