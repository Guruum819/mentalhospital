import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { coverLayout, cropAvatar, loadImage } from '@/lib/avatar'
import { Button } from '@/components/ui/button'

export function Avatar({
  name,
  photo,
  size = 40,
}: {
  name: string
  photo: string | null
  size?: number
}) {
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1) || '?'}
    </span>
  )
}

export function AvatarEditor({
  photo,
  name,
  onChange,
}: {
  photo: string | null
  name: string
  onChange: (photo: string | null) => void
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const layout = image ? coverLayout(image, offset, zoom) : null

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      const next = await loadImage(file)
      setImage(next)
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    } catch {
      toast.error('이 사진은 열 수 없어용. 다른 사진을 골라 주세용.')
    }
  }

  function confirmCrop() {
    if (!image) return
    const url = cropAvatar(image, offset, zoom)
    if (!url) {
      toast.error('사진을 자르지 못했어용.')
      return
    }
    onChange(url)
    setImage(null)
  }

  return (
    <div className="space-y-3">
      {image && layout ? (
        <div className="space-y-3">
          <div
            className="relative mx-auto size-60 touch-none overflow-hidden rounded-full bg-muted"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
            }}
            onPointerMove={(event) => {
              if (!drag.current || !image) return
              const next = coverLayout(image, {
                x: drag.current.ox + event.clientX - drag.current.x,
                y: drag.current.oy + event.clientY - drag.current.y,
              }, zoom)
              setOffset(next.offset)
            }}
            onPointerUp={() => {
              drag.current = null
            }}
          >
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{ width: layout.width, height: layout.height, left: layout.left, top: layout.top }}
            />
          </div>
          <label className="block text-sm text-muted-foreground">
            확대
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-1 h-11 w-full"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-12 text-base" onClick={() => setImage(null)}>
              취소
            </Button>
            <Button type="button" className="h-12 text-base" onClick={confirmCrop}>
              이 사진으로
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar name={name || '?'} photo={photo} size={72} />
          <div className="grid flex-1 gap-2">
            <label className="flex h-12 cursor-pointer items-center justify-center rounded-lg border bg-card text-sm font-medium">
              앨범에서 고르기
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  void onFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </label>
            {photo ? (
              <Button type="button" variant="outline" className="h-11" onClick={() => onChange(null)}>
                사진 빼기
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
