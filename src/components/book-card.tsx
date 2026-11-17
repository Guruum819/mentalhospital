import { useState } from 'react'
import { Check, ImageOff } from 'lucide-react'
import { averageRating, countReads } from '@/lib/model'
import { inkFor, paletteColor } from '@/lib/palette'
import { useShelf } from '@/lib/store'
import type { Book } from '@/lib/types'
import { Avatar } from '@/components/avatar-editor'
import { StarRating } from '@/components/star-rating'

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
      className={`border-b border-border px-4 py-3 ${onOpen ? 'cursor-pointer active:bg-muted/70' : ''}`}
      onClick={(event) => {
        if (!onOpen) return
        const target = event.target
        if (target instanceof Element && target.closest('button, a, input, textarea, label')) return
        onOpen(book.id)
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-[5.5rem] shrink-0">
          {book.coverUrl && !brokenCover ? (
            <img
              src={book.coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="aspect-[2/3] w-full rounded-md object-cover"
              onError={() => setBrokenCover(true)}
            />
          ) : (
            <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-1 rounded-md bg-muted text-muted-foreground">
              <ImageOff className="size-4" />
              <span className="px-1 text-center text-[11px] leading-tight">표지가 없어용</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 data-testid="book-title" className="min-w-0 text-[17px] leading-snug font-bold tracking-tight">
              {book.title}
            </h2>
            <button
              type="button"
              className="h-11 shrink-0 px-2 text-[15px] font-bold text-x"
              onClick={() => onEdit(book)}
            >
              수정
            </button>
          </div>
          <p className="truncate text-[15px] text-muted-foreground">{book.author || '저자 미상'}</p>
          {average !== null ? (
            <div className="mt-1">
              <StarRating value={average} readOnly size="sm" />
            </div>
          ) : null}
          <p className="mt-2 flex min-h-11 items-center gap-2 text-[15px]">
            {buyer ? (
              <>
                <Avatar name={buyer.name} photo={buyer.photo} size={24} />
                <span className="truncate font-semibold">{buyer.name}</span>
                <span className="text-muted-foreground">구매</span>
              </>
            ) : (
              <span className="text-muted-foreground">구매자가 없어용</span>
            )}
          </p>
          <p className="text-[13px] text-muted-foreground">
            읽음 {readCount}/{friends.length}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {friends.map((friend) => {
          const checked = Boolean(shelf.data.reads[book.id]?.[friend.id])
          const swatch = paletteColor(friend.color)
          return (
            <button
              key={friend.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-label={`${friend.name}, ${book.title}, ${checked ? '읽음. 다시 누르면 빠져용' : '아직 안 읽었어용'}`}
              data-testid={`read-${book.id}-${friend.id}`}
              onClick={() => void shelf.toggleRead(book.id, friend.id)}
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 text-[15px] font-bold"
              style={
                checked
                  ? { backgroundColor: swatch.hex, color: inkFor(swatch.hex) }
                  : { backgroundColor: 'transparent', color: swatch.hex, boxShadow: `inset 0 0 0 1px ${swatch.hex}` }
              }
            >
              {checked ? <Check className="size-4" strokeWidth={3} /> : null}
              {friend.name}
            </button>
          )
        })}
      </div>

      <div className="mt-2">
        {reader && readerSwatch ? (
          <div className="flex min-h-11 items-center gap-2" data-testid={`reading-${book.id}`}>
            <button
              type="button"
              className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-left text-[15px] font-bold"
              style={{ backgroundColor: readerSwatch.hex, color: inkFor(readerSwatch.hex) }}
              onClick={() => setPicking((open) => !open)}
              aria-expanded={picking}
            >
              <span className="shrink-0 text-[13px] font-medium opacity-90">읽는 중</span>
              <span className="truncate">{reader.name}</span>
            </button>
            <button
              type="button"
              className="h-11 shrink-0 rounded-full px-3 text-[15px] font-bold text-muted-foreground"
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
            className="flex h-11 w-full items-center justify-center rounded-full text-[15px] font-bold text-x ring-1 ring-inset ring-x/40"
            data-testid={`reading-${book.id}`}
            aria-expanded={picking}
            onClick={() => setPicking((open) => !open)}
          >
            읽는 중
          </button>
        )}
        {picking ? (
          <div className="mt-2 border-t border-border pt-2">
            <p className="pb-2 text-[13px] text-muted-foreground">누가 읽고 있는지 눌러 주세용.</p>
            <div className="flex flex-wrap gap-2">
              {friends.map((friend) => {
                const active = friend.id === readerId
                const swatch = paletteColor(friend.color)
                return (
                  <button
                    key={friend.id}
                    type="button"
                    className="inline-flex h-11 items-center rounded-full px-3 text-[15px] font-bold"
                    style={
                      active
                        ? { backgroundColor: swatch.hex, color: inkFor(swatch.hex) }
                        : { color: swatch.hex, boxShadow: `inset 0 0 0 1px ${swatch.hex}` }
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
