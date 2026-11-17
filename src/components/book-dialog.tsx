import { useEffect, useRef, useState, type RefObject } from 'react'
import { ImageOff, Loader2 } from 'lucide-react'
import { searchBooks, searchCovers, type BookHit } from '@/lib/book-search'
import { compressCover } from '@/lib/cover-image'
import { readWho } from '@/lib/identity'
import { useShelf } from '@/lib/store'
import type { Book } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const fieldClass = 'h-12 text-base'

export function BookDialog({
  open,
  book,
  onOpenChange,
}: {
  open: boolean
  book: Book | null
  onOpenChange: (open: boolean) => void
}) {
  const shelf = useShelf()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<BookHit[]>([])
  const [searching, setSearching] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [covers, setCovers] = useState<BookHit[]>([])
  const [coverBusy, setCoverBusy] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHits([])
    setWarning(null)
    setSearching(false)
    setManual(Boolean(book))
    setTitle(book?.title ?? '')
    setAuthor(book?.author ?? '')
    setCoverUrl(book?.coverUrl ?? null)
    setCovers([])
    setCoverBusy(false)
    setPendingId(null)
  }, [open, book])

  useEffect(() => {
    if (!open || book) return
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setSearching(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      void searchBooks(q, controller.signal)
        .then((outcome) => {
          setHits(outcome.hits)
          setWarning(outcome.warning)
          setSearching(false)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setHits([])
          setWarning('검색이 안 됐어용. 직접 입력해 주세용')
          setSearching(false)
          setManual(true)
        })
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, book, query])

  const buyerId = book?.buyerId || readWho() || ''

  async function createFrom(hit: { id?: string; title: string; author: string; coverUrl: string | null }) {
    if (pendingId) return
    setPendingId(hit.id ?? 'manual')
    const ok = await shelf.addBook({
      title: hit.title,
      author: hit.author,
      coverUrl: hit.coverUrl,
      buyerId,
    })
    setPendingId(null)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,100%)] w-full max-w-full flex-col gap-0 overflow-x-hidden p-0">
        <DialogHeader className="shrink-0 px-4 pt-3 pr-14">
          <DialogTitle>{book ? '책 수정' : '책 추가'}</DialogTitle>
          <DialogDescription>
            {book
              ? '제목, 저자, 표지를 고쳐용. 구매자는 이 책을 올린 사람이에용.'
              : '제목을 입력하면 표지랑 같이 목록이 나와용. 고르면 내가 구매자가 돼용.'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {book ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void shelf.updateBook(book.id, { title, author, coverUrl, buyerId: book.buyerId }).then((ok) => {
                  if (ok) onOpenChange(false)
                })
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">제목</Label>
                <Input id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-author">저자</Label>
                <Input id="edit-author" value={author} onChange={(event) => setAuthor(event.target.value)} className={fieldClass} />
              </div>
              <CoverEditor
                title={title}
                coverUrl={coverUrl}
                covers={covers}
                busy={coverBusy}
                fileRef={fileRef}
                onCover={setCoverUrl}
                onSearch={() => {
                  const q = title.trim()
                  if (q.length < 2) return
                  const controller = new AbortController()
                  setCoverBusy(true)
                  void searchCovers(q, controller.signal)
                    .then((next) => {
                      setCovers(next)
                      setCoverBusy(false)
                    })
                    .catch(() => {
                      if (controller.signal.aborted) return
                      setCovers([])
                      setCoverBusy(false)
                    })
                }}
                onFile={async (file) => {
                  if (!file) return
                  setCoverBusy(true)
                  try {
                    setCoverUrl(await compressCover(file))
                  } catch {
                    setWarning('이 사진은 올리지 못했어용. 다른 사진을 골라 주세용.')
                  } finally {
                    setCoverBusy(false)
                  }
                }}
              />
              {warning ? <p className="text-sm text-destructive">{warning}</p> : null}
              <Button type="submit" className="h-12 w-full text-base">저장</Button>
            </form>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="book-query">제목</Label>
                <Input
                  id="book-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="예: 작별하지 않는다"
                  className={fieldClass}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              {searching ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> 찾는 중
                </p>
              ) : null}
              {warning ? <p className="text-sm text-muted-foreground">{warning}</p> : null}
              {query.trim().length >= 2 && !searching && hits.length === 0 ? (
                <p className="text-sm text-muted-foreground">맞는 책이 없어용. 직접 입력해 주세용.</p>
              ) : null}
              <div className="space-y-1.5">
                {hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    disabled={pendingId !== null}
                    onClick={() => void createFrom(hit)}
                    className="flex min-h-14 w-full items-center gap-3 border-b border-border py-2 text-left disabled:opacity-60"
                  >
                    {hit.coverUrl ? (
                      <img src={hit.coverUrl} alt="" referrerPolicy="no-referrer" className="h-14 w-10 rounded-md object-cover" />
                    ) : (
                      <span className="grid h-14 w-10 place-items-center rounded-md bg-secondary text-[10px] text-muted-foreground">표지</span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{hit.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">{hit.author || '저자 미상'}</span>
                    </span>
                  </button>
                ))}
              </div>
              {manual ? (
                <form
                  className="space-y-3 border-t pt-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void createFrom({ title, author, coverUrl: null })
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-title">직접 입력한 제목</Label>
                    <Input id="manual-title" value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-author">저자</Label>
                    <Input id="manual-author" value={author} onChange={(event) => setAuthor(event.target.value)} className={fieldClass} />
                  </div>
                  <Button type="submit" className="h-12 w-full text-base" disabled={pendingId !== null}>
                    올리기
                  </Button>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full text-base"
                  data-testid="manual-entry"
                  onClick={() => {
                    setManual(true)
                    setTitle((current) => (current.trim() ? current : query.trim()))
                  }}
                >
                  직접 입력
                </Button>
              )}
            </>
          )}
        </div>
        <DialogFooter className="shrink-0 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" className="h-12 text-base" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CoverEditor({
  title,
  coverUrl,
  covers,
  busy,
  fileRef,
  onCover,
  onSearch,
  onFile,
}: {
  title: string
  coverUrl: string | null
  covers: BookHit[]
  busy: boolean
  fileRef: RefObject<HTMLInputElement | null>
  onCover: (url: string | null) => void
  onSearch: () => void
  onFile: (file: File | undefined) => void
}) {
  return (
    <div className="space-y-2">
      <Label>표지</Label>
      <div className="flex items-start gap-3">
        {coverUrl ? (
          <img src={coverUrl} alt="" referrerPolicy="no-referrer" className="h-24 w-16 rounded-md object-cover" />
        ) : (
          <span className="grid h-24 w-16 place-items-center rounded-md bg-muted text-muted-foreground">
            <ImageOff className="size-4" />
          </span>
        )}
        <div className="grid min-w-0 flex-1 gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={busy || title.trim().length < 2} onClick={onSearch}>
            {busy ? '찾는 중' : '표지 찾기'}
          </Button>
          <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => fileRef.current?.click()}>
            앨범에서 올리기
          </Button>
          <Button type="button" variant="outline" className="h-11" disabled={!coverUrl} onClick={() => onCover(null)}>
            표지 없애기
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              onFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
      </div>
      {covers.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {covers.map((hit) => (
            <button
              key={hit.coverUrl}
              type="button"
              className={`overflow-hidden rounded-md ring-offset-2 ${coverUrl === hit.coverUrl ? 'ring-2 ring-foreground' : ''}`}
              onClick={() => onCover(hit.coverUrl)}
            >
              <img src={hit.coverUrl ?? ''} alt={hit.title} referrerPolicy="no-referrer" className="aspect-[2/3] w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
