import { useState } from 'react'
import { Check, ImageOff } from 'lucide-react'
import { averageRating, countReads } from '@/lib/model'
import { inkFor, paletteColor } from '@/lib/palette'
import { useShelf } from '@/lib/store'
import type { Book } from '@/lib/types'
import { StarRating } from '@/components/star-rating'
import { Button } from '@/components/ui/button'

export function BookCard({
  book,
  onEdit,
  onOpen,
}: {
  book: Book
  onEdit: (book: Book) => void
  onOpen?: (bookId: string) => void
}) {
  const shelf = useShelf()
  const [brokenCover, setBrokenCover] = useState(false)
  const [picking, setPicking] = useState(false)
  const friends = shelf.data.friends
  const readCount = countReads(
    shelf.data.reads,
    book.id,
    friends.map((friend) => friend.id),
  )
  const buyer = friends.find((friend) => friend.id === book.buyerId)
  const readerId = shelf.data.reading[book.id]
  const reader = friends.find((friend) => friend.id === readerId)
  const readerSwatch = reader ? paletteColor(reader.color) : null
  const average = averageRating(shelf.data.reviews.filter((review) => review.bookId === book.id))

  return (
    <article
      className={`rounded-3xl border bg-card p-3 shadow-[0_18px_40px_-28px_rgba(70,42,18,0.65)] sm:p-4 ${onOpen ? 'cursor-pointer' : ''}`}
      onClick={(event) => {
        if (!onOpen) return
        const target = event.target
        if (target instanceof Element && target.closest('button, a, input, textarea, label')) return
        onOpen(book.id)
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            data-testid="book-title"
            className="font-serif text-[1.45rem] leading-tight font-bold tracking-tight text-balance"
          >
            {book.title}
          </h2>
          <p className="mt-1.5 inline-flex max-w-full rounded-full border px-3 py-1 text-sm text-muted-foreground">
            <span className="truncate">{book.author || '저자 미상'}</span>
          </p>
          {average !== null ? (
            <div className="mt-2">
              <StarRating value={average} readOnly size="sm" />
            </div>
          ) : null}
          {onOpen ? <p className="mt-2 text-sm font-medium text-primary">한줄평 보기</p> : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 px-3 text-base"
          onClick={() => onEdit(book)}
        >
          수정
        </Button>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className="w-[6.75rem] shrink-0 sm:w-32">
          {book.coverUrl && !brokenCover ? (
            <img
              src={book.coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="aspect-[2/3] w-full rounded-xl object-cover shadow-md"
              onError={() => setBrokenCover(true)}
            />
          ) : (
            <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-xl border bg-secondary text-muted-foreground shadow-inner">
              <ImageOff className="size-5" />
              <span className="px-2 text-center text-[11px] leading-tight">표지 없음</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground">읽은 사람</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {readCount}/{friends.length}
            </p>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${friends.length}명 중 ${readCount}명이 읽음`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: friends.length ? `${(readCount / friends.length) * 100}%` : '0%' }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {friends.map((friend) => {
              const checked = Boolean(shelf.data.reads[book.id]?.[friend.id])
              const swatch = paletteColor(friend.color)
              return (
                <button
                  key={friend.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`${friend.name}, ${book.title}, ${checked ? '읽음. 다시 누르면 해제' : '아직 안 읽음'}`}
                  data-testid={`read-${book.id}-${friend.id}`}
                  onClick={() => void shelf.toggleRead(book.id, friend.id)}
                  className="inline-flex h-12 min-w-12 items-center justify-center gap-1 rounded-2xl border px-2.5 text-[15px] font-semibold active:scale-[0.97]"
                  style={
                    checked
                      ? { backgroundColor: swatch.hex, borderColor: swatch.hex, color: inkFor(swatch.hex) }
                      : undefined
                  }
                >
                  {checked ? <Check className="size-4" strokeWidth={3} /> : null}
                  {friend.name}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs font-medium text-muted-foreground">구매자</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
            {buyer ? (
              <>
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: paletteColor(buyer.color).hex }}
                />
                {buyer.name}
              </>
            ) : (
              <span className="font-normal text-muted-foreground">아직 없어요</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3">
        {reader && readerSwatch ? (
          <div
            className="flex h-12 overflow-hidden rounded-full"
            style={{ backgroundColor: readerSwatch.hex, color: inkFor(readerSwatch.hex) }}
            data-testid={`reading-${book.id}`}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 px-3 text-left"
              onClick={() => setPicking((open) => !open)}
              aria-expanded={picking}
            >
              <span className="text-xs font-medium opacity-90">지금 읽는 중</span>
              <span className="truncate text-base font-semibold">{reader.name}</span>
            </button>
            <button
              type="button"
              className="h-12 shrink-0 px-4 text-sm font-semibold underline-offset-2 hover:underline"
              onClick={() => {
                setPicking(false)
                void shelf.setReading(book.id, null)
              }}
            >
              해제
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center rounded-full border border-dashed text-sm font-medium text-muted-foreground"
            data-testid={`reading-${book.id}`}
            aria-expanded={picking}
            onClick={() => setPicking((open) => !open)}
          >
            읽는 중 표시
          </button>
        )}
        {picking ? (
          <div className="mt-2 rounded-2xl border bg-secondary/60 p-2">
            <p className="px-1 pb-1.5 text-xs text-muted-foreground">누가 읽고 있는지 눌러 주세요. 같은 이름을 다시 누르면 해제돼요.</p>
            <div className="flex flex-wrap gap-1.5">
              {friends.map((friend) => {
                const active = friend.id === readerId
                const swatch = paletteColor(friend.color)
                return (
                  <button
                    key={friend.id}
                    type="button"
                    className="inline-flex h-11 items-center rounded-full border px-3 text-sm font-semibold"
                    style={
                      active
                        ? { backgroundColor: swatch.hex, borderColor: swatch.hex, color: inkFor(swatch.hex) }
                        : undefined
                    }
                    onClick={() => {
                      setPicking(false)
                      void shelf.setReading(book.id, active ? null : friend.id)
                    }}
                  >
                    {friend.name}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}
