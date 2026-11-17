import { useState, type FormEvent } from 'react'
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
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 sm:px-5">
      <Button type="button" variant="outline" className="h-11 w-fit px-3" onClick={onBack}>
        서재로
      </Button>
      <div className="mt-3">
        <BookCard book={book} onEdit={onEdit} />
      </div>
      <section className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">한줄평</h2>
          {average !== null ? <StarRating value={average} readOnly size="sm" /> : null}
        </div>
        <form onSubmit={onSubmit} className="mt-3 rounded-3xl border bg-card p-3">
          <StarRating value={rating} onChange={setRating} />
          {rating === null ? <p className="mt-1 text-xs text-muted-foreground">별을 누르거나 숫자를 입력해요. 0.5 단위예요.</p> : null}
          <div className="mt-3 flex gap-3">
            <Avatar name={me.name} photo={me.photo} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{me.name}</p>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={MAX_REVIEW}
                rows={3}
                placeholder="짧게 남겨 주세요"
                className="mt-1 w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs tabular-nums text-muted-foreground">
              {chars}/{MAX_REVIEW}
            </p>
            <Button type="submit" className="h-11 px-4" disabled={pending || !text.trim() || chars > MAX_REVIEW || rating === null}>
              올리기
            </Button>
          </div>
        </form>
        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">아직 한줄평이 없어요.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {reviews.map((review) => {
              const author = shelf.data.friends.find((friend) => friend.id === review.friendId)
              return (
                <li key={review.id} className="flex gap-3 py-3">
                  <Avatar name={author?.name ?? '?'} photo={author?.photo ?? null} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{author?.name ?? '알 수 없음'}</p>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat('ko', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(review.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 text-[15px] leading-snug whitespace-pre-wrap">{review.text}</p>
                    {review.friendId === me.id ? (
                      <button
                        type="button"
                        className="mt-1 text-sm text-muted-foreground underline"
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
