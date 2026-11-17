import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { searchBooks, type BookHit } from '@/lib/book-search'
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
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHits([])
    setWarning(null)
    setSearching(false)
    setManual(Boolean(book))
    setTitle(book?.title ?? '')
    setAuthor(book?.author ?? '')
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
          setWarning('검색이 되지 않았어요. 직접 입력해 주세요.')
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
      <DialogContent className="flex max-h-[92dvh] w-full flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="px-4 pt-4 pr-12">
          <DialogTitle className="font-serif text-xl">{book ? '책 수정' : '책 추가'}</DialogTitle>
          <DialogDescription>
            {book
              ? '제목과 저자를 고칩니다. 구매자는 이 책을 올린 사람이에요.'
              : '제목을 입력하면 표지와 함께 목록이 나와요. 고르면 내가 구매자로 올라갑니다.'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {book ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void shelf.updateBook(book.id, { title, author, coverUrl: book.coverUrl, buyerId: book.buyerId }).then((ok) => {
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
                <p className="text-sm text-muted-foreground">맞는 책이 없어요. 직접 입력해 주세요.</p>
              ) : null}
              <div className="space-y-1.5">
                {hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    disabled={pendingId !== null}
                    onClick={() => void createFrom(hit)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-card px-2 py-2 text-left active:scale-[0.99] disabled:opacity-60"
                  >
                    {hit.coverUrl ? (
                      <img src={hit.coverUrl} alt="" referrerPolicy="no-referrer" className="h-14 w-10 rounded-md object-cover" />
                    ) : (
                      <span className="grid h-14 w-10 place-items-center rounded-md bg-secondary text-[10px] text-muted-foreground">표지</span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{hit.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">{hit.author || '저자 정보 없음'}</span>
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
                    이 책 올리기
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
                  검색 없이 직접 입력
                </Button>
              )}
            </>
          )}
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none">
          <Button type="button" variant="outline" className="h-12 text-base" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
