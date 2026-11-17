const WHO_KEY = 'exchange-reading-who'
const ACCOUNTS_KEY = 'exchange-reading-accounts'

function readList(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

function writeList(ids: string[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

export function readWho(): string | null {
  try {
    return localStorage.getItem(WHO_KEY)
  } catch {
    return null
  }
}

export function writeWho(id: string | null) {
  try {
    if (id) localStorage.setItem(WHO_KEY, id)
    else localStorage.removeItem(WHO_KEY)
  } catch {
    // this tab still keeps the choice in memory
  }
}

export function readAccounts(): string[] {
  return readList()
}

/** Remember that this profile is logged in on this phone, and make it current. */
export function rememberAccount(id: string) {
  const next = [id, ...readList().filter((item) => item !== id)].slice(0, 10)
  writeList(next)
  writeWho(id)
}

/** Remove one logged-in account from this phone. Returns the account to show next. */
export function forgetAccount(id: string): string | null {
  const next = readList().filter((item) => item !== id)
  writeList(next)
  const current = readWho()
  const fallback = current && current !== id && next.includes(current) ? current : next[0] ?? null
  writeWho(fallback)
  return fallback
}

/** Remove a profile from this phone. If it was the open session, leave the login screen. */
export function signOutAccount(id: string) {
  const next = readList().filter((item) => item !== id)
  writeList(next)
  if (readWho() === id) writeWho(null)
}
