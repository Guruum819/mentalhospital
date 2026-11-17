export type BookHit = {
  id: string
  title: string
  author: string
  coverUrl: string | null
  source: 'kakao' | 'google' | 'openlibrary'
}

export type SearchOutcome = {
  hits: BookHit[]
  warning: string | null
}

const MAX_HITS = 8

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const url = value.trim().replace(/^http:\/\//i, 'https://')
  if (!/^https:\/\/\S+$/i.test(url) || url.length > 500) return null
  return url.replace('zoom=1', 'zoom=2')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function dedupe(hits: BookHit[]): BookHit[] {
  const seen = new Set<string>()
  const unique: BookHit[] = []
  for (const hit of hits) {
    const key = `${hit.title}\u0000${hit.author}`.toLocaleLowerCase('ko')
    if (!hit.title || seen.has(key)) continue
    seen.add(key)
    unique.push(hit)
    if (unique.length >= MAX_HITS) break
  }
  return unique
}

function namesOf(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return stripHtml(value.filter((author) => typeof author === 'string').join(', '))
}

export function hitsFromKakao(payload: unknown): BookHit[] {
  if (!isRecord(payload) || !Array.isArray(payload.documents)) return []
  const hits: BookHit[] = []
  payload.documents.forEach((item, index) => {
    if (!isRecord(item)) return
    const title = stripHtml(typeof item.title === 'string' ? item.title : '')
    if (!title) return
    hits.push({
      id: `kakao-${index}-${title}`,
      title,
      author: namesOf(item.authors),
      coverUrl: httpsUrl(item.thumbnail),
      source: 'kakao',
    })
  })
  return dedupe(hits)
}

export function hitsFromGoogle(payload: unknown): BookHit[] {
  if (!isRecord(payload) || !Array.isArray(payload.items)) return []
  const hits: BookHit[] = []
  payload.items.forEach((item, index) => {
    if (!isRecord(item) || !isRecord(item.volumeInfo)) return
    const info = item.volumeInfo
    const title = stripHtml(typeof info.title === 'string' ? info.title : '')
    if (!title) return
    const links = isRecord(info.imageLinks) ? info.imageLinks : {}
    hits.push({
      id: typeof item.id === 'string' ? item.id : `google-${index}`,
      title,
      author: namesOf(info.authors),
      coverUrl: httpsUrl(links.thumbnail) ?? httpsUrl(links.smallThumbnail),
      source: 'google',
    })
  })
  return dedupe(hits)
}

export function hitsFromOpenLibrary(payload: unknown): BookHit[] {
  if (!isRecord(payload) || !Array.isArray(payload.docs)) return []
  const hits: BookHit[] = []
  payload.docs.forEach((item, index) => {
    if (!isRecord(item) || typeof item.title !== 'string' || !item.title.trim()) return
    hits.push({
      id: typeof item.key === 'string' ? item.key : `ol-${index}`,
      title: item.title.trim(),
      author: namesOf(item.author_name),
      coverUrl: typeof item.cover_i === 'number' ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : null,
      source: 'openlibrary',
    })
  })
  return dedupe(hits)
}

async function fetchJson(url: string, signal: AbortSignal, headers?: HeadersInit): Promise<unknown> {
  const response = await fetch(url, { signal, headers })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
        ? payload.error.message
        : ''
    const error = new Error(message || `HTTP ${response.status}`)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }
  return payload
}

function googleUrl(query: string): string {
  const key = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY?.trim()
  const url = new URL('https://www.googleapis.com/books/v1/volumes')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', '8')
  url.searchParams.set('printType', 'books')
  if (key) url.searchParams.set('key', key)
  return url.toString()
}

export async function searchBooks(query: string, signal: AbortSignal): Promise<SearchOutcome> {
  const q = query.trim()
  if (q.length < 2) return { hits: [], warning: null }

  const kakaoKey = import.meta.env.VITE_KAKAO_REST_API_KEY?.trim()
  if (kakaoKey) {
    try {
      const payload = await fetchJson(
        `https://dapi.kakao.com/v3/search/book?size=8&query=${encodeURIComponent(q)}`,
        signal,
        { Authorization: `KakaoAK ${kakaoKey}` },
      )
      const hits = hitsFromKakao(payload)
      if (hits.length > 0) return { hits, warning: null }
    } catch (error) {
      if (signal.aborted) throw error
    }
  }

  let warning: string | null = null
  try {
    const payload = await fetchJson(googleUrl(q), signal)
    const hits = hitsFromGoogle(payload)
    if (hits.length > 0) return { hits, warning: null }
  } catch (error) {
    if (signal.aborted) throw error
    const status = (error as { status?: number }).status
    warning =
      status === 429
        ? 'Google 책 검색 한도에 걸렸어요. 직접 입력하거나, README대로 카카오 키를 넣을 수 있어요.'
        : null
  }

  try {
    const payload = await fetchJson(
      `https://openlibrary.org/search.json?limit=8&q=${encodeURIComponent(q)}`,
      signal,
    )
    const hits = hitsFromOpenLibrary(payload)
    if (hits.length > 0) return { hits, warning }
  } catch (error) {
    if (signal.aborted) throw error
  }

  return { hits: [], warning }
}
