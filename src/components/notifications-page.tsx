import { useEffect, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { readWho } from '@/lib/identity'
import { declineAlertLine, handoffAlertLine, likeAlertLine, nudgeAlertLine, offerAlertLine, replyAlertLine, requestAlertLine, tookAlertLine } from '@/lib/model'
import { useShelf } from '@/lib/store'
import type { Friend, Notice } from '@/lib/types'
import { Avatar } from '@/components/avatar-editor'
import { EdgeBack } from '@/components/edge-back'

export function NotificationsPage({
  me,
  onBack,
  onOpenBook,
  onOpenRequest,
}: {
  me: Friend
  onBack: () => void
  onOpenBook: (bookId: string) => void
  onOpenRequest: (postId: string) => void
}) {
  const shelf = useShelf()
  const shelfRef = useRef(shelf)
  const items = shelf.data.notifications[me.id] ?? []

  useEffect(() => {
    shelfRef.current = shelf
  })
  useEffect(() => {
    void shelfRef.current.markNotificationsRead()
  }, [])

  return (
    <EdgeBack onBack={onBack}>
      <div className="min-h-dvh bg-background">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
          <div className="relative flex h-14 items-center">
            <button type="button" className="grid size-11 place-items-center" onClick={onBack} aria-label="뒤로">
              <ChevronLeft className="size-6" />
            </button>
            <h1 className="pointer-events-none absolute inset-x-24 truncate text-center text-[17px] font-bold">알림</h1>
            <button
              type="button"
              className="mr-3 ml-auto h-11 text-[13px] font-bold text-x"
              onClick={() => void shelf.markNotificationsRead()}
            >
              모두 읽음
            </button>
          </div>
        </header>
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-[15px] text-muted-foreground">아직 알림이 없어용.</p>
        ) : (
          <div>
            {items.map((notice) => (
              <NotificationRow
                key={notice.id}
                notice={notice}
                onOpen={() => (notice.kind === 'request' && notice.postId ? onOpenRequest(notice.postId) : onOpenBook(notice.bookId))}
              />
            ))}
          </div>
        )}
      </div>
    </EdgeBack>
  )
}

function NotificationRow({ notice, onOpen }: { notice: Notice; onOpen: () => void }) {
  const shelf = useShelf()
  const request = notice.kind === 'request'
  const actor = notice.actorId === 'admin' || request ? null : shelf.data.friends.find((friend) => friend.id === notice.actorId)
  const name = notice.actorId === 'admin' || request ? '관리자' : (actor?.name ?? '친구')
  const book = shelf.data.books.find((item) => item.id === notice.bookId)
  const title = book?.title ?? '책'
  const line = request
    ? requestAlertLine(notice.preview ?? '')
    : notice.kind === 'offer'
      ? offerAlertLine(name, title)
      : notice.kind === 'took'
        ? tookAlertLine(name, title)
        : notice.kind === 'decline'
          ? declineAlertLine(name)
          : notice.kind === 'handoff'
            ? handoffAlertLine(name, title)
            : notice.kind === 'like'
              ? likeAlertLine(name)
              : notice.kind === 'reply'
                ? replyAlertLine(name, notice.preview ?? '')
                : nudgeAlertLine(name, title)
  const me = readWho()
  const transfer = shelf.data.transfers[notice.bookId]
  const canAnswer = notice.kind === 'offer' && transfer?.toId === me
  return (
    <div
      className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left"
      data-testid="notification-row"
      data-read={notice.read ? 'true' : 'false'}
    >
      <button type="button" className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={onOpen}>
      <span className={`mt-3 size-2 shrink-0 rounded-full ${notice.read ? 'bg-transparent' : 'bg-x'}`} />
      <Avatar name={name} photo={actor?.photo ?? null} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug">{line}</span>
        {notice.kind === 'like' || notice.kind === 'reply' ? (
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{book?.title ?? '책을 찾을 수 없어용'}</span>
        ) : null}
      </span>
      </button>
      {canAnswer ? (
        <span className="flex shrink-0 gap-1">
          <button type="button" data-testid="notice-accept" className="h-11 px-2 text-[15px] font-bold text-x" onClick={() => void shelf.acceptOffer(notice.bookId)}>
            수락
          </button>
          <button type="button" data-testid="notice-decline" className="h-11 px-2 text-[15px] font-bold text-muted-foreground" onClick={() => void shelf.declineOffer(notice.bookId)}>
            거절
          </button>
        </span>
      ) : null}
    </div>
  )
}
