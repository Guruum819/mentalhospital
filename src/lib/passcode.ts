const MEMORY_KEY = 'exchange-reading-unlock'
const LOCAL_KEY = 'exchange-reading-unlock'

let memoryUnlock: string | null = null

export function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashPasscode(passcode: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${passcode}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readStored(storage: Storage): string | null {
  try {
    return storage.getItem(LOCAL_KEY)
  } catch {
    return null
  }
}

export function isUnlocked(hash: string | null): boolean {
  if (!hash) return true
  if (memoryUnlock === hash) return true
  if (typeof sessionStorage !== 'undefined' && readStored(sessionStorage) === hash) return true
  if (typeof localStorage !== 'undefined' && readStored(localStorage) === hash) return true
  return false
}

export function rememberUnlock(hash: string, persist: boolean) {
  memoryUnlock = hash
  try {
    sessionStorage.setItem(MEMORY_KEY, hash)
  } catch {
    // session storage can be blocked
  }
  try {
    if (persist) localStorage.setItem(LOCAL_KEY, hash)
    else localStorage.removeItem(LOCAL_KEY)
  } catch {
    // local storage can be blocked
  }
}

export function clearUnlock() {
  memoryUnlock = null
  try {
    sessionStorage.removeItem(MEMORY_KEY)
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(LOCAL_KEY)
  } catch {
    // ignore
  }
}
