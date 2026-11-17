export const APP_BUILD_TIME = typeof __APP_BUILD_TIME__ === 'string' ? __APP_BUILD_TIME__ : ''

export function formatBuildLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('month')}월 ${pick('day')}일 ${pick('hour')}:${pick('minute')}`
}

export function isNewerBuild(localIso: string, remoteIso: string): boolean {
  const local = Date.parse(localIso)
  const remote = Date.parse(remoteIso)
  if (!Number.isFinite(local) || !Number.isFinite(remote)) return false
  return remote > local + 1000
}

export async function fetchDeployedBuildTime(): Promise<string | null> {
  const url = new URL('version.json', new URL(import.meta.env.BASE_URL, window.location.origin))
  url.searchParams.set('t', String(Date.now()))
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) return null
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object' || !('builtAt' in payload)) return null
  const builtAt = (payload as { builtAt?: unknown }).builtAt
  return typeof builtAt === 'string' ? builtAt : null
}

/** Drop any cached app shell, then open the latest index.html. */
export async function reloadLatestBuild(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
  const next = new URL(window.location.href)
  next.searchParams.set('v', String(Date.now()))
  window.location.replace(next.toString())
}
