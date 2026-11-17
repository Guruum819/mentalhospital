import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

/** Left-edge swipe to the right, same as the book screen's back gesture. */
export function EdgeBack({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const [shift, setShift] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; y: number; active: boolean; pointerId: number } | null>(null)

  function finish(event: ReactPointerEvent) {
    const current = drag.current
    drag.current = null
    setDragging(false)
    if (!current?.active) {
      setShift(0)
      return
    }
    if (event.clientX - current.x > 72) onBack()
    setShift(0)
  }

  return (
    <div style={{ transform: shift ? `translateX(${Math.min(shift, 160)}px)` : undefined, transition: dragging ? 'none' : 'transform 180ms ease' }}>
      {children}
      <div
        aria-hidden
        className="fixed top-0 bottom-0 left-0 z-30 w-4"
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY, active: false, pointerId: event.pointerId }
        }}
        onPointerMove={(event) => {
          const current = drag.current
          if (!current || current.pointerId !== event.pointerId) return
          const dx = event.clientX - current.x
          const dy = event.clientY - current.y
          if (!current.active) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
            if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) {
              drag.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
              return
            }
            current.active = true
            setDragging(true)
            event.currentTarget.setPointerCapture(event.pointerId)
          }
          setShift(Math.max(0, dx))
        }}
        onPointerUp={finish}
        onPointerCancel={() => {
          drag.current = null
          setDragging(false)
          setShift(0)
        }}
      />
    </div>
  )
}
