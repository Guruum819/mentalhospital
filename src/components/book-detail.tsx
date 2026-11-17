import { useState, type FormEvent } from 'react'
import { ChevronLeft } from 'lucide-react'
import { averageRating, MAX_REVIEW } from '@/lib/model'
import { useShelf } from '@/lib/store'
import type { Book, Friend } from '@/lib/types'
import { Avatar } from '@/components/avatar-editor'
import { BookCard } from '@/components/book-card'
import { StarRating } from '@/components/star-rating'
import { Button } from '@/components/ui/button'

export function BookDetail({
  book,
  me,
  onBack,
  onEdit,
}: {
  book: Book
  me: Friend
  onBack: () => void
  onEdit: (book: Book) => void
}) {
  const shelf = useShelf()
  const [text, setText] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const reviews = shelf.data.reviews.filter((review) => review.bookId === book.id)
  const average = averageRating(reviews)
  const chars = Array.from(text).length

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending || !text.trim() || chars > MAX_REVIEW || rating === null) return
    setPending(true)
    const ok = await shelf.addReview(book.id, me.id, text, rating)
    setPending(false)
    if (ok) {
      setText('')
      setRating(null)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="relative flex h-14 items-center">
          <button type="button" className="grid size-11 place-items-center" onClick={onBack} aria-label="서재로">
            <ChevronLeft className="size-6" />
          </button>
          <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-[17px] font-bold">한줄평</h1>
        </div>
      </header>
      <BookCard book={book} onEdit={onEdit} />
      <section>
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-[17px] font-bold">한줄평</h2>
          {average !== null ? <StarRating value={average} readOnly size="sm" /> : null}
        </div>
        <form onSubmit={onSubmit} className="border-b border-border px-4 py-3">
          <StarRating value={rating} onChange={setRating} />
          {rating === null ? <p className="mt-1 text-[13px] text-muted-foreground">별을 누르거나 숫자를 입력해 주세용. 0.5 단위예용.</p> : null}
          <div className="mt-3 flex gap-3">
            <Avatar name={me.name} photo={me.photo} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">{me.name}</p>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={MAX_REVIEW}
                rows={3}
                placeholder="짧게 남겨 주세용"
                className="mt-1 w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[13px] tabular-nums text-muted-foreground">
              {chars}/{MAX_REVIEW}
            </p>
            <Button type="submit" className="h-9 bg-x px-4 text-white hover:bg-x/90" disabled={pending || !text.trim() || chars > MAX_REVIEW || rating === null}>
              올리기
            </Button>
          </div>
        </form>
        {reviews.length === 0 ? (
          <p className="px-4 py-8 text-[15px] text-muted-foreground">아직 한줄평이 없어용.</p>
        ) : (
          <ul>
            {reviews.map((review) => {
              const author = shelf.data.friends.find((friend) => friend.id === review.friendId)
              return (
                <li key={review.id} className="flex gap-3 border-b border-border px-4 py-3">
                  <Avatar name={author?.name ?? '?'} photo={author?.photo ?? null} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="truncate text-[15px] font-bold">{author?.name ?? '알 수 없어용'}</p>
                      <time className="shrink-0 text-[13px] text-muted-foreground">
                        {new Intl.DateTimeFormat('ko', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(review.createdAt)}
                      </time>
                    </div>
                    <StarRating value={review.rating} readOnly size="sm" />
                    <p className="mt-1 text-[15px] leading-snug whitespace-pre-wrap">{review.text}</p>
                    {review.friendId === me.id ? (
                      <button
                        type="button"
                        className="mt-1 h-11 text-[15px] font-medium text-muted-foreground"
                        onClick={() => void shelf.deleteReview(review.id)}
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
