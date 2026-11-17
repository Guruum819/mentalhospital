import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { APP_BUILD_TIME, fetchDeployedBuildTime, formatBuildLabel, isNewerBuild, reloadLatestBuild } from '@/lib/app-build'
import { readWho } from '@/lib/identity'
import { MAX_REVIEW } from '@/lib/model'
import { formatPatchDate, patchNotesNewestFirst } from '@/lib/patch-notes'
import { useShelf } from '@/lib/store'
import type { Friend } from '@/lib/types'
import { Avatar } from '@/components/avatar-editor'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EdgeBack } from '@/components/edge-back'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SettingsPage({
  onBack,
  onSwitch,
  onLogout,
  onDelete,
  onGuide,
  onClearBooks,
  adminOnly = false,
}: {
  onBack: () => void
  onSwitch: () => void
  onLogout: () => void
  onDelete: () => void
  onGuide: () => void
  onClearBooks: () => void
  /** Admin session with no member logged in. */
  adminOnly?: boolean
}) {
  const shelf = useShelf()
  const [adminOpen, setAdminOpen] = useState(false)
  const [panel, setPanel] = useState<'root' | 'patches' | 'board' | string>('root')
  const [boardFromAdmin, setBoardFromAdmin] = useState(false)
  const [newerBuild, setNewerBuild] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const buildLabel = formatBuildLabel(APP_BUILD_TIME)

  useEffect(() => {
    let cancel = false
    void fetchDeployedBuildTime()
      .then((remote) => {
        if (!cancel && remote && isNewerBuild(APP_BUILD_TIME, remote)) setNewerBuild(true)
      })
      .catch(() => undefined)
    return () => {
      cancel = true
    }
  }, [])

  async function refreshBuild() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await reloadLatestBuild()
    } catch {
      toast.error('새 버전을 불러오지 못했어용.')
      setRefreshing(false)
    }
  }

  function openBoard(fromAdmin: boolean) {
    setBoardFromAdmin(fromAdmin)
    setAdminOpen(false)
    setPanel('board')
  }

  const openRequestCount = shelf.data.posts.filter((post) => !post.done).length
  const requestDetail = openRequestCount > 0 ? `답변 전 ${openRequestCount}개` : '답변 전인 글이 없어용'

  if (panel === 'patches') {
    return <PatchList onBack={() => setPanel('root')} onOpen={(date) => setPanel(date)} />
  }

  if (panel !== 'root' && panel !== 'board') {
    return <PatchDay date={panel} onBack={() => setPanel('patches')} />
  }

  if (panel === 'board') {
    return (
      <RequestBoard
        onBack={() => {
          setPanel('root')
          if (boardFromAdmin) setAdminOpen(true)
        }}
      />
    )
  }

  if (adminOpen || (adminOnly && !shelf.admin)) {
    return <AdminScreen onBack={() => (adminOnly && !shelf.admin ? onBack() : setAdminOpen(false))} onOpenBoard={() => openBoard(true)} />
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="relative flex h-14 items-center">
          <button type="button" className="grid size-11 place-items-center" onClick={onBack} aria-label="뒤로">
            <ChevronLeft className="size-6" />
          </button>
          <h1 className="pointer-events-none absolute inset-x-14 text-center text-[17px] font-bold">설정</h1>
        </div>
      </header>
      <SettingsGroup title="안내">
        <SettingsRow label="사용 안내" onClick={onGuide} />
        <SettingsRow label="패치노트" onClick={() => setPanel('patches')} />
        <SettingsRow
          label="새 버전으로 새로고침"
          detail={
            buildLabel ? (
              <span className="block">
                지금 버전: {buildLabel}
                {newerBuild ? <span className="mt-0.5 block font-medium text-x">새 버전이 있어용!</span> : null}
                {refreshing ? <span className="mt-0.5 block">불러오는 중</span> : null}
              </span>
            ) : null
          }
          onClick={() => void refreshBuild()}
        />
        <SettingsRow label="이거 수정해 주세요!" onClick={() => openBoard(false)} />
      </SettingsGroup>
      {adminOnly ? null : (
        <SettingsGroup title="계정">
          <SettingsRow label="계정 전환" detail="이름이랑 생일로 다른 프로필에 들어가용" onClick={onSwitch} />
          <SettingsRow label="로그아웃" detail="이 폰에서 이 계정만 빠져용" onClick={onLogout} />
        </SettingsGroup>
      )}
      {shelf.admin ? (
        <SettingsGroup title="관리">
          <SettingsRow label="멤버 관리" detail="가입 승인이랑 강퇴를 할 수 있어용" onClick={() => setAdminOpen(true)} />
          <SettingsRow label="수정 요청 보기" detail={requestDetail} onClick={() => openBoard(false)} />
        </SettingsGroup>
      ) : null}
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-muted-foreground">모임은 10명까지예용.</p>
        {shelf.admin ? <p className="mt-2 text-xs font-bold">관리자로 보는 중</p> : null}
        <button type="button" className="mt-3 text-xs text-muted-foreground underline" onClick={() => setAdminOpen(true)}>
          관리자
        </button>
      </div>
      <div className="mt-6 border-t border-border pb-8">
        {shelf.admin ? (
          <SettingsRow label="책 비우기" detail="프로필은 두고 책이랑 한 줄 평만 지워용" danger onClick={onClearBooks} />
        ) : null}
        {adminOnly ? null : (
          <SettingsRow label="계정 삭제" detail="읽은 기록이랑 읽는 중, 한 줄 평은 사라져용. 올린 책은 남아용." danger onClick={onDelete} />
        )}
      </div>
    </div>
  )
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-4 pt-5 pb-1 text-[13px] font-medium text-muted-foreground">{title}</h2>
      <div className="border-t border-border">{children}</div>
    </section>
  )
}

function SettingsRow({
  label,
  detail,
  danger,
  onClick,
}: {
  label: string
  detail?: ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`flex min-h-14 w-full flex-col justify-center border-b px-4 py-3 text-left ${danger ? 'text-destructive' : ''}`}
      onClick={onClick}
    >
      <span className="text-base font-medium">{label}</span>
      {detail ? <span className="text-sm text-muted-foreground">{detail}</span> : null}
    </button>
  )
}

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="relative flex h-14 items-center">
        <button type="button" className="grid size-11 place-items-center" onClick={onBack} aria-label="뒤로">
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-[17px] font-bold">{title}</h1>
      </div>
    </header>
  )
}

function PatchList({ onBack, onOpen }: { onBack: () => void; onOpen: (date: string) => void }) {
  const notes = patchNotesNewestFirst()
  return (
    <EdgeBack onBack={onBack}>
      <div className="min-h-dvh bg-background">
        <ScreenHeader title="패치노트" onBack={onBack} />
        <div className="grid">
          {notes.map((note) => (
            <SettingsRow key={note.date} label={formatPatchDate(note.date)} onClick={() => onOpen(note.date)} />
          ))}
        </div>
      </div>
    </EdgeBack>
  )
}

function PatchDay({ date, onBack }: { date: string; onBack: () => void }) {
  const note = patchNotesNewestFirst().find((item) => item.date === date)
  return (
    <EdgeBack onBack={onBack}>
      <div className="min-h-dvh bg-background">
        <ScreenHeader title={formatPatchDate(date)} onBack={onBack} />
        {note ? (
          <ul className="px-4 py-4 space-y-3">
            {note.lines.map((line) => (
              <li key={line} className="text-[15px] leading-snug">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-[15px] text-muted-foreground">이 날짜의 노트가 없어용.</p>
        )}
      </div>
    </EdgeBack>
  )
}

function RequestBoard({ onBack }: { onBack: () => void }) {
  const shelf = useShelf()
  const [text, setText] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [pending, setPending] = useState(false)
  const meId = readWho()
  const chars = Array.from(text).length

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending || !text.trim() || chars > MAX_REVIEW) return
    setPending(true)
    const ok = await shelf.addRequest(text, anonymous)
    setPending(false)
    if (ok) {
      setText('')
      setAnonymous(false)
    }
  }

  const me = shelf.data.friends.find((friend) => friend.id === meId) ?? null

  return (
    <EdgeBack onBack={onBack}>
      <div className="min-h-dvh bg-background">
        <ScreenHeader title="이거 수정해 주세요!" onBack={onBack} />
        {me && !shelf.admin ? (
          <form onSubmit={submit} className="flex gap-3 border-b border-border px-4 py-3">
            <Avatar name={me.name} photo={me.photo} size={40} />
            <div className="min-w-0 flex-1">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={MAX_REVIEW}
                rows={3}
                placeholder="이렇게 바꿔 주세용"
                className="w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[15px]">
                  <Checkbox checked={anonymous} onCheckedChange={(value) => setAnonymous(value === true)} />
                  익명으로 쓰기
                </label>
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  {chars}/{MAX_REVIEW}
                </span>
              </div>
              <div className="mt-2 flex justify-end">
                <Button type="submit" className="h-9 bg-x px-4 text-x-ink hover:bg-x/90" disabled={pending || !text.trim() || chars > MAX_REVIEW}>
                  올리기
                </Button>
              </div>
            </div>
          </form>
        ) : !shelf.admin ? (
          <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground">멤버로 들어가 있지 않아서 글은 못 올리고, 답글은 달 수 있어용.</p>
        ) : null}
        <ul>
        {shelf.data.posts.length === 0 ? (
          <li className="px-4 py-8 text-[15px] text-muted-foreground">아직 요청이 없어용.</li>
        ) : (
          shelf.data.posts.map((post) => {
            const author = shelf.data.friends.find((friend) => friend.id === post.friendId)
            const showName = shelf.admin || !post.anonymous
            const mine = post.friendId === meId
            return (
              <li key={post.id} className="border-b border-border px-4 py-3">
                <div className="flex gap-3">
                  {showName ? (
                    <Avatar name={author?.name ?? '?'} photo={author?.photo ?? null} size={40} />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-muted-foreground">익</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="truncate text-[15px] font-bold">{showName ? (author?.name ?? '알 수 없어용') : '익명'}</p>
                      <time className="shrink-0 text-[13px] text-muted-foreground">{formatWhen(post.createdAt)}</time>
                      {post.done ? <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[12px] font-bold text-background">완료</span> : null}
                    </div>
                    {shelf.admin && post.anonymous ? <p className="text-[13px] text-muted-foreground">멤버에게는 익명으로 보여용</p> : null}
                    <p className="mt-1 text-[15px] leading-snug whitespace-pre-wrap">{post.text}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {shelf.admin ? (
                        <button type="button" className="h-11 px-2 text-[15px] font-medium text-muted-foreground" onClick={() => setReplyTo(replyTo === post.id ? null : post.id)}>
                          답글
                        </button>
                      ) : null}
                      {shelf.admin ? (
                        <button type="button" className="h-11 px-2 text-[15px] font-medium text-muted-foreground" onClick={() => void shelf.setRequestDone(post.id, !post.done)}>
                          {post.done ? '완료 취소' : '완료'}
                        </button>
                      ) : null}
                      {mine || shelf.admin ? (
                        <button type="button" className="h-11 px-2 text-[15px] font-medium text-muted-foreground" onClick={() => void shelf.deleteRequest(post.id)}>
                          삭제
                        </button>
                      ) : null}
                    </div>
                    {replyTo === post.id ? (
                      <form
                        className="mt-1"
                        onSubmit={(event) => {
                          event.preventDefault()
                          void shelf.replyRequest(post.id, reply).then((ok) => {
                            if (ok) {
                              setReply('')
                              setReplyTo(null)
                            }
                          })
                        }}
                      >
                        <textarea
                          value={reply}
                          onChange={(event) => setReply(event.target.value)}
                          maxLength={MAX_REVIEW}
                          rows={2}
                          placeholder="관리자 답글"
                          className="w-full resize-none bg-transparent text-[15px] outline-none"
                        />
                        <Button type="submit" className="h-9 bg-x px-4 text-x-ink" disabled={!reply.trim()}>
                          답글
                        </Button>
                      </form>
                    ) : null}
                    {post.replies.length > 0 ? (
                      <ul className="mt-2 border-l border-border pl-3">
                        {post.replies.map((item) => (
                          <li key={item.id} className="py-2">
                            <div className="flex items-baseline gap-2">
                              <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[11px] font-bold text-background">관리자</span>
                              <time className="text-[13px] text-muted-foreground">{formatWhen(item.createdAt)}</time>
                            </div>
                            <p className="mt-1 text-[15px] leading-snug whitespace-pre-wrap">{item.text}</p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })
        )}
        </ul>
      </div>
    </EdgeBack>
  )
}

function formatWhen(at: number) {
  return new Intl.DateTimeFormat('ko', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at)
}

function AdminScreen({ onBack, onOpenBoard }: { onBack: () => void; onOpenBoard: () => void }) {
  const shelf = useShelf()
  const configured = Boolean(shelf.data.admin)
  const pendingFriends = shelf.data.friends.filter((friend) => !friend.approved)

  return (
    <EdgeBack onBack={onBack}>
      <div className="min-h-dvh bg-background">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
          <div className="relative flex h-14 items-center">
            <button type="button" className="grid size-11 place-items-center" onClick={onBack} aria-label="뒤로">
              <ChevronLeft className="size-6" />
            </button>
            <h1 className="pointer-events-none absolute inset-x-14 text-center text-[17px] font-bold">관리자</h1>
          </div>
        </header>
        <div className="px-4 py-4">
          {!configured ? <AdminSetup /> : shelf.admin ? <AdminTools pending={pendingFriends} onOpenBoard={onOpenBoard} /> : <AdminLogin />}
        </div>
      </div>
    </EdgeBack>
  )
}

function AdminSetup() {
  const shelf = useShelf()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    await shelf.setupAdmin(password, again)
    setPending(false)
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <h2 className="text-xl font-bold">관리자 암호 만들기</h2>
      <p className="text-sm text-muted-foreground">처음 한 번만 정해용. 가입 승인이랑 게시판 관리에 써용.</p>
      <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="새 암호" className="h-12 text-base" autoComplete="new-password" />
      <Input type="password" value={again} onChange={(event) => setAgain(event.target.value)} placeholder="새 암호 확인" className="h-12 text-base" autoComplete="new-password" />
      <Button type="submit" className="h-12 text-base" disabled={pending}>
        암호 저장
      </Button>
    </form>
  )
}

function AdminLogin() {
  const shelf = useShelf()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    await shelf.loginAdmin(password)
    setPending(false)
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <h2 className="text-xl font-bold">관리자 로그인</h2>
      <p className="text-sm text-muted-foreground">관리자 암호를 입력해 주세용.</p>
      <Label htmlFor="admin-password">암호</Label>
      <Input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 text-base" autoComplete="current-password" />
      <Button type="submit" className="h-12 text-base" disabled={pending}>
        들어가기
      </Button>
    </form>
  )
}

function AdminTools({
  pending,
  onOpenBoard,
}: {
  pending: { id: string; name: string; birthday: string }[]
  onOpenBoard: () => void
}) {
  const shelf = useShelf()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [kicking, setKicking] = useState<Friend | null>(null)
  const [kickBusy, setKickBusy] = useState(false)
  const members = shelf.data.friends.filter((friend) => friend.approved)
  const openRequestCount = shelf.data.posts.filter((post) => !post.done).length

  async function kick() {
    if (!kicking || kickBusy) return
    setKickBusy(true)
    const ok = await shelf.removeFriend(kicking.id)
    setKickBusy(false)
    if (ok) {
      toast.success('내보냈어용.')
      setKicking(null)
    }
  }

  return (
    <div className="grid gap-8">
      <button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-border py-3 text-left" onClick={onOpenBoard}>
        <span className="font-bold">수정 요청 보기</span>
        <span className="text-sm text-muted-foreground">{openRequestCount > 0 ? `답변 전 ${openRequestCount}개` : '답변 전인 글이 없어용'}</span>
      </button>
      <section>
        <h2 className="pb-1 text-[13px] font-medium text-muted-foreground">가입 신청</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">기다리는 신청이 없어용.</p>
        ) : (
          <ul className="mt-2 border-t border-border">
            {pending.map((friend) => (
              <li key={friend.id} className="flex items-center justify-between gap-3 border-b py-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{friend.name}</p>
                  <p className="text-sm text-muted-foreground">{friend.birthday}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" className="h-11 px-3" onClick={() => void shelf.approveFriend(friend.id)}>
                    승인
                  </Button>
                  <Button type="button" variant="outline" className="h-11 px-3" onClick={() => void shelf.removeFriend(friend.id)}>
                    거절
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="pb-1 text-[13px] font-medium text-muted-foreground">멤버</h2>
        <p className="text-sm text-muted-foreground">강퇴하면 읽은 기록이랑 한 줄 평은 사라져용. 올린 책은 남아용.</p>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">승인된 멤버가 없어용.</p>
        ) : (
          <ul className="mt-2 border-t border-border">
            {members.map((friend) => (
              <li key={friend.id} className="flex items-center justify-between gap-3 border-b py-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{friend.name}</p>
                  <p className="text-sm text-muted-foreground">{friend.birthday}</p>
                </div>
                <Button type="button" variant="outline" className="h-11 shrink-0 px-3 text-destructive" onClick={() => setKicking(friend)}>
                  강퇴
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          void shelf.changeAdmin(current, next, again).finally(() => setBusy(false))
        }}
      >
        <h2 className="pb-1 text-[13px] font-medium text-muted-foreground">암호</h2>
        <Input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} placeholder="지금 암호" className="h-12 text-base" autoComplete="current-password" />
        <Input type="password" value={next} onChange={(event) => setNext(event.target.value)} placeholder="새 암호" className="h-12 text-base" autoComplete="new-password" />
        <Input type="password" value={again} onChange={(event) => setAgain(event.target.value)} placeholder="새 암호 확인" className="h-12 text-base" autoComplete="new-password" />
        <Button type="submit" className="h-12 text-base" disabled={busy}>
          암호 저장
        </Button>
      </form>
      <Button type="button" variant="outline" className="h-12 text-base" onClick={shelf.logoutAdmin}>
        관리자 로그아웃
      </Button>
      <ConfirmDialog
        open={kicking !== null}
        title={kicking ? `${kicking.name}님을 정말 내보낼 거예용?` : ''}
        description="읽은 기록이랑 한 줄 평도 같이 사라져용. 이 사람이 올린 책은 서재에 그대로 남아용."
        confirmLabel="강퇴"
        destructive
        pending={kickBusy}
        onOpenChange={(open) => {
          if (!open) setKicking(null)
        }}
        onConfirm={() => void kick()}
      />
    </div>
  )
}
