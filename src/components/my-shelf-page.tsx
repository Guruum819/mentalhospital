import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ImageOff } from 'lucide-react'
import { resolvedHolderId } from '@/lib/model'
import type { Book, ReadMap } from '@/lib/types'
import { TextTabs } from '@/components/text-tabs'
import { AddBookButton } from '@/components/add-book-button'

type Tab = 'bought' | 'holding' | 'read'

const TABS: [Tab, string][] = [
  ['bought', '구매한 책'],
  ['holding', '보유한 책'],
  ['read', '읽은 책'],
]

const SPINE_COLORS = ['#6e3b3b', '#2f4a3c', '#1e3a5f', '#5c4a32', '#3d3a55', '#7a4b32', '#1f4d4a', '#4a3b2a', '#6b3a4a', '#2c3e50']

export function MyShelfPage({
  meId,
  title,
  books,
  reads,
  approvedIds,
  onBack,
  onOpenBook,
  onAdd,
}: {
  meId: string
  title: string
  books: readonly Book[]
  reads: ReadMap
  approvedIds: ReadonlySet<string>
  onBack: () => void
  onOpenBook: (bookId: string) => void
  onAdd?: () => void
}) {
  const [tab, setTab] = useState<Tab>('bought')
  const bought = books.filter((book) => book.buyerId === meId)
  const holding = books.filter((book) => resolvedHolderId(book, approvedIds) === meId)
  const read = books.filter((book) => reads[book.id]?.[meId])
  const shown = tab === 'bought' ? bought : tab === 'holding' ? holding : read

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="relative flex h-14 items-center">
          <button type="button" className="grid size-11 place-items-center" onClick={onBack} aria-label="뒤로">
            <ChevronLeft className="size-6" />
          </button>
          <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-[17px] font-bold">{title}</h1>
        </div>
        <TextTabs
          label="내 서재"
          value={tab}
          tabs={TABS.map(([id, label]) => ({ id, label }))}
          onChange={setTab}
        />
      </header>
      {tab === 'read' ? (
        <>
          {shown.length === 0 ? <p className="px-6 pt-8 text-center text-[15px] text-muted-foreground">{emptyCopy(tab)}</p> : null}
          <Bookshelf books={shown} onOpen={onOpenBook} />
        </>
      ) : shown.length === 0 ? (
        <p className="px-6 py-16 text-center text-[15px] text-muted-foreground">{emptyCopy(tab)}</p>
      ) : (
        <ul className={`grid grid-cols-3 gap-x-3 gap-y-5 px-4 py-4 ${tab === 'bought' && onAdd ? 'pb-28' : ''}`}>
          {shown.map((book) => (
            <li key={book.id}>
              <button type="button" className="w-full text-left" onClick={() => onOpenBook(book.id)}>
                <Cover book={book} />
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-4 font-bold">{book.title}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {tab === 'bought' && onAdd ? <AddBookButton onClick={onAdd} /> : null}
    </div>
  )
}

function emptyCopy(tab: Tab) {
  if (tab === 'bought') return '아직 구매한 책이 없어용.'
  if (tab === 'holding') return '아직 보유한 책이 없어용.'
  return '아직 읽은 책이 없어용.'
}

function Cover({ book }: { book: Book }) {
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-border shadow-sm">
      {book.coverUrl ? (
        <img src={book.coverUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
          <ImageOff className="size-4" />
          <span className="px-1 text-center text-[11px] leading-tight">표지가 없어용</span>
        </span>
      )}
    </div>
  )
}

function Bookshelf({ books, onOpen }: { books: readonly Book[]; onOpen: (bookId: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(343)
  const [pulled, setPulled] = useState<{ book: Book; from: DOMRect } | null>(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const apply = () => setWidth(node.clientWidth)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const rows = packShelves(books, Math.max(160, width - 8))
  return (
    <div ref={ref} className="px-4 py-6">
      {rows.map((row, index) => (
        <div key={row[0]?.id ?? index} className="mb-7">
          <div className="flex items-end gap-1" style={row.length === 0 ? { minHeight: 96 } : undefined}>
            {row.map((book) => {
              const spine = spineOf(book)
              return (
                <button
                  key={book.id}
                  type="button"
                  className="relative shrink-0 overflow-hidden rounded-t-[2px] transition-opacity duration-200"
                  style={{
                    width: spine.width,
                    height: spine.height,
                    opacity: pulled?.book.id === book.id ? 0 : 1,
                  }}
                  onClick={(event) => setPulled({ book, from: event.currentTarget.getBoundingClientRect() })}
                  aria-label={book.title}
                >
                  <SpineFace book={book} />
                </button>
              )
            })}
          </div>
          <div className="h-2.5 rounded-b-sm bg-[#d7b48a] shadow-[0_5px_0_#b08968]" />
        </div>
      ))}
      {pulled ? (
        <PulledBook
          book={pulled.book}
          from={pulled.from}
          onClose={() => setPulled(null)}
          onOpen={() => onOpen(pulled.book.id)}
        />
      ) : null}
    </div>
  )
}

function PulledBook({
  book,
  from,
  onClose,
  onOpen,
}: {
  book: Book
  from: DOMRect
  onClose: () => void
  onOpen: () => void
}) {
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [open, setOpen] = useState(reduced.current)
  const [closing, setClosing] = useState(false)
  const coverW = Math.min(220, window.innerWidth - 80)
  const coverH = Math.round(coverW * 1.5)
  const endX = (window.innerWidth - coverW) / 2
  const endY = Math.max(72, (window.innerHeight - coverH) / 2 - 48)
  const shown = open && !closing
  const pose = shown
    ? { x: endX, y: endY, sx: 1, sy: 1, rot: 180 }
    : {
        x: from.left + from.width / 2 - coverW / 2,
        y: from.top + from.height / 2 - coverH / 2,
        sx: from.width / coverW,
        sy: from.height / coverH,
        rot: 0,
      }

  useLayoutEffect(() => {
    if (reduced.current) return
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(onClose, reduced.current ? 0 : 680)
    return () => window.clearTimeout(timer)
  }, [closing, onClose])

  function dismiss() {
    if (reduced.current) onClose()
    else setClosing(true)
  }

  const motion = reduced.current ? 'none' : 'transform 640ms cubic-bezier(0.22, 1, 0.36, 1)'

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={book.title}>
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/70 transition-opacity duration-300"
        style={{ opacity: shown ? 1 : 0 }}
        onClick={dismiss}
      />
      <button
        type="button"
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 grid size-11 place-items-center text-2xl text-white"
        aria-label="닫기"
        onClick={dismiss}
      >
        ×
      </button>
      <div className="pointer-events-none absolute inset-0" style={{ perspective: '1200px' }}>
        <div
          className="absolute"
          style={{
            width: coverW,
            height: coverH,
            transform: `translate3d(${pose.x}px, ${pose.y}px, 0) scale(${pose.sx}, ${pose.sy})`,
            transition: motion,
          }}
        >
          <div
            className="relative h-full w-full"
            style={{
              transform: `rotateY(${reduced.current ? 180 : pose.rot}deg)`,
              transformStyle: 'preserve-3d',
              WebkitTransformStyle: 'preserve-3d',
              transition: motion,
            }}
          >
            <div
              className="absolute inset-0 overflow-hidden rounded-sm shadow-lg"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            >
              <SpineFace book={book} />
            </div>
            <div
              className="absolute inset-0 overflow-hidden rounded-md border border-white/20 bg-muted shadow-2xl"
              style={{
                transform: 'rotateY(180deg)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              {book.coverUrl ? (
                <img src={book.coverUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                  <ImageOff className="size-6" />
                  <span className="text-sm font-bold text-foreground">{book.title}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        className="absolute inset-x-6 text-center text-white transition-opacity duration-300"
        style={{ top: endY + coverH + 16, opacity: shown ? 1 : 0 }}
      >
        <p className="text-[17px] font-bold">{book.title}</p>
        <p className="mt-1 text-[14px] text-white/75">{book.author || '저자 미상'}</p>
        <button type="button" className="mt-3 text-[14px] font-bold text-x" onClick={onOpen}>
          자세히 보기
        </button>
      </div>
    </div>
  )
}

function packShelves(books: readonly Book[], inner: number): Book[][] {
  const rows: Book[][] = []
  let row: Book[] = []
  let used = 0
  for (const book of books) {
    const width = spineOf(book).width
    const next = used + (row.length ? 4 : 0) + width
    if (row.length > 0 && next > inner) {
      rows.push(row)
      row = []
      used = 0
    }
    row.push(book)
    used += (row.length > 1 ? 4 : 0) + width
  }
  if (row.length) rows.push(row)
  while (rows.length < 3) rows.push([])
  return rows
}

function spineOf(book: Book) {
  const seed = hash(book.id)
  const pages = book.pages && book.pages > 0 ? book.pages : 220 + (seed % 180)
  const width = Math.round(Math.min(48, Math.max(18, pages / 16)))
  const height = 128 + (hash(book.title) % 40)
  const color = SPINE_COLORS[seed % SPINE_COLORS.length]
  return { width, height, color, ink: inkFor(color) }
}

const coverTones = new Map<string, string>()

function SpineFace({ book }: { book: Book }) {
  const base = spineOf(book)
  const tone = useCoverTone(book.coverUrl, base.color)
  const ink = inkFor(tone)
  const thin = base.width < 26
  return (
    <span className="absolute inset-0" style={{ backgroundColor: tone, color: ink }}>
      {book.coverUrl ? (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${book.coverUrl.replace(/["\\)]/g, '')}")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'auto 118%',
            backgroundPosition: 'left center',
            filter: 'blur(0.4px) saturate(1.08)',
            transform: 'scaleX(1.35)',
          }}
        />
      ) : null}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(255,255,255,0.14) 20%, rgba(0,0,0,0.06) 52%, rgba(0,0,0,0.38) 100%)',
        }}
      />
      <span aria-hidden className="absolute inset-x-0 top-0 h-[5px] bg-black/30" />
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[6px] bg-black/40" />
      <span className="absolute inset-0 flex flex-col items-center justify-between py-2">
        <span className={`max-h-[52%] overflow-hidden font-bold leading-none [writing-mode:vertical-rl] ${thin ? 'text-[9px]' : 'text-[11px]'}`}>
          {book.title}
        </span>
        <span className="max-h-[22%] overflow-hidden text-[8px] leading-none opacity-85 [writing-mode:vertical-rl]">
          {book.author || '저자 미상'}
        </span>
        {book.publisher ? (
          <span className="max-h-[16%] overflow-hidden text-[7px] leading-none opacity-70 [writing-mode:vertical-rl]">{book.publisher}</span>
        ) : null}
      </span>
    </span>
  )
}

function useCoverTone(url: string | null, fallback: string) {
  const [tone, setTone] = useState(() => (url && coverTones.get(url)) || fallback)
  useEffect(() => {
    if (!url) return
    const cached = coverTones.get(url)
    if (cached) {
      setTone(cached)
      return
    }
    let cancel = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const sampled = sampleCover(image)
      if (!sampled) return
      coverTones.set(url, sampled)
      if (!cancel) setTone(sampled)
    }
    image.src = url
    return () => {
      cancel = true
    }
  }, [url, fallback])
  return tone
}

function sampleCover(image: HTMLImageElement): string | null {
  const canvas = document.createElement('canvas')
  const size = 12
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  let data: Uint8ClampedArray
  try {
    ctx.drawImage(image, 0, 0, size, size)
    data = ctx.getImageData(0, 0, size, size).data
  } catch {
    return null
  }
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 160) continue
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max > 246 && min > 236) continue
    if (max < 14) continue
    const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
    bucket.r += r
    bucket.g += g
    bucket.b += b
    bucket.n += 1
    buckets.set(key, bucket)
  }
  let best: { r: number; g: number; b: number; n: number } | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.n > best.n) best = bucket
  }
  if (!best || best.n < 3) return null
  return tuneColor(best.r / best.n, best.g / best.n, best.b / best.n)
}

function tuneColor(r: number, g: number, b: number) {
  const lum = (r * 299 + g * 587 + b * 114) / 1000
  const scale = lum > 190 ? 0.55 : lum < 40 ? 1.4 : 0.82
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n * scale)))
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`
}

function hash(value: string) {
  let n = 0
  for (const char of value) n = (n * 33 + (char.codePointAt(0) ?? 0)) >>> 0
  return n
}

function inkFor(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#1c1917' : '#fffaf3'
}
