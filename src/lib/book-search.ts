import { readGoogleBooksKey, readKakaoKey } from './config.ts'

export type BookHit = {
  id: string
  title: string
  author: string
  coverUrl: string | null
  source: 'kakao' | 'google' | 'openlibrary' | 'wiki'
}

export type SearchOutcome = {
  hits: BookHit[]
  warning: string | null
}

const MAX_HITS = 8
const HANGUL = /[가-힣]/
const QUOTA_WARNING = '검색 한도에 걸렸어용. 직접 입력해 주세용'

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
  let url = value.trim()
  if (url.startsWith('//')) url = `https:${url}`
  url = url.replace(/^http:\/\//i, 'https://')
  if (!/^https:\/\/\S+$/i.test(url) || url.length > 800) return null
  return url.replace('zoom=1', 'zoom=2')
}

export function hasHangul(value: string): boolean {
  return HANGUL.test(value)
}

export function authorFromWikiDescription(description: string): string {
  const text = stripHtml(description)
  if (!text || text.includes('동음이의')) return ''
  const match = text.match(
    /((?:[가-힣]{2,8})(?:\s+[가-힣]{1,8})?|(?:[A-Z][a-zA-Z.'’-]+)(?:\s+[A-Z][a-zA-Z.'’-]+){0,3})의\s+(?:[^.]{0,30})?(?:장편소설|장편 소설|소설|시집|수필|에세이|동화|그림책)(?![가-힣])/,
  )
  return match?.[1]?.replace(/^작가\s*/, '').trim() ?? ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeTitle(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ko')
    .replace(/[\s"'“”‘’「」()[\]{}.,·:：/\\-]+/g, '')
}

function namesOf(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return stripHtml(value.filter((author) => typeof author === 'string').join(', '))
}

function wikiImage(value: unknown): string | null {
  if (!isRecord(value)) return null
  const raw = typeof value.url === 'string' ? value.url : typeof value.source === 'string' ? value.source : ''
  const url = httpsUrl(raw)
  if (!url) return null
  return url.replace(/\/\d+px-/, '/330px-')
}

function acceptWikiPage(title: string, description: string, query: string): boolean {
  if (!title || description.includes('동음이의')) return false
  if (/\((영화|드라마|앨범|노래|만화|게임)\)/.test(title)) return false
  const nTitle = normalizeTitle(title)
  const nQuery = normalizeTitle(query)
  if (!nTitle || !nQuery) return false
  if (nTitle.length + 1 < nQuery.length && nQuery.startsWith(nTitle)) return false
  return nTitle.includes(nQuery) || nQuery.includes(nTitle)
}

function scoreHit(hit: BookHit, query: string): number {
  const title = normalizeTitle(hit.title)
  const q = normalizeTitle(query)
  let score = 0
  if (title && title === q) score += 8
  else if (title && q && (title.includes(q) || q.includes(title))) score += 3
  if (hasHangul(hit.title)) score += 4
  if (hasHangul(hit.author)) score += 2
  if (hit.coverUrl) score += 2
  score += { kakao: 3, google: 2, wiki: 1, openlibrary: 0 }[hit.source]
  return score
}

export function orderHits(hits: BookHit[], query: string): BookHit[] {
  const ranked = [...hits].sort((a, b) => scoreHit(b, query) - scoreHit(a, query) || a.title.localeCompare(b.title, 'ko'))
  const seen = new Set<string>()
  const unique: BookHit[] = []
  for (const hit of ranked) {
    const key = normalizeTitle(hit.title)
    if (!hit.title || !key || seen.has(key)) continue
    seen.add(key)
    unique.push(hit)
  }
  const kept =
    hasHangul(query) && unique.some((hit) => hasHangul(hit.title))
      ? unique.filter((hit) => hasHangul(hit.title))
      : unique
  return kept.slice(0, MAX_HITS)
}

function withBorrowedCover(wiki: BookHit[], openlibrary: BookHit[], query: string): BookHit[] {
  if (openlibrary.length !== 1 || !openlibrary[0]?.coverUrl) return wiki
  const nQuery = normalizeTitle(query)
  const index = wiki.findIndex((hit) => {
    const title = normalizeTitle(hit.title)
    return !hit.coverUrl && (title === nQuery || title.startsWith(nQuery))
  })
  if (index < 0) return wiki
  const next = wiki.slice()
  next[index] = { ...wiki[index], coverUrl: openlibrary[0].coverUrl }
  return next
}

const CHO_RR = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const JUNG_RR = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
const JONG_RR = ['', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 'h']
const CHO_MR = ['k', 'kk', 'n', 't', 'tt', 'r', 'm', 'p', 'pp', 's', 'ss', '', 'ch', 'tch', 'ch', 'k', 't', 'p', 'h']
const JUNG_MR = ['a', 'ae', 'ya', 'yae', 'o', 'e', 'yo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'u', 'ui', 'i']
const JONG_MR = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'p', 'l', 'l', 'l', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 'h']

function romanizeHangul(text: string, style: 'rr' | 'mr'): string {
  const cho = style === 'rr' ? CHO_RR : CHO_MR
  const jung = style === 'rr' ? JUNG_RR : JUNG_MR
  const jong = style === 'rr' ? JONG_RR : JONG_MR
  let out = ''
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0xac00 || code > 0xd7a3) continue
    const syllable = code - 0xac00
    out += cho[Math.floor(syllable / 588)]
    out += jung[Math.floor((syllable % 588) / 28)]
    out += jong[syllable % 28]
  }
  return out
}

function foldLatin(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function editDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index])
  for (let col = 1; col <= right.length; col += 1) rows[0][col] = col
  for (let row = 1; row <= left.length; row += 1) {
    for (let col = 1; col <= right.length; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1
      rows[row][col] = Math.min(rows[row - 1][col] + 1, rows[row][col - 1] + 1, rows[row - 1][col - 1] + cost)
    }
  }
  return rows[left.length][right.length]
}

function romanizationsMatch(query: string, title: string): boolean {
  const folded = foldLatin(title.split('/')[0] ?? title)
  if (folded.length < 4) return false
  for (const style of ['rr', 'mr'] as const) {
    const romanized = foldLatin(romanizeHangul(query, style))
    if (!romanized) continue
    if (romanized === folded || romanized.includes(folded) || folded.includes(romanized)) return true
    const distance = editDistance(romanized, folded)
    if (1 - distance / Math.max(romanized.length, folded.length) >= 0.72) return true
  }
  return false
}

export function titleForHangulQuery(title: string, query: string): string {
  const typed = query.trim()
  if (!hasHangul(typed) || hasHangul(title)) return title
  return romanizationsMatch(typed, title) ? typed : title
}

function withQueryTitles(hits: BookHit[], query: string): BookHit[] {
  return hits.map((hit) => {
    const title = titleForHangulQuery(hit.title, query)
    return title === hit.title ? hit : { ...hit, title }
  })
}

export function combineBookHits(
  input: { wiki?: BookHit[]; kakao?: BookHit[]; google?: BookHit[]; openlibrary?: BookHit[] },
  query: string,
): BookHit[] {
  const openlibrary = input.openlibrary ?? []
  const wiki = withBorrowedCover(input.wiki ?? [], openlibrary, query)
  return orderHits(
    withQueryTitles([...(input.kakao ?? []), ...(input.google ?? []), ...wiki, ...openlibrary], query),
    query,
  )
}

export function kakaoCoverUrl(thumbnail: unknown): string | null {
  if (typeof thumbnail === 'string') {
    try {
      const parsed = new URL(thumbnail.trim().replace(/^http:\/\//i, 'https://'))
      const original = httpsUrl(parsed.searchParams.get('fname'))
      if (original) return original
    } catch {
      // keep the thumbnail itself
    }
  }
  return httpsUrl(thumbnail)
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
      coverUrl: kakaoCoverUrl(item.thumbnail),
      source: 'kakao',
    })
  })
  return hits
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
  return hits
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
  return hits
}

export function hitsFromWiki(payload: unknown, query: string): BookHit[] {
  if (!isRecord(payload) || !Array.isArray(payload.pages)) return []
  const hits: BookHit[] = []
  payload.pages.forEach((page) => {
    if (!isRecord(page) || typeof page.title !== 'string') return
    const title = stripHtml(page.title)
    const description = typeof page.description === 'string' ? stripHtml(page.description) : ''
    if (!acceptWikiPage(title, description, query)) return
    hits.push({
      id: `wiki-${typeof page.id === 'number' ? page.id : title}`,
      title,
      author: authorFromWikiDescription(description),
      coverUrl: wikiImage(page.thumbnail),
      source: 'wiki',
    })
  })
  return hits
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

function googleUrl(query: string, key: string, langRestrict: boolean): string {
  const url = new URL('https://www.googleapis.com/books/v1/volumes')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', '8')
  url.searchParams.set('printType', 'books')
  url.searchParams.set('country', 'KR')
  if (langRestrict) url.searchParams.set('langRestrict', 'ko')
  if (key) url.searchParams.set('key', key)
  return url.toString()
}

async function searchGoogle(query: string, signal: AbortSignal): Promise<{ hits: BookHit[]; quota: boolean }> {
  const key = readGoogleBooksKey()
  const attempts = hasHangul(query) ? [true, false] : [false]
  for (const restrict of attempts) {
    try {
      const payload = await fetchJson(googleUrl(query, key, restrict), signal)
      const hits = hitsFromGoogle(payload)
      if (hits.length > 0 || !restrict) return { hits, quota: false }
    } catch (error) {
      if (signal.aborted) throw error
      const status = (error as { status?: number }).status
      if (status === 429) return { hits: [], quota: true }
      return { hits: [], quota: false }
    }
  }
  return { hits: [], quota: false }
}

async function searchKakao(query: string, signal: AbortSignal, key: string): Promise<BookHit[]> {
  const payload = await fetchJson(
    `https://dapi.kakao.com/v3/search/book?size=8&query=${encodeURIComponent(query)}`,
    signal,
    { Authorization: `KakaoAK ${key}` },
  )
  return hitsFromKakao(payload)
}

async function searchWiki(query: string, signal: AbortSignal): Promise<BookHit[]> {
  const payload = await fetchJson(
    `https://ko.wikipedia.org/w/rest.php/v1/search/page?limit=8&q=${encodeURIComponent(query)}`,
    signal,
  )
  return hitsFromWiki(payload, query)
}

async function searchOpenLibrary(query: string, signal: AbortSignal): Promise<BookHit[]> {
  const language = hasHangul(query) ? '&language=kor' : ''
  const payload = await fetchJson(
    `https://openlibrary.org/search.json?limit=5${language}&q=${encodeURIComponent(query)}`,
    signal,
  )
  return hitsFromOpenLibrary(payload)
}

async function safeHits(run: () => Promise<BookHit[]>, signal: AbortSignal): Promise<BookHit[]> {
  try {
    return await run()
  } catch (error) {
    if (signal.aborted) throw error
    return []
  }
}

export async function searchBooks(query: string, signal: AbortSignal): Promise<SearchOutcome> {
  const q = query.trim()
  if (q.length < 2) return { hits: [], warning: null }

  const kakaoKey = readKakaoKey()
  if (kakaoKey) {
    try {
      const kakao = orderHits(withQueryTitles(await searchKakao(q, signal, kakaoKey), q), q)
      if (kakao.length > 0) return { hits: kakao, warning: null }
    } catch (error) {
      if (signal.aborted) throw error
    }
  }

  const [wiki, openlibrary, google] = await Promise.all([
    hasHangul(q) ? safeHits(() => searchWiki(q, signal), signal) : Promise.resolve([]),
    safeHits(() => searchOpenLibrary(q, signal), signal),
    searchGoogle(q, signal),
  ])

  const hits = combineBookHits({ wiki, google: google.hits, openlibrary }, q)
  const warning = google.quota && !hits.some((hit) => hasHangul(hit.title)) ? QUOTA_WARNING : null
  return { hits, warning }
}
