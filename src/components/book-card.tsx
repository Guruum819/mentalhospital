import { useEffect, useState } from 'react'
import { Check, ImageOff, MoreHorizontal } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { averageRating, countReads, nudgeAllowanceLine, nudgesRemaining, pendingPassLine, resolvedHolderId, visibleFriends } from '@/lib/model'
import { inkFor, paletteColor } from '@/lib/palette'
import { useShelf } from '@/lib/store'
import { toast } from 'sonner'
import type { Book, Transfer } from '@/lib/types'
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
  compact = false,
}: {
  canDelete: boolean
  onEdit: () => void
  onDelete?: () => void
  /** Match the title-row pill. The detail header keeps the larger target. */
  compact?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="책 메뉴"
          className={`grid shrink-0 place-items-center rounded-full text-foreground hover:bg-muted ${compact ? 'size-8' : 'size-11'}`}
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
  const transfer = shelf.data.transfers[book.id] ?? null
  const pendingName = transfer ? friends.find((friend) => friend.id === transfer.toId)?.name ?? '친구' : null
  const average = averageRating(shelf.data.reviews.filter((review) => review.bookId === book.id))

  return (
    <article
      className={`min-w-0 border-b border-border px-4 py-3 ${onOpen ? 'cursor-pointer active:bg-muted/70' : ''}`}
      onClick={(event) => {
        if (!onOpen) return
        const target = event.target
        if (target instanceof Element && target.closest('button, a, input, textarea, label')) return
        onOpen(book.id)
      }}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-stretch gap-3">
        <div className="h-full">
          <div className="relative h-full overflow-hidden rounded-md [aspect-ratio:2/3]">
          {book.coverUrl && !brokenCover ? (
            <img
              src={book.coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setBrokenCover(true)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
              <ImageOff className="size-4" />
              <span className="px-1 text-center text-[11px] leading-tight">표지가 없어용</span>
            </div>
          )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h2 data-testid="book-title" className="line-clamp-2 min-w-0 flex-1 break-keep text-[17px] leading-snug font-bold tracking-tight">
              {book.title}
            </h2>
            {(me && !mineRead) || book.buyerId === meId ? (
              <div className="flex h-8 shrink-0 items-center justify-end gap-1">
                {me && !mineRead ? <QueuePill bookId={book.id} meId={meId} /> : null}
                {book.buyerId === meId ? (
                  <BookMenu compact canDelete onEdit={() => onEdit(book)} onDelete={() => onDelete(book)} />
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-1">
            <p data-testid="book-holder" className="text-[13px] text-muted-foreground">
              {holder ? (
                <>
                  지금{' '}
                  <span className="font-bold" style={{ color: paletteColor(holder.color).hex }}>
                    {holding ? '내가' : holder.name}
                  </span>
                  {holding ? ' ' : '님이 '}갖고 있어용
                </>
              ) : (
                '지금 갖고 있는 사람이 없어용'
              )}
            </p>
            {transfer ? (
              <p data-testid="pending-pass" className="mt-0.5 text-[13px] font-medium text-foreground">
                {pendingPassLine(pendingName ?? '친구')}
              </p>
            ) : null}
            <CardActions
              holding={holding}
              transfer={transfer}
              meId={meId}
              admin={shelf.admin}
              onPass={() => setPassOpen(true)}
              onCancel={() => void shelf.cancelOffer(book.id)}
              onAccept={() => void shelf.acceptOffer(book.id)}
              onDecline={() => void shelf.declineOffer(book.id)}
            />
          </div>
          <p className="mt-2 truncate text-[15px] text-muted-foreground">{book.author || '저자 미상'}</p>
          {average !== null ? (
            <div className="mt-1">
              <StarRating value={average} readOnly size="sm" />
            </div>
          ) : null}
          <div className="mt-2 flex items-center gap-2 text-[15px]">
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
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[13px] text-muted-foreground">
          읽음 {readCount}/{friends.length}
        </p>
        <div
          className="mt-1.5 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${chipColumns(friends.length)}, minmax(0, 1fr))` }}
        >
          {friends.map((friend) => {
            const checked = Boolean(shelf.data.reads[book.id]?.[friend.id])
            const swatch = paletteColor(friend.color)
            const mine = friend.id === meId
            const style = checked
              ? { backgroundColor: swatch.hex, color: inkFor(swatch.hex) }
              : { backgroundColor: 'transparent', color: swatch.hex, boxShadow: `inset 0 0 0 1px ${swatch.hex}` }
            const className =
              'flex h-11 min-w-0 items-center justify-center gap-0.5 overflow-hidden rounded-full px-1 text-[13px] font-bold leading-none'
            const label = (
              <>
                {checked ? <Check className="size-3 shrink-0" strokeWidth={3} /> : null}
                <span className="truncate">{friend.name}</span>
              </>
            )
            if (!mine) {
              return (
                <span
                  key={friend.id}
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`${friend.name}, ${book.title}, ${checked ? '읽음' : '아직 안 읽음'}`}
                  data-testid={`read-${book.id}-${friend.id}`}
                  className={`${className} cursor-default [-webkit-tap-highlight-color:transparent]`}
                  style={style}
                  onClick={() => toast('본인 것만 체크할 수 있어용')}
                >
                  {label}
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
                className={className}
                style={style}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      {reader && readerSwatch && !mineReading ? (
        <div className="mt-3 space-y-1">
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
                  className="h-11 shrink-0 rounded-full bg-x px-3 text-[13px] font-bold text-white disabled:opacity-50"
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
      {holding && (mineReading || !reader) ? (
        mineReading && reader && readerSwatch ? (
          <div className="mt-3 flex min-h-11 items-center gap-2" data-testid={`reading-${book.id}`}>
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
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full px-3 text-[15px] font-bold"
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
            className="mt-3 flex h-11 w-full items-center justify-center rounded-full text-[15px] font-bold text-x ring-1 ring-inset ring-x/40"
            data-testid={`reading-${book.id}`}
            onClick={() => setChoiceOpen(true)}
          >
            읽는 중
          </button>
        )
      ) : null}
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
      <ReadingExtras bookId={book.id} meId={meId} readerId={reader?.id ?? null} onOpenFriend={onOpenFriend} />
    </article>
  )
}

const actionButton = 'h-8 shrink-0 rounded-full px-2.5 text-[13px] font-bold'

function chipColumns(count: number): number {
  return Math.min(5, Math.max(count, 1))
}

function CardActions({
  holding,
  transfer,
  meId,
  admin,
  onPass,
  onCancel,
  onAccept,
  onDecline,
}: {
  holding: boolean
  transfer: Transfer | null
  meId: string
  admin: boolean
  onPass: () => void
  onCancel: () => void
  onAccept: () => void
  onDecline: () => void
}) {
  const pass = holding && !transfer
  const cancel = Boolean(transfer && transfer.fromId === meId)
  const answer = Boolean(transfer && transfer.toId === meId)
  const reassign = !holding && !transfer && admin
  if (!pass && !cancel && !answer && !reassign) return null
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {pass ? (
        <button type="button" data-testid="pass-book" className={`${actionButton} text-x ring-1 ring-inset ring-x/40`} onClick={onPass}>
          책 넘기기
        </button>
      ) : null}
      {cancel ? (
        <button type="button" data-testid="cancel-offer" className={`${actionButton} ring-1 ring-inset ring-foreground/30`} onClick={onCancel}>
          취소
        </button>
      ) : null}
      {answer ? (
        <>
          <button type="button" data-testid="accept-offer" className={`${actionButton} bg-x text-white`} onClick={onAccept}>
            수락
          </button>
          <button type="button" data-testid="decline-offer" className={`${actionButton} ring-1 ring-inset ring-foreground/30`} onClick={onDecline}>
            거절
          </button>
        </>
      ) : null}
      {reassign ? (
        <button type="button" data-testid="reassign-holder" className={`${actionButton} ring-1 ring-inset ring-foreground/30`} onClick={onPass}>
          소장자 바꾸기
        </button>
      ) : null}
    </div>
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

function QueuePill({ bookId, meId }: { bookId: string; meId: string }) {
  const shelf = useShelf()
  const queue = shelf.data.queues[bookId] ?? []
  const place = queue.indexOf(meId)
  const joined = place >= 0
  return (
    <button
      type="button"
      data-testid="join-queue"
      className={`h-8 shrink-0 rounded-full px-2.5 text-[12px] font-bold leading-none ${joined ? 'bg-x text-white' : 'text-foreground ring-1 ring-inset ring-foreground/25'}`}
      onClick={() => void shelf.toggleQueue(bookId)}
    >
      {joined ? `대기 ${place + 1}번째` : '대기 신청'}
    </button>
  )
}

function ReadingExtras({
  bookId,
  meId,
  readerId,
  onOpenFriend,
}: {
  bookId: string
  meId: string
  readerId: string | null
  onOpenFriend?: (friendId: string) => void
}) {
  const shelf = useShelf()
  const nudges = shelf.data.nudges[bookId] ?? []
  const queue = (shelf.data.queues[bookId] ?? [])
    .map((id) => shelf.data.friends.find((friend) => friend.id === id))
    .filter((friend): friend is NonNullable<typeof friend> => Boolean(friend))
  const mine = readerId === meId
  if (queue.length === 0 && !(mine && nudges.length > 0)) return null

  return (
    <div className="mt-2 space-y-2">
      {mine && nudges.length > 0 ? (
        <span className="inline-flex h-11 items-center rounded-full bg-x px-3 text-[15px] font-bold text-white">
          독촉 {nudges.length}
        </span>
      ) : null}
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
