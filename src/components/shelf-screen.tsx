import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { forgetAccount, readAccounts, readWho, rememberAccount } from '@/lib/identity'
import { nudgeLine, shelfStats, sortedBooks, visibleFriends } from '@/lib/model'
import { paletteColor } from '@/lib/palette'
import { useShelf } from '@/lib/store'
import type { Book, BookSort, Friend } from '@/lib/types'
import { AppDrawer } from '@/components/app-drawer'
import { Avatar } from '@/components/avatar-editor'
import { BookCard } from '@/components/book-card'
import { BookDetail } from '@/components/book-detail'
import { BookDialog } from '@/components/book-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProfileGate } from '@/components/profile-gate'
import { ProfilePage } from '@/components/profile-page'
import { SettingsPage } from '@/components/settings-page'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type View =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'profile'; friendId: string }
  | { name: 'book'; bookId: string }

type Confirm =
  | { kind: 'delete-friend'; friend: Friend }
  | { kind: 'delete-book'; book: Book }
  | { kind: 'clear' }
  | null

const SORTS: [BookSort, string][] = [
  ['new', '최신 등록순'],
  ['popular', '인기순'],
  ['read', '많이 읽은 순'],
]

export function ShelfScreen() {
  const shelf = useShelf()
  const [bookOpen, setBookOpen] = useState(false)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [meId, setMeId] = useState<string | null>(() => readWho())
  const [account, setAccount] = useState<'app' | 'login' | 'signup' | 'edit'>('app')
  const [stack, setStack] = useState<View[]>([{ name: 'home' }])
  const [sort, setSort] = useState<BookSort>('new')
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [confirming, setConfirming] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [joining, setJoining] = useState(false)
  const awaitingId = useRef<string | null>(null)

  useEffect(() => {
    if (!shelf.ready || !meId) return
    if (shelf.data.friends.some((friend) => friend.id === meId)) {
      awaitingId.current = null
      setJoining(false)
      rememberAccount(meId)
      return
    }
    if (awaitingId.current === meId) return
    setJoining(false)
    const next = forgetAccount(meId)
    setMeId(next)
    setAccount(next ? 'app' : 'login')
    setStack([{ name: 'home' }])
  }, [shelf.ready, meId, shelf.data.friends])

  useEffect(() => {
    const current = stack[stack.length - 1]
    if (!current || !shelf.ready) return
    const missingBook = current.name === 'book' && !shelf.data.books.some((book) => book.id === current.bookId)
    const missingProfile =
      current.name === 'profile' &&
      !shelf.data.friends.some((friend) => friend.id === current.friendId && friend.approved)
    if (missingBook || missingProfile) {
      setStack((items) => (items.length > 1 ? items.slice(0, -1) : [{ name: 'home' }]))
    }
  }, [stack, shelf.ready, shelf.data.books, shelf.data.friends])

  if (!shelf.ready) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-xl font-bold">서재를 여는 중</p>
        </div>
      </main>
    )
  }

  if (shelf.error && shelf.data.friends.length === 0 && shelf.data.books.length === 0 && !shelf.data.initialized) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <p className="text-xl font-bold">서재를 열지 못했어용</p>
          <p className="mt-2 text-sm text-muted-foreground">{shelf.error}</p>
          <Button type="button" className="mt-4 h-12 px-5 text-base" onClick={() => window.location.reload()}>
            다시 시도
          </Button>
        </div>
      </main>
    )
  }

  const stats = shelfStats(shelf.data)
  const top = stack[stack.length - 1] ?? { name: 'home' as const }

  function push(view: View) {
    setStack((current) => [...current, view])
  }

  function pop() {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current))
  }

  async function runConfirm() {
    if (!confirm || confirming) return
    setConfirming(true)
    let ok = false
    if (confirm.kind === 'delete-friend') {
      ok = await shelf.removeFriend(confirm.friend.id)
      if (ok && confirm.friend.id === meId) {
        const next = forgetAccount(confirm.friend.id)
        setMeId(next)
        setAccount(next ? 'app' : 'login')
        setStack([{ name: 'home' }])
      }
    }
    if (confirm.kind === 'delete-book') {
      ok = await shelf.removeBook(confirm.book.id)
      if (ok) pop()
    }
    if (confirm.kind === 'clear') ok = await shelf.clearShelf()
    setConfirming(false)
    if (ok) setConfirm(null)
  }

  const confirmDialog = (
    <ConfirmDialog
      open={confirm !== null}
      title={confirmTitle(confirm)}
      description={confirmText(confirm)}
      confirmLabel="삭제"
      destructive
      pending={confirming}
      onOpenChange={(open) => {
        if (!open) setConfirm(null)
      }}
      onConfirm={() => void runConfirm()}
    />
  )

  const me = shelf.data.friends.find((friend) => friend.id === meId) ?? null
  function enter(id: string) {
    awaitingId.current = id
    if (!shelf.data.friends.some((friend) => friend.id === id)) setJoining(true)
    rememberAccount(id)
    setMeId(id)
    setAccount('app')
    setStack([{ name: 'home' }])
  }

  function logout() {
    const next = forgetAccount(meId ?? '')
    setMeId(next)
    setAccount(next ? 'app' : 'login')
    setStack([{ name: 'home' }])
  }

  if (!me && joining) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <p className="text-xl font-bold">가입 신청을 저장하는 중</p>
      </main>
    )
  }

  if (!me || account !== 'app') {
    const mode = !me ? (account === 'signup' || shelf.data.friends.length === 0 ? 'signup' : 'login') : account === 'edit' ? 'edit' : account
    return (
      <>
        <ProfileGate
          mode={mode === 'app' ? 'login' : mode}
          me={me}
          onLogin={enter}
          onCancel={me ? () => setAccount('app') : undefined}
          onDelete={(friend) => setConfirm({ kind: 'delete-friend', friend })}
          onMode={setAccount}
        />
        {confirmDialog}
      </>
    )
  }

  if (!me.approved) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
        <h1 className="text-[28px] font-extrabold tracking-tight">가입 신청을 보냈어용</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">관리자가 승인하면 서재를 볼 수 있어용. 그 전까지는 책이 안 보여용.</p>
        <Button type="button" variant="outline" className="mt-6 h-12 text-base" onClick={logout}>
          로그아웃
        </Button>
      </main>
    )
  }

  const members = visibleFriends(shelf.data.friends)
  const books = sortedBooks(
    shelf.data.books,
    sort,
    shelf.data.reviews,
    shelf.data.reads,
    members.map((friend) => friend.id),
  )
  const deviceAccounts = readAccounts()
    .map((id) => members.find((friend) => friend.id === id))
    .filter((friend): friend is Friend => Boolean(friend && friend.id !== me.id))
  const notices = shelf.data.books.filter(
    (book) => shelf.data.reading[book.id] === me.id && (shelf.data.nudges[book.id]?.length ?? 0) > 0,
  )
  const profileFriend = top.name === 'profile' ? members.find((friend) => friend.id === top.friendId) ?? null : null
  const detail = top.name === 'book' ? shelf.data.books.find((book) => book.id === top.bookId) ?? null : null

  return (
    <AppDrawer
      me={me}
      others={deviceAccounts}
      edgeSwipe={top.name === 'home'}
      onSwitch={enter}
      onAddAccount={() => setAccount('login')}
      onProfile={() => setStack([{ name: 'home' }, { name: 'profile', friendId: me.id }])}
      onSettings={() => setStack([{ name: 'home' }, { name: 'settings' }])}
    >
      {(openDrawer) => (
        <div className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col">
          {top.name === 'profile' && profileFriend ? (
            <ProfilePage
              friend={profileFriend}
              mine={profileFriend.id === me.id}
              onBack={pop}
              onEdit={() => setAccount('edit')}
              onOpenBook={(bookId) => push({ name: 'book', bookId })}
            />
          ) : top.name === 'settings' ? (
            <SettingsPage
              onBack={pop}
              onSwitch={() => setAccount('login')}
              onLogout={logout}
              onDelete={() => setConfirm({ kind: 'delete-friend', friend: me })}
              onGuide={() => setGuideOpen(true)}
              onClearBooks={() => setConfirm({ kind: 'clear' })}
            />
          ) : top.name === 'book' && detail ? (
            <BookDetail
              book={detail}
              me={me}
              onBack={pop}
              onEdit={(item) => {
                setEditingBook(item)
                setBookOpen(true)
              }}
              onDelete={(item) => setConfirm({ kind: 'delete-book', book: item })}
              onOpenFriend={(friendId) => push({ name: 'profile', friendId })}
            />
          ) : (
            <>
              <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
                <div className="relative flex h-14 items-center">
                  <button type="button" className="relative z-10 grid size-11 place-items-center" aria-label="메뉴" onClick={openDrawer}>
                    <Avatar name={me.name} photo={me.photo} size={32} />
                  </button>
                  <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-[17px] font-bold tracking-tight">교환독서</h1>
                  <span className="relative z-10 ml-auto">
                    <Status mode={shelf.mode} connected={shelf.connected} />
                  </span>
                </div>
              </header>
              {shelf.mode === 'demo' ? (
                <p className="border-b border-border px-4 py-2 text-[13px] text-muted-foreground">
                  이 브라우저 데모예용. 다른 폰이랑 맞추려면 Firebase를 연결해 주세용.
                </p>
              ) : null}
              {shelf.error ? <p className="border-b border-border px-4 py-2 text-sm text-destructive">{shelf.error}</p> : null}
              {notices.map((book) => {
                const names = (shelf.data.nudges[book.id] ?? [])
                  .map((id) => shelf.data.friends.find((friend) => friend.id === id)?.name)
                  .filter((name): name is string => Boolean(name))
                return (
                  <div key={book.id} className="border-b border-border px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-bold">
                          <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground px-1.5 text-[12px] text-background tabular-nums">
                            {names.length}
                          </span>
                          {nudgeLine(names)}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">{book.title}</p>
                      </div>
                      <button type="button" className="h-11 shrink-0 text-[15px] font-bold" onClick={() => void shelf.dismissNudges(book.id)}>
                        확인했어용
                      </button>
                    </div>
                  </div>
                )
              })}
              <p className="border-b border-border px-4 py-2 text-[13px] text-muted-foreground">
                내 이름만 읽음으로 체크할 수 있어용 · 책 {stats.bookCount}권 · 친구 {stats.friendCount}명
                {stats.totalCells > 0 ? ` · ${stats.readCells}/${stats.totalCells}` : ''}
              </p>
              <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
                {members.map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    className="inline-flex h-11 shrink-0 items-center gap-1.5 text-[15px] font-bold"
                    onClick={() => push({ name: 'profile', friendId: friend.id })}
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: paletteColor(friend.color).hex }} />
                    {friend.name}
                    {friend.id === me.id ? ' · 나' : ''}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 border-b border-border px-4" role="tablist" aria-label="책 정렬">
                {SORTS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={sort === id}
                    className={`h-11 text-[14px] font-bold ${sort === id ? 'text-foreground underline decoration-2 underline-offset-8' : 'text-muted-foreground'}`}
                    onClick={() => setSort(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="pb-28">
                {books.length === 0 ? (
                  <div className="px-8 py-16 text-center">
                    <p className="text-xl font-bold">아직 책이 없어용</p>
                    <p className="mt-1 text-[15px] text-muted-foreground">오른쪽 아래 + 로 책을 올려 주세용.</p>
                  </div>
                ) : (
                  books.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      meId={me.id}
                      onOpen={(bookId) => push({ name: 'book', bookId })}
                      onOpenFriend={(friendId) => push({ name: 'profile', friendId })}
                      onEdit={(item) => {
                        setEditingBook(item)
                        setBookOpen(true)
                      }}
                      onDelete={(item) => setConfirm({ kind: 'delete-book', book: item })}
                    />
                  ))
                )}
              </div>
              <button
                type="button"
                aria-label="책 추가"
                className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-x text-x-ink shadow-[0_4px_16px_rgba(15,20,25,0.28)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.16)]"
                onClick={() => {
                  setEditingBook(null)
                  setBookOpen(true)
                }}
              >
                <Plus className="size-7" strokeWidth={2.5} />
              </button>
            </>
          )}
          <BookDialog open={bookOpen} book={editingBook} onOpenChange={setBookOpen} />
          <GuideDialog open={guideOpen} onOpenChange={setGuideOpen} demo={shelf.mode === 'demo'} />
          {confirmDialog}
        </div>
      )}
    </AppDrawer>
  )
}

function confirmTitle(confirm: Confirm) {
  if (confirm?.kind === 'delete-friend') return `${confirm.friend.name} 님의 계정을 정말 지울 거예용?`
  if (confirm?.kind === 'delete-book') return '이 책을 정말 지울 거예용?'
  if (confirm?.kind === 'clear') return '서재를 정말 비울 거예용?'
  return ''
}

function confirmText(confirm: Confirm) {
  if (confirm?.kind === 'delete-friend') return '이 프로필의 읽은 기록이랑 읽는 중, 한 줄 평은 사라져용. 이 사람이 올린 책은 서재에 그대로 남아용.'
  if (confirm?.kind === 'delete-book') return '읽은 기록이랑 리뷰도 같이 사라져용.'
  if (confirm?.kind === 'clear') return '책이랑 한 줄 평만 지울 거예용. 프로필은 그대로예용.'
  return ''
}

function Status({ mode, connected }: { mode: 'demo' | 'firebase'; connected: boolean }) {
  if (mode === 'demo') {
    return (
      <span data-testid="sync-status" role="status" className="inline-flex h-11 items-center gap-1 pr-3 text-[13px] font-medium text-muted-foreground">
        이 브라우저
      </span>
    )
  }
  return (
    <span
      data-testid="sync-status"
      role="status"
      className="inline-flex h-11 items-center gap-1.5 pr-3 text-[13px] font-medium text-muted-foreground"
    >
      <span className={`size-2 rounded-full ${connected ? 'bg-x' : 'bg-muted-foreground'}`} />
      {connected ? '실시간' : '연결 중'}
    </span>
  )
}

function GuideDialog({ open, onOpenChange, demo }: { open: boolean; onOpenChange: (open: boolean) => void; demo: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>이렇게 써용</DialogTitle>
          <DialogDescription>친구끼리만 보는 서재예용.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm leading-relaxed">
          <li>내 이름만 읽음으로 체크할 수 있어용. 다시 누르면 빠져용.</li>
          <li>읽는 중도 나만 표시하거나 해제할 수 있어용. 내가 다 읽음으로 체크하면 읽는 중은 자동으로 빠져용.</li>
          <li>책을 추가할 때 제목을 검색하면 표지와 저자가 채워져용. 없으면 직접 입력해 주세용.</li>
          <li>다른 기기에서는 이름이랑 생일로 로그인할 수 있어용. 같은 이름이랑 생일은 하나만 돼용.</li>
          <li>새로 가입하면 관리자가 승인한 뒤에 들어올 수 있어용.</li>
          <li>모임은 10명까지예용.</li>
          {demo ? <li>지금은 이 브라우저 안에서만 저장돼용. 다른 폰이랑 맞추는 방법은 README에 있어용.</li> : <li>바꾼 내용은 다른 사람 화면에도 바로 나와용.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
