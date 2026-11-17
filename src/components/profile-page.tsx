import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { paletteColor } from '@/lib/palette'
import { useShelf } from '@/lib/store'
import type { Friend } from '@/lib/types'
import { Avatar } from '@/components/avatar-editor'
import { StarRating } from '@/components/star-rating'
import { Button } from '@/components/ui/button'

export function ProfilePage({
  friend,
  mine,
  onBack,
  onEdit,
  onOpenBook,
}: {
  friend: Friend
  mine: boolean
  onBack: () => void
  onEdit: () => void
  onOpenBook: (bookId: string) => void
}) {
  const shelf = useShelf()
  const [tab, setTab] = useState<'books' | 'comments'>('books')
  const accent = paletteColor(friend.color).hex
  const readBooks = shelf.data.books.filter((book) => shelf.data.reads[book.id]?.[friend.id])
  const comments = shelf.data.reviews
    .filter((review) => review.friendId === friend.id)
    .sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="relative flex h-14 items-center">
          <button type="button" className="grid size-11 place-items-center" onClick={onBack} aria-label="뒤로">
            <ChevronLeft className="size-6" />
          </button>
          <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-[17px] font-bold">{friend.name}</h1>
        </div>
      </header>
      <div className="h-24" style={{ backgroundColor: accent }} />
      <div className="px-4">
        <div className="-mt-10 w-fit rounded-full bg-background p-1">
          <Avatar name={friend.name} photo={friend.photo} size={80} />
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold tracking-tight">{friend.name}</h2>
            <p className="text-[15px] text-muted-foreground">
              읽은 책 {readBooks.length} · 코멘트 {comments.length}
            </p>
          </div>
          {mine ? (
            <Button type="button" variant="outline" className="h-9 shrink-0 px-4" onClick={onEdit}>
              프로필 수정
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex border-b border-border" role="tablist">
        {(
          [
            ['books', '읽은 책'],
            ['comments', '코멘트'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`h-12 flex-1 text-[15px] font-bold ${tab === id ? 'border-b-2 border-x text-x' : 'text-muted-foreground'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'books' ? (
        <ul>
          {readBooks.length === 0 ? (
            <li className="px-4 py-8 text-[15px] text-muted-foreground">아직 읽은 책이 없어용.</li>
          ) : (
            readBooks.map((book) => (
              <li key={book.id} className="border-b border-border">
                <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => onOpenBook(book.id)}>
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" referrerPolicy="no-referrer" className="h-16 w-11 rounded-md object-cover" />
                  ) : (
                    <span className="grid h-16 w-11 place-items-center rounded-md bg-muted text-[10px] text-muted-foreground">표지</span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold">{book.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">{book.author || '저자 미상'}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : (
        <ul>
          {comments.length === 0 ? (
            <li className="px-4 py-8 text-[15px] text-muted-foreground">아직 코멘트가 없어용.</li>
          ) : (
            comments.map((review) => {
              const book = shelf.data.books.find((item) => item.id === review.bookId)
              return (
                <li key={review.id} className="border-b border-border">
                  <button type="button" className="flex w-full gap-3 px-4 py-3 text-left" onClick={() => book && onOpenBook(book.id)}>
                    <Avatar name={friend.name} photo={friend.photo} size={40} />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold">
                        {friend.name}
                        {review.parentId ? <span className="ml-2 text-[13px] font-medium text-muted-foreground">답글</span> : null}
                        {review.editedAt ? <span className="ml-2 text-[13px] font-medium text-muted-foreground">수정됨</span> : null}
                      </span>
                      {review.rating !== null ? <StarRating value={review.rating} readOnly size="sm" /> : null}
                      <span className="block truncate text-[15px] font-bold text-x">{book?.title ?? '알 수 없는 책'}</span>
                      <span className="mt-1 block text-[15px] leading-snug whitespace-pre-wrap">{review.text}</span>
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
