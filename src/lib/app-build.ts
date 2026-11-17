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

export function buildsDiffer(localIso: string, remoteIso: string): boolean {
  return Boolean(localIso && remoteIso && localIso !== remoteIso)
}

const SKIP_INPUT = new Set(['button', 'checkbox', 'file', 'hidden', 'image', 'radio', 'reset', 'submit'])

export function fieldBlocksReload(
  field: { tagName: string; type?: string; value?: string; isContentEditable?: boolean },
  focused: boolean,
): boolean {
  const tag = field.tagName.toLowerCase()
  const type = (field.type ?? 'text').toLowerCase()
  if (field.isContentEditable) return focused || Boolean(field.value?.trim())
  if (tag === 'textarea') return focused || Boolean(field.value?.trim())
  if (tag !== 'input' || SKIP_INPUT.has(type)) return false
  return focused || Boolean(field.value?.trim())
}

export function pageBlocksReload(): boolean {
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body && fieldBlocksReload(active, true)) return true
  for (const node of document.querySelectorAll('input, textarea')) {
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) continue
    if (node === active) continue
    if (fieldBlocksReload(node, false)) return true
  }
  return false
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

const CHECK_EVERY_MS = 3 * 60 * 1000

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

/** Check on launch, when the app becomes visible again, and every few minutes. */
export function startAutoUpdate(): () => void {
  let stopped = false
  let waiting = false
  let told = false
  let retry = 0

  async function look() {
    if (stopped || waiting) return
    let remote: string | null = null
    try {
      remote = await fetchDeployedBuildTime()
    } catch {
      return
    }
    if (stopped || !remote || !buildsDiffer(APP_BUILD_TIME, remote)) return
    waiting = true
    offer()
  }

  function offer() {
    if (stopped || !waiting) return
    window.clearTimeout(retry)
    if (!pageBlocksReload()) {
      void reloadLatestBuild()
      return
    }
    if (!told) {
      told = true
      void import('sonner').then(({ toast }) => {
        toast('새 버전이 있어용! 눌러서 새로고침', {
          id: 'app-update',
          duration: Infinity,
          action: {
            label: '새로고침',
            onClick: () => {
              void reloadLatestBuild()
            },
          },
        })
      })
    }
    retry = window.setTimeout(offer, 1500)
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') void look()
  }
  const onEdit = () => {
    if (waiting) window.setTimeout(offer, 50)
  }

  void look()
  const interval = window.setInterval(() => void look(), CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', onVisible)
  document.addEventListener('focusout', onEdit)
  document.addEventListener('input', onEdit)

  return () => {
    stopped = true
    window.clearInterval(interval)
    window.clearTimeout(retry)
    document.removeEventListener('visibilitychange', onVisible)
    document.removeEventListener('focusout', onEdit)
    document.removeEventListener('input', onEdit)
  }
}
