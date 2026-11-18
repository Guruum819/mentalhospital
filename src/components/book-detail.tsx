import { useState, type FormEvent } from 'react'
import { ChevronLeft, Heart } from 'lucide-react'
import { averageRating, MAX_REVIEW, sortedComments, topLevelReviews } from '@/lib/model'
import { useShelf } from '@/lib/store'
import type { Book, CommentSort, Friend, Review } from '@/lib/types'
import { Avatar } from '@/components/avatar-editor'
import { BookCard, BookMenu } from '@/components/book-card'
import { EdgeBack } from '@/components/edge-back'
import { StarRating } from '@/components/star-rating'
import { Button } from '@/components/ui/button'

export function BookDetail({
  book,
  me,
  onBack,
  onEdit,
  onDelete,
  onOpenFriend,
}: {
  book: Book
  me: Friend
  onBack: () => void
  onEdit: (book: Book) => void
  onDelete: (book: Book) => void
  onOpenFriend: (friendId: string) => void
}) {
  const shelf = useShelf()
  const [text, setText] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [sort, setSort] = useState<CommentSort>('new')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [openThreads, setOpenThreads] = useState<ReadonlySet<string>>(() => new Set())
  const reviews = topLevelReviews(shelf.data.reviews, book.id)
  const ordered = sortedComments(reviews, sort)
  const average = averageRating(reviews)
  const chars = Array.from(text).length
  const hasRead = Boolean(shelf.data.reads[book.id]?.[me.id])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!hasRead || pending || !text.trim() || chars > MAX_REVIEW || rating === null) return
    setPending(true)
    const ok = await shelf.addReview(book.id, me.id, text, rating)
    setPending(false)
    if (ok) {
      setText('')
      setRating(null)
    }
  }

  async function sendReply(parentId: string) {
    if (pending || !replyText.trim()) return
    setPending(true)
    const ok = await shelf.addReply(parentId, replyText)
    setPending(false)
    if (ok) {
      setReplyText('')
      setReplyTo(null)
    }
  }

  async function saveEdit(reviewId: string) {
    if (pending || !editText.trim()) return
    setPending(true)
    const ok = await shelf.updateReview(reviewId, editText)
    setPending(false)
    if (ok) setEditingId(null)
  }

  return (
    <EdgeBack onBack={onBack}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
          <div className="relative flex h-14 items-center">
            <button type="button" className="grid size-11 place-items-center" onClick={onBack} aria-label="서재로">
              <ChevronLeft className="size-6" />
            </button>
            <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-[17px] font-bold">한 줄 평</h1>
            {book.buyerId === me.id ? (
              <span className="relative z-10 ml-auto">
                <BookMenu canDelete onEdit={() => onEdit(book)} onDelete={() => onDelete(book)} />
              </span>
            ) : (
              <span className="ml-auto size-11" />
            )}
          </div>
        </header>
        <BookCard book={book} meId={me.id} onEdit={onEdit} onDelete={onDelete} onOpenFriend={onOpenFriend} />
        <HandoffHistory bookId={book.id} meId={me.id} />
        <section>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-[17px] font-bold">한 줄 평</h2>
            <div className="flex items-center gap-3">
              {average !== null ? <StarRating value={average} readOnly size="sm" /> : null}
              <SortPills
                value={sort}
                options={[
                  ['new', '최신순'],
                  ['likes', '추천순'],
                ]}
                onChange={setSort}
              />
            </div>
          </div>
          <form onSubmit={onSubmit} className="border-b border-border px-4 py-3">
            <fieldset disabled={!hasRead} className="min-w-0 border-0 p-0 disabled:opacity-60">
              <StarRating value={hasRead ? rating : null} onChange={hasRead ? setRating : undefined} readOnly={!hasRead} />
              {hasRead ? (
                rating === null ? <p className="mt-1 text-[13px] text-muted-foreground">별을 누르거나 숫자를 입력해 주세용. 0.5 단위예용.</p> : null
              ) : (
                <p className="mt-1 text-[15px] text-muted-foreground">이 책을 읽고 나면 코멘트를 달 수 있어용.</p>
              )}
              <div className="mt-3 flex gap-3">
                <Avatar name={me.name} photo={me.photo} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">{me.name}</p>
                  <textarea
                    value={hasRead ? text : ''}
                    onChange={(event) => setText(event.target.value)}
                    maxLength={MAX_REVIEW}
                    rows={3}
                    placeholder="짧게 남겨 주세용"
                    disabled={!hasRead}
                    className="mt-1 w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[13px] tabular-nums text-muted-foreground">
                  {hasRead ? `${chars}/${MAX_REVIEW}` : `0/${MAX_REVIEW}`}
                </p>
                <Button type="submit" className="h-9 bg-x px-4 text-x-ink hover:bg-x/90" disabled={!hasRead || pending || !text.trim() || chars > MAX_REVIEW || rating === null}>
                  올리기
                </Button>
              </div>
            </fieldset>
          </form>
          {ordered.length === 0 ? (
            <p className="px-4 py-8 text-[15px] text-muted-foreground">아직 한 줄 평이 없어용.</p>
          ) : (
            <ul>
              {ordered.map((review) => (
                <CommentItem
                  key={review.id}
                  review={review}
                  depth={0}
                  me={me}
                  openThreads={openThreads}
                  replyTo={replyTo}
                  replyText={replyTo === review.id ? replyText : ''}
                  editingId={editingId}
                  editText={editingId ? editText : ''}
                  pending={pending}
                  onOpenFriend={onOpenFriend}
                  onLike={(id) => void shelf.toggleLike(id)}
                  onDelete={(id) => void shelf.deleteReview(id)}
                  onStartEdit={(item) => {
                    setEditingId(item.id)
                    setEditText(item.text)
                    setReplyTo(null)
                  }}
                  onEditText={setEditText}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={(id) => void saveEdit(id)}
                  onToggleReply={(id) => {
                    setReplyTo((current) => (current === id ? null : id))
                    setReplyText('')
                    setEditingId(null)
                  }}
                  onReplyText={setReplyText}
                  onSendReply={(id) => void sendReply(id)}
                  onToggleThread={(id) => {
                    setOpenThreads((current) => {
                      const next = new Set(current)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </EdgeBack>
  )
}

function SortPills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex gap-2" role="tablist">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={`h-8 text-[13px] font-bold ${value === id ? 'text-x underline decoration-x decoration-2 underline-offset-4' : 'text-muted-foreground'}`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const INDENT_CAP = 3

function descendantCount(reviews: readonly Review[], id: string): number {
  const children = reviews.filter((review) => review.parentId === id)
  return children.reduce((total, child) => total + 1 + descendantCount(reviews, child.id), 0)
}

function CommentItem({
  review,
  depth,
  parentName,
  me,
  openThreads,
  replyTo,
  replyText,
  editingId,
  editText,
  pending,
  onOpenFriend,
  onLike,
  onDelete,
  onStartEdit,
  onEditText,
  onCancelEdit,
  onSaveEdit,
  onToggleReply,
  onReplyText,
  onSendReply,
  onToggleThread,
}: {
  review: Review
  depth: number
  parentName?: string
  me: Friend
  openThreads: ReadonlySet<string>
  replyTo: string | null
  replyText: string
  editingId: string | null
  editText: string
  pending: boolean
  onOpenFriend: (friendId: string) => void
  onLike: (id: string) => void
  onDelete: (id: string) => void
  onStartEdit: (review: Review) => void
  onEditText: (value: string) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string) => void
  onToggleReply: (id: string) => void
  onReplyText: (value: string) => void
  onSendReply: (id: string) => void
  onToggleThread: (id: string) => void
}) {
  const shelf = useShelf()
  const author = shelf.data.friends.find((friend) => friend.id === review.friendId)
  const liked = review.likes.includes(me.id)
  const mine = review.friendId === me.id
  const editing = editingId === review.id
  const deleted = review.deleted === true
  const replyOpen = replyTo === review.id
  const children = shelf.data.reviews
    .filter((item) => item.parentId === review.id)
    .sort((a, b) => a.createdAt - b.createdAt)
  const hiddenCount = descendantCount(shelf.data.reviews, review.id)
  const foldable = depth === INDENT_CAP && hiddenCount > 0
  const collapsed = foldable && !openThreads.has(review.id)
  const mention = depth > INDENT_CAP ? parentName : undefined

  return (
    <li className={depth === 0 ? 'border-b border-border' : ''}>
      <div className="flex gap-3 px-4 py-3">
        <button type="button" className="shrink-0" onClick={() => author && onOpenFriend(author.id)} aria-label={`${author?.name ?? '친구'} 프로필`} disabled={deleted}>
          <Avatar name={deleted ? '삭' : (author?.name ?? '?')} photo={deleted ? null : (author?.photo ?? null)} size={depth === 0 ? 40 : 32} />
        </button>
        <div className="min-w-0 flex-1">
          {deleted ? (
            <p className="text-[15px] text-muted-foreground">삭제된 댓글이에용</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <button type="button" className="truncate text-[15px] font-bold" onClick={() => author && onOpenFriend(author.id)}>
                  {author?.name ?? '알 수 없어용'}
                </button>
                <time className="shrink-0 text-[13px] text-muted-foreground">{formatTime(review.createdAt)}</time>
                {review.editedAt ? <span className="shrink-0 text-[13px] text-muted-foreground">수정됨</span> : null}
              </div>
              {review.rating !== null && depth === 0 ? <StarRating value={review.rating} readOnly size="sm" /> : null}
              {editing ? (
                <form
                  className="mt-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    onSaveEdit(review.id)
                  }}
                >
                  <textarea
                    value={editText}
                    onChange={(event) => onEditText(event.target.value)}
                    maxLength={MAX_REVIEW}
                    rows={3}
                    className="w-full resize-none bg-transparent text-[15px] outline-none"
                  />
                  <div className="mt-1 flex gap-3">
                    <button type="submit" className="h-11 text-[15px] font-bold" disabled={pending || !editText.trim()}>
                      저장
                    </button>
                    <button type="button" className="h-11 text-[15px] text-muted-foreground" onClick={onCancelEdit}>
                      취소
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mt-1 text-[15px] leading-snug whitespace-pre-wrap">
                  {mention ? <span className="font-bold text-x">@{mention} </span> : null}
                  {review.text}
                </p>
              )}
              <div className="mt-1 flex items-center gap-1">
                <button
                  type="button"
                  className={`inline-flex h-11 items-center gap-1 px-1 text-[15px] font-medium ${liked ? 'text-foreground' : 'text-muted-foreground'}`}
                  aria-pressed={liked}
                  aria-label={liked ? '좋아요 취소' : '좋아요'}
                  onClick={() => onLike(review.id)}
                >
                  <Heart className={`size-4 ${liked ? 'fill-current' : ''}`} />
                  {review.likes.length > 0 ? <span className="tabular-nums">{review.likes.length}</span> : null}
                </button>
                <button type="button" className="h-11 px-2 text-[15px] font-medium text-muted-foreground" onClick={() => onToggleReply(review.id)}>
                  답글
                </button>
                {mine && !editing ? (
                  <button type="button" className="h-11 px-2 text-[15px] font-medium text-muted-foreground" onClick={() => onStartEdit(review)}>
                    수정
                  </button>
                ) : null}
                {mine ? (
                  <button type="button" className="h-11 px-2 text-[15px] font-medium text-muted-foreground" onClick={() => onDelete(review.id)}>
                    삭제
                  </button>
                ) : null}
              </div>
              {replyOpen ? (
                <form
                  className="mt-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    onSendReply(review.id)
                  }}
                >
                  <textarea
                    value={replyText}
                    onChange={(event) => onReplyText(event.target.value)}
                    maxLength={MAX_REVIEW}
                    rows={2}
                    placeholder="답글을 남겨 주세용"
                    className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] tabular-nums text-muted-foreground">
                      {Array.from(replyText).length}/{MAX_REVIEW}
                    </p>
                    <Button type="submit" className="h-9 bg-x px-4 text-x-ink hover:bg-x/90" disabled={pending || !replyText.trim()}>
                      답글
                    </Button>
                  </div>
                </form>
              ) : null}
            </>
          )}
          {foldable ? (
            <button type="button" className="mt-1 h-9 text-[13px] font-bold text-x" onClick={() => onToggleThread(review.id)}>
              {collapsed ? `⌄ 답글 ${hiddenCount}개 자세히 보기` : '⌃ 접기'}
            </button>
          ) : null}
        </div>
      </div>
      {!collapsed && children.length > 0 ? (
        <ul className={depth < INDENT_CAP ? 'ml-8 border-l border-border' : ''}>
          {children.map((reply) => (
            <CommentItem
              key={reply.id}
              review={reply}
              depth={depth + 1}
              parentName={author?.name ?? '친구'}
              me={me}
              openThreads={openThreads}
              replyTo={replyTo}
              replyText={replyText}
              editingId={editingId}
              editText={editText}
              pending={pending}
              onOpenFriend={onOpenFriend}
              onLike={onLike}
              onDelete={onDelete}
              onStartEdit={onStartEdit}
              onEditText={onEditText}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onToggleReply={onToggleReply}
              onReplyText={onReplyText}
              onSendReply={onSendReply}
              onToggleThread={onToggleThread}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function HandoffHistory({ bookId, meId }: { bookId: string; meId: string }) {
  const shelf = useShelf()
  const events = (shelf.data.handoffs[bookId] ?? []).slice(0, 8)
  if (events.length === 0) return null
  return (
    <section className="border-b border-border px-4 py-3">
      <h2 className="text-[15px] font-bold">넘긴 기록</h2>
      <ul className="mt-2 space-y-2">
        {events.map((event) => {
          const from = shelf.data.friends.find((friend) => friend.id === event.fromId)
          const to = shelf.data.friends.find((friend) => friend.id === event.toId)
          const fromName = event.fromId === meId ? '나' : (from?.name ?? '친구')
          const toName = event.toId === meId ? '나' : (to?.name ?? '친구')
          const line = !event.fromId
            ? event.toId === meId
              ? '내가 갖게 됐어용'
              : `${toName}님이 갖게 됐어용`
            : event.fromId === meId
              ? `내가 ${toName}님께 넘겼어용`
              : event.toId === meId
                ? `${fromName}님이 나한테 넘겼어용`
                : `${fromName}님이 ${toName}님께 넘겼어용`
          return (
            <li key={event.id} className="text-[13px] text-muted-foreground">
              <span className="text-foreground">{line}</span>
              <span className="ml-2">{formatTime(event.at)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function formatTime(at: number) {
  return new Intl.DateTimeFormat('ko', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at)
}
