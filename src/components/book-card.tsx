import { useEffect, useState } from 'react'
import { Check, ImageOff, MoreHorizontal } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { averageRating, countReads, holderLine, nudgeAllowanceLine, nudgesRemaining, resolvedHolderId, visibleFriends } from '@/lib/model'
import { inkFor, paletteColor } from '@/lib/palette'
import { useShelf } from '@/lib/store'
import { toast } from 'sonner'
import type { Book } from '@/lib/types'
import { Avatar } from '@/components/avatar-editor'
import { PassBookSheet } from '@/components/pass-book-sheet'
import { StarRating } from '@/components/star-rating'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function BookMenu({
  canDelete,
  onEdit,
  onDelete,
}: {
  canDelete: boolean
  onEdit: () => void
  onDelete?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="책 메뉴"
          className="grid size-11 shrink-0 place-items-center rounded-full text-foreground hover:bg-muted"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem className="h-11 px-3 text-[15px]" onSelect={onEdit}>
          수정
        </DropdownMenuItem>
        {canDelete && onDelete ? (
          <DropdownMenuItem
            variant="destructive"
            className="h-11 px-3 text-[15px]"
            data-testid="delete-book"
            onSelect={onDelete}
          >
            삭제
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function BookCard({
  book,
  meId,
  onEdit,
  onDelete,
  onOpen,
  onOpenFriend,
}: {
  book: Book
  meId: string
  onEdit: (book: Book) => void
  onDelete: (book: Book) => void
  onOpen?: (bookId: string) => void
  onOpenFriend?: (friendId: string) => void
}) {
  const shelf = useShelf()
  const [brokenCover, setBrokenCover] = useState(false)
  const [choiceOpen, setChoiceOpen] = useState(false)
  const [passOpen, setPassOpen] = useState(false)
  const [poking, setPoking] = useState(false)
  const now = useNow()
  const friends = visibleFriends(shelf.data.friends)
  const readCount = countReads(
    shelf.data.reads,
    book.id,
    friends.map((friend) => friend.id),
  )
  const buyer = shelf.data.friends.find((friend) => friend.id === book.buyerId)
  const readerId = shelf.data.reading[book.id]
  const reader = friends.find((friend) => friend.id === readerId)
  const readerSwatch = reader ? paletteColor(reader.color) : null
  const me = friends.find((friend) => friend.id === meId)
  const meSwatch = me ? paletteColor(me.color) : null
  const mineReading = readerId === meId
  const mineRead = Boolean(shelf.data.reads[book.id]?.[meId])
  const remaining = nudgesRemaining(shelf.data.nudgeSends[meId] ?? [], now)
  const canNudge = Boolean(reader && me && !mineReading)
  const outOfNudges = remaining === 0
  const holderId = resolvedHolderId(book, new Set(friends.map((friend) => friend.id)))
  const holder = holderId ? friends.find((friend) => friend.id === holderId) ?? null : null
  const holding = holderId === meId
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
            <div className="min-w-0 flex-1">
              <h2 data-testid="book-title" className="truncate text-[17px] leading-snug font-bold tracking-tight">
                {book.title}
              </h2>
              <p data-testid="book-holder" className="mt-0.5 text-[13px] text-muted-foreground">
                {holderLine(holder?.name ?? null, holding)}
              </p>
            </div>
            {book.buyerId === meId ? (
              <BookMenu
                canDelete
                onEdit={() => onEdit(book)}
                onDelete={() => onDelete(book)}
              />
            ) : null}
          </div>
          <p className="truncate text-[15px] text-muted-foreground">{book.author || '저자 미상'}</p>
          {average !== null ? (
            <div className="mt-1">
              <StarRating value={average} readOnly size="sm" />
            </div>
          ) : null}
          <div className="mt-2 flex min-h-11 items-center gap-2 text-[15px]">
            {buyer ? (
              <button
                type="button"
                className="flex min-w-0 items-center gap-2"
                onClick={() => onOpenFriend?.(buyer.id)}
              >
                <Avatar name={buyer.name} photo={buyer.photo} size={24} />
                <span className="truncate font-semibold">{buyer.name}</span>
                <span className="text-muted-foreground">구매</span>
              </button>
            ) : (
              <span className="text-muted-foreground">구매자가 없어용</span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground">
            읽음 {readCount}/{friends.length}
          </p>
          {holding ? (
            <button
              type="button"
              data-testid="pass-book"
              className="mt-2 h-11 rounded-full px-3 text-[15px] font-bold text-x ring-1 ring-inset ring-x/40"
              onClick={() => setPassOpen(true)}
            >
              책 넘기기
            </button>
          ) : shelf.admin ? (
            <button
              type="button"
              data-testid="reassign-holder"
              className="mt-2 h-11 rounded-full px-3 text-[15px] font-bold ring-1 ring-inset ring-foreground/30"
              onClick={() => setPassOpen(true)}
            >
              소장자 바꾸기
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {friends.map((friend) => {
          const checked = Boolean(shelf.data.reads[book.id]?.[friend.id])
          const swatch = paletteColor(friend.color)
          const mine = friend.id === meId
          const style = checked
            ? { backgroundColor: swatch.hex, color: inkFor(swatch.hex) }
            : { backgroundColor: 'transparent', color: swatch.hex, boxShadow: `inset 0 0 0 1px ${swatch.hex}` }
          if (!mine) {
            return (
              <span
                key={friend.id}
                role="checkbox"
                aria-checked={checked}
                aria-label={`${friend.name}, ${book.title}, ${checked ? '읽음' : '아직 안 읽음'}`}
                data-testid={`read-${book.id}-${friend.id}`}
                className="inline-flex h-11 min-w-11 cursor-default items-center justify-center gap-1 rounded-full px-3 text-[15px] font-bold [-webkit-tap-highlight-color:transparent]"
                style={style}
                onClick={() => toast('본인 것만 체크할 수 있어용')}
              >
                {checked ? <Check className="size-4" strokeWidth={3} /> : null}
                {friend.name}
              </span>
            )
          }
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
              style={style}
            >
              {checked ? <Check className="size-4" strokeWidth={3} /> : null}
              {friend.name}
            </button>
          )
        })}
      </div>

      <div className="mt-2 space-y-2">
        {reader && readerSwatch && !mineReading ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-[15px] font-bold ${poking ? 'nudge-poke' : ''}`}
                data-testid={`reading-${book.id}`}
                style={{ backgroundColor: readerSwatch.hex, color: inkFor(readerSwatch.hex) }}
              >
                <span className="shrink-0 text-[13px] font-medium opacity-90">읽는 중</span>
                <span className="truncate">{reader.name}</span>
              </div>
              {canNudge ? (
                <button
                  type="button"
                  data-testid="nudge-reader"
                  className="h-9 shrink-0 rounded-full bg-x px-3 text-[13px] font-bold text-white disabled:opacity-50"
                  disabled={outOfNudges}
                  onClick={() => {
                    void shelf.nudge(book.id).then((ok) => {
                      if (!ok) return
                      setPoking(true)
                      window.setTimeout(() => setPoking(false), 640)
                    })
                  }}
                >
                  <span className={`inline-block ${poking ? 'nudge-poke' : ''}`} aria-hidden>👉</span> 독촉
                </button>
              ) : null}
            </div>
            {canNudge ? (
              <p data-testid="nudge-remaining" className="px-1 text-[13px] font-medium text-muted-foreground">
                {nudgeAllowanceLine(remaining)}
              </p>
            ) : null}
          </div>
        ) : null}
        {mineReading && reader && readerSwatch ? (
          <div className="flex min-h-11 items-center gap-2" data-testid={`reading-${book.id}`}>
            <button
              type="button"
              className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-[15px] font-bold"
              style={{ backgroundColor: readerSwatch.hex, color: inkFor(readerSwatch.hex) }}
              onClick={() => setChoiceOpen(true)}
            >
              <span className="shrink-0 text-[13px] font-medium opacity-90">읽는 중</span>
              <span className="truncate">{reader.name}</span>
            </button>
            <button
              type="button"
              className="h-11 shrink-0 rounded-full px-3 text-[15px] font-bold text-muted-foreground"
              onClick={() => void shelf.setReading(book.id, null)}
            >
              해제
            </button>
          </div>
        ) : mineRead && meSwatch ? (
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full px-3 text-[15px] font-bold"
            data-testid={`finished-${book.id}`}
            style={{ backgroundColor: meSwatch.hex, color: inkFor(meSwatch.hex) }}
            onClick={() => setChoiceOpen(true)}
          >
            <span aria-hidden>✦</span>
            독서 완료!
          </button>
        ) : (
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center rounded-full text-[15px] font-bold text-x ring-1 ring-inset ring-x/40"
            data-testid={`reading-${book.id}`}
            onClick={() => setChoiceOpen(true)}
          >
            읽는 중
          </button>
        )}
      </div>
      <PassBookSheet book={book} open={passOpen} onOpenChange={setPassOpen} />
      <ReadingChoice
        open={choiceOpen}
        reading={mineReading}
        finished={mineRead && !mineReading}
        onOpenChange={setChoiceOpen}
        onReading={() => {
          setChoiceOpen(false)
          void shelf.setReading(book.id, meId)
        }}
        onFinished={() => {
          setChoiceOpen(false)
          void shelf.markFinished(book.id)
        }}
      />
      {reader ? (
        <ReadingExtras bookId={book.id} meId={meId} readerId={reader.id} onOpenFriend={onOpenFriend} />
      ) : null}
    </article>
  )
}

function ReadingChoice({
  open,
  reading,
  finished,
  onOpenChange,
  onReading,
  onFinished,
}: {
  open: boolean
  reading: boolean
  finished: boolean
  onOpenChange: (open: boolean) => void
  onReading: () => void
  onFinished: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>읽기 상태</DialogTitle>
          <DialogDescription>나만 바꿀 수 있어용.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`h-12 rounded-full text-[15px] font-bold ${reading ? 'bg-x text-white' : 'ring-1 ring-inset ring-x/40 text-x'}`}
            onClick={onReading}
          >
            읽는 중
          </button>
          <button
            type="button"
            className={`h-12 rounded-full text-[15px] font-bold ${finished ? 'bg-x text-white' : 'ring-1 ring-inset ring-x/40 text-x'}`}
            onClick={onFinished}
          >
            완독
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function ReadingExtras({
  bookId,
  meId,
  readerId,
  onOpenFriend,
}: {
  bookId: string
  meId: string
  readerId: string
  onOpenFriend?: (friendId: string) => void
}) {
  const shelf = useShelf()
  const nudges = shelf.data.nudges[bookId] ?? []
  const queue = (shelf.data.queues[bookId] ?? [])
    .map((id) => shelf.data.friends.find((friend) => friend.id === id))
    .filter((friend): friend is NonNullable<typeof friend> => Boolean(friend))
  const queued = queue.some((friend) => friend.id === meId)
  const mine = readerId === meId

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {mine && nudges.length > 0 ? (
          <span className="inline-flex h-11 items-center rounded-full bg-x px-3 text-[15px] font-bold text-white">
            독촉 {nudges.length}
          </span>
        ) : null}
        {mine ? null : (
          <button
            type="button"
            className="h-11 rounded-full px-3 text-[15px] font-bold ring-1 ring-inset ring-foreground/30"
            onClick={() => void shelf.toggleQueue(bookId)}
          >
            {queued ? '대기 취소' : '다음에 읽을래요'}
          </button>
        )}
      </div>
      {queue.length > 0 ? (
        <ol className="flex gap-3 overflow-x-auto" aria-label="다음에 읽을 순서">
          {queue.map((friend, index) => (
            <li key={friend.id}>
              <button
                type="button"
                className="flex h-11 items-center gap-1.5"
                onClick={() => onOpenFriend?.(friend.id)}
              >
                <span className="text-[13px] font-bold text-muted-foreground tabular-nums">{index + 1}</span>
                <Avatar name={friend.name} photo={friend.photo} size={28} />
                <span className="max-w-24 truncate text-[15px] font-semibold">{friend.name}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
