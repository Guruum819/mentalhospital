import { useEffect, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { forgetAccount, readAccounts, readWho, rememberAccount } from '@/lib/identity'
import { paletteColor } from '@/lib/palette'
import { shelfStats } from '@/lib/model'
import { useShelf } from '@/lib/store'
import type { Book, Friend } from '@/lib/types'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Confirm =
  | { kind: 'delete-friend'; friend: Friend }
  | { kind: 'delete-book'; book: Book }
  | { kind: 'clear' }
  | { kind: 'restore' }
  | null

export function ShelfScreen() {
  const shelf = useShelf()
  const [bookOpen, setBookOpen] = useState(false)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [meId, setMeId] = useState<string | null>(() => readWho())
  const [account, setAccount] = useState<'app' | 'login' | 'signup' | 'edit'>('app')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [page, setPage] = useState<'home' | 'profile' | 'settings'>('home')
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [confirming, setConfirming] = useState(false)
  const [passcodeOpen, setPasscodeOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    if (meId && shelf.data.friends.some((friend) => friend.id === meId)) rememberAccount(meId)
  }, [meId, shelf.data.friends])

  if (!shelf.ready) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-xl font-bold">서재를 펼치는 중</p>
        </div>
      </main>
    )
  }

  if (shelf.error && shelf.data.friends.length === 0 && shelf.data.books.length === 0 && !shelf.data.initialized) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <p className="text-xl font-bold">서재를 열지 못했어요</p>
          <p className="mt-2 text-sm text-muted-foreground">{shelf.error}</p>
          <Button type="button" className="mt-4 h-12 px-5 text-base" onClick={() => window.location.reload()}>
            다시 시도
          </Button>
        </div>
      </main>
    )
  }

  if (shelf.data.passcodeHash && !shelf.unlocked) {
    return <LockScreen />
  }

  const stats = shelfStats(shelf.data)

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
        setPage('home')
      }
    }
    if (confirm.kind === 'delete-book') ok = await shelf.removeBook(confirm.book.id)
    if (confirm.kind === 'clear') ok = await shelf.clearShelf()
    if (confirm.kind === 'restore') ok = await shelf.restoreStarter()
    setConfirming(false)
    if (ok) setConfirm(null)
  }

  const confirmDialog = (
    <ConfirmDialog
      open={confirm !== null}
      title={confirmTitle(confirm)}
      description={confirmText(confirm)}
      confirmLabel={confirm?.kind === 'restore' ? '되돌리기' : '삭제'}
      destructive={confirm?.kind !== 'restore'}
      pending={confirming}
      onOpenChange={(open) => {
        if (!open) setConfirm(null)
      }}
      onConfirm={() => void runConfirm()}
    />
  )

  const me = shelf.data.friends.find((friend) => friend.id === meId) ?? null
  function enter(id: string) {
    rememberAccount(id)
    setMeId(id)
    setAccount('app')
    setPage('home')
  }

  function logout() {
    const next = forgetAccount(meId ?? '')
    setMeId(next)
    setAccount(next ? 'app' : 'login')
    setPage('home')
  }

  if (!me || account !== 'app') {
    const mode = !me
      ? account === 'signup' || shelf.data.friends.length === 0
        ? 'signup'
        : 'login'
      : account === 'edit'
        ? 'edit'
        : account
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

  const detail = detailId ? shelf.data.books.find((book) => book.id === detailId) : null
  const deviceAccounts = readAccounts()
    .map((id) => shelf.data.friends.find((friend) => friend.id === id))
    .filter((friend): friend is Friend => Boolean(friend && friend.id !== me.id))

  return (
    <AppDrawer
      me={me}
      others={deviceAccounts}
      onSwitch={enter}
      onAddAccount={() => setAccount('login')}
      onProfile={() => {
        setPage('profile')
        setDetailId(null)
      }}
      onSettings={() => {
        setPage('settings')
        setDetailId(null)
      }}
    >
      {(openDrawer) => (
    <div className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col">
      {page === 'profile' ? (
        <ProfilePage me={me} onBack={() => setPage('home')} onEdit={() => setAccount('edit')} />
      ) : page === 'settings' ? (
        <SettingsPage
          onBack={() => setPage('home')}
          onSwitch={() => setAccount('login')}
          onLogout={logout}
          onDelete={() => setConfirm({ kind: 'delete-friend', friend: me })}
          onPasscode={() => setPasscodeOpen(true)}
          onGuide={() => setGuideOpen(true)}
          onClearBooks={() => setConfirm({ kind: 'clear' })}
        />
      ) : detail ? (
        <BookDetail book={detail} me={me} onBack={() => setDetailId(null)} onEdit={(item) => { setEditingBook(item); setBookOpen(true) }} />
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
          이 브라우저 데모예요. 다른 폰과 맞추려면 Firebase를 연결하세요.
        </p>
      ) : null}
      {shelf.error ? (
        <p className="border-b border-border px-4 py-2 text-sm text-destructive">{shelf.error}</p>
      ) : null}
      <p className="border-b border-border px-4 py-2 text-[13px] text-muted-foreground">
        이름을 누르면 읽음 · 책 {stats.bookCount}권 · 친구 {stats.friendCount}명
        {stats.totalCells > 0 ? ` · ${stats.readCells}/${stats.totalCells}` : ''}
      </p>
      <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
        {shelf.data.friends.map((friend) => (
          <span
            key={friend.id}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 text-[15px] font-bold"
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: paletteColor(friend.color).hex }} />
            {friend.name}
            {friend.id === me.id ? ' · 나' : ''}
          </span>
        ))}
      </div>
      <div className="pb-28">
        {shelf.data.books.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <p className="text-xl font-bold">아직 책이 없어요</p>
            <p className="mt-1 text-[15px] text-muted-foreground">오른쪽 아래 + 로 책을 올려요.</p>
          </div>
        ) : (
          shelf.data.books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onOpen={setDetailId}
              onEdit={(item) => {
                setEditingBook(item)
                setBookOpen(true)
              }}
            />
          ))
        )}
      </div>
      <button
        type="button"
        aria-label="책 추가"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-x text-white shadow-[0_4px_16px_rgba(29,155,240,0.45)]"
        onClick={() => { setEditingBook(null); setBookOpen(true) }}
      >
        <Plus className="size-7" strokeWidth={2.5} />
      </button>
      </>
      )}
      <BookDialog open={bookOpen} book={editingBook} onOpenChange={setBookOpen} />
      <PasscodeDialog open={passcodeOpen} onOpenChange={setPasscodeOpen} />
      <GuideDialog open={guideOpen} onOpenChange={setGuideOpen} demo={shelf.mode === 'demo'} />
      {confirmDialog}
    </div>
      )}
    </AppDrawer>
  )
}

function confirmTitle(confirm: Confirm) {
  if (confirm?.kind === 'delete-friend') return `${confirm.friend.name} 님을 뺄까요?`
  if (confirm?.kind === 'delete-book') return `「${confirm.book.title}」을 지울까요?`
  if (confirm?.kind === 'restore') return '처음 구성으로 되돌릴까요?'
  if (confirm?.kind === 'clear') return '서재를 비울까요?'
  return ''
}

function confirmText(confirm: Confirm) {
  if (confirm?.kind === 'delete-friend') return '읽음 체크, 읽는 중, 한줄평이 지워지고 그 색은 다시 고를 수 있어요.'
  if (confirm?.kind === 'delete-book') return '읽음, 읽는 중, 한줄평도 함께 지워져요.'
  if (confirm?.kind === 'restore') return '책 목록을 비워요. 프로필은 그대로예요.'
  if (confirm?.kind === 'clear') return '책과 한줄평만 지워요. 프로필은 그대로예요.'
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

function LockScreen() {
  const shelf = useShelf()
  const [passcode, setPasscode] = useState('')
  const [remember, setRemember] = useState(true)
  const [wrong, setWrong] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    const ok = await shelf.unlock(passcode, remember)
    setPending(false)
    setWrong(!ok)
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <h1 className="text-[28px] font-extrabold tracking-tight">교환독서</h1>
        <p className="mt-1 text-sm text-muted-foreground">친구들에게 받은 암호를 입력해요.</p>
        <Label htmlFor="lock-pass" className="mt-4">암호</Label>
        <Input
          id="lock-pass"
          type="password"
          value={passcode}
          onChange={(event) => { setPasscode(event.target.value); setWrong(false) }}
          className="mt-1.5 h-12 text-base"
          autoComplete="current-password"
          autoFocus
        />
        {wrong ? <p className="mt-2 text-sm text-destructive">암호가 맞지 않아요.</p> : null}
        <div className="mt-3 flex items-center gap-2">
          <Checkbox id="remember" checked={remember} onCheckedChange={(value) => setRemember(value === true)} />
          <Label htmlFor="remember">이 기기에 기억하기</Label>
        </div>
        <Button type="submit" className="mt-4 h-12 w-full text-base" disabled={pending}>
          들어가기
        </Button>
      </form>
    </main>
  )
}

function PasscodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const shelf = useShelf()
  const hasPasscode = Boolean(shelf.data.passcodeHash)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (next.length < 4) {
      setMessage('암호는 네 글자 이상으로 해 주세요.')
      return
    }
    if (next !== again) {
      setMessage('암호 확인이 같지 않아요.')
      return
    }
    setPending(true)
    const ok = await shelf.setPasscode(next, hasPasscode ? current : null)
    setPending(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="grid gap-3" key={String(open)}>
          <DialogHeader>
            <DialogTitle>그룹 암호</DialogTitle>
            <DialogDescription>링크를 연 사람에게 한 번 더 묻는 잠금이에요. 책을 암호화하지는 않아요.</DialogDescription>
          </DialogHeader>
          {hasPasscode ? (
            <Input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} placeholder="지금 암호" className="h-12 text-base" autoComplete="current-password" />
          ) : null}
          <Input type="password" value={next} onChange={(event) => setNext(event.target.value)} placeholder="새 암호" className="h-12 text-base" autoComplete="new-password" />
          <Input type="password" value={again} onChange={(event) => setAgain(event.target.value)} placeholder="새 암호 확인" className="h-12 text-base" autoComplete="new-password" />
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <DialogFooter className="mx-0 mb-0">
            {hasPasscode ? (
              <Button
                type="button"
                variant="destructive"
                className="h-12 text-base sm:mr-auto"
                disabled={pending}
                onClick={() => void shelf.setPasscode(null, current).then((ok) => { if (ok) onOpenChange(false) })}
              >
                암호 없애기
              </Button>
            ) : null}
            <Button type="submit" className="h-12 text-base" disabled={pending}>저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function GuideDialog({ open, onOpenChange, demo }: { open: boolean; onOpenChange: (open: boolean) => void; demo: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>이렇게 써요</DialogTitle>
          <DialogDescription>친구끼리만 보는 서재예요.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm leading-relaxed">
          <li>이름 칸을 누르면 그 친구가 읽은 거예요. 다시 누르면 빠져요.</li>
          <li>지금 읽는 중은 카드 아래 버튼에서 고르고, 해제는 한 번이면 돼요. 다 읽음으로 체크하면 읽는 중은 자동으로 빠져요.</li>
          <li>책을 추가할 때 제목을 검색하면 표지와 저자가 채워져요. 없으면 직접 입력해요.</li>
          <li>다른 폰에서는 이름과 생일로 로그인해요. 같은 이름과 생일은 하나만 만들 수 있어요.</li>
          <li>모임은 10명까지예요.</li>
          {demo ? <li>지금은 이 브라우저 안에서만 저장돼요. 다른 폰과 맞추는 방법은 README에 있어요.</li> : <li>바꾼 내용은 다른 사람 화면에도 바로 나타나요.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
