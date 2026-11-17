import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Settings, UserRound } from 'lucide-react'
import { paletteColor } from '@/lib/palette'
import type { Friend } from '@/lib/types'
import { Avatar } from '@/components/avatar-editor'

const WIDTH = 300

type Drag = {
  startX: number
  startY: number
  origin: number
  axis: 'undecided' | 'x' | 'y'
  pointerId: number
  target: HTMLElement
}

export function AppDrawer({
  me,
  others,
  onSwitch,
  onAddAccount,
  onProfile,
  onSettings,
  children,
}: {
  me: Friend
  others: Friend[]
  onSwitch: (id: string) => void
  onAddAccount: () => void
  onProfile: () => void
  onSettings: () => void
  children: (openDrawer: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<Drag | null>(null)
  const moved = useRef(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  function shownNow() {
    return drag.current?.axis === 'x' ? offset : open ? WIDTH : 0
  }

  function begin(event: ReactPointerEvent, origin: number) {
    moved.current = false
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin,
      axis: 'undecided',
      pointerId: event.pointerId,
      target: event.currentTarget as HTMLElement,
    }
  }

  function move(event: ReactPointerEvent) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    if (current.axis === 'undecided') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.current = null
        return
      }
      current.axis = 'x'
      moved.current = true
      setDragging(true)
      current.target.setPointerCapture(event.pointerId)
    }
    setOffset(Math.min(WIDTH, Math.max(0, current.origin + dx)))
  }

  function end(event: ReactPointerEvent) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const wasDrag = current.axis === 'x'
    drag.current = null
    setDragging(false)
    if (!wasDrag) return
    setOffset((value) => {
      const shouldOpen = value > WIDTH * 0.35
      setOpen(shouldOpen)
      return shouldOpen ? WIDTH : 0
    })
  }

  function toggle(next: boolean) {
    setOpen(next)
    setOffset(next ? WIDTH : 0)
  }

  const shown = dragging ? offset : open ? WIDTH : 0

  return (
    <div className="relative min-h-dvh">
      {children(() => toggle(true))}
      <div
        aria-hidden
        className="fixed top-0 bottom-0 left-0 z-40 w-4"
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          if (open) return
          begin(event, 0)
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <button
        type="button"
        aria-label="메뉴 닫기"
        className="fixed inset-0 z-40 bg-black/40"
        style={{
          opacity: shown / WIDTH,
          pointerEvents: shown > 4 ? 'auto' : 'none',
          transition: dragging ? 'none' : 'opacity 200ms ease',
        }}
        onPointerDown={(event) => begin(event, shownNow())}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onClick={() => {
          if (moved.current) return
          toggle(false)
        }}
      />
      <aside
        className="fixed top-0 bottom-0 left-0 z-50 flex w-[300px] flex-col bg-background shadow-2xl"
        style={{
          transform: `translateX(${shown - WIDTH}px)`,
          transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        onPointerDown={(event) => begin(event, shownNow())}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <Avatar name={me.name} photo={me.photo} size={56} />
          <p className="mt-3 text-xl font-extrabold tracking-tight">{me.name}</p>
          <div className="mt-4 flex items-center gap-3">
              {others.map((friend) => (
                <button
                  key={friend.id}
                  type="button"
                  aria-label={`${friend.name}(으)로 전환`}
                  className="rounded-full"
                  style={{ boxShadow: `0 0 0 2px ${paletteColor(friend.color).hex}` }}
                  onClick={() => {
                    onSwitch(friend.id)
                    toggle(false)
                  }}
                >
                  <Avatar name={friend.name} photo={friend.photo} size={40} />
                </button>
              ))}
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full border text-xl"
                aria-label="계정 추가"
                onClick={() => {
                  toggle(false)
                  onAddAccount()
                }}
              >
                +
              </button>
            </div>
        </div>
        <nav className="mt-5 border-t">
          <button type="button" className="flex h-14 w-full items-center gap-4 px-4 text-left text-lg" onClick={() => { toggle(false); onProfile() }}>
            <UserRound className="size-5" /> 프로필
          </button>
          <button type="button" className="flex h-14 w-full items-center gap-4 px-4 text-left text-lg" onClick={() => { toggle(false); onSettings() }}>
            <Settings className="size-5" /> 설정
          </button>
        </nav>
      </aside>
    </div>
  )
}
