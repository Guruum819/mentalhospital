import { useEffect, useRef, useState, type FormEvent } from 'react'
import { firstFreeColor, PALETTE } from '@/lib/palette'
import { useShelf } from '@/lib/store'
import type { Friend } from '@/lib/types'
import { AvatarEditor } from '@/components/avatar-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ProfileForm({
  friend,
  submitLabel,
  onCancel,
  onComplete,
  onDelete,
}: {
  friend: Friend | null
  submitLabel: string
  onCancel?: () => void
  onComplete: (id: string) => void
  onDelete?: () => void
}) {
  const shelf = useShelf()
  const [name, setName] = useState(friend?.name ?? '')
  const [birthday, setBirthday] = useState(friend?.birthday ?? '')
  const [color, setColor] = useState(friend?.color ?? firstFreeColor(shelf.data.friends.map((item) => item.color)))
  const [photo, setPhoto] = useState<string | null>(friend?.photo ?? null)
  const [pending, setPending] = useState(false)
  const friendsRef = useRef(shelf.data.friends)
  friendsRef.current = shelf.data.friends
  const full = !friend && shelf.data.friends.length >= PALETTE.length

  useEffect(() => {
    const friends = friendsRef.current
    setName(friend?.name ?? '')
    setBirthday(friend?.birthday ?? '')
    setColor(friend?.color ?? firstFreeColor(friends.map((item) => item.color)))
    setPhoto(friend?.photo ?? null)
  }, [friend])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending || full) return
    setPending(true)
    if (friend) {
      const ok = await shelf.updateFriend(friend.id, name, color, photo, birthday)
      setPending(false)
      if (ok) onComplete(friend.id)
      return
    }
    const id = await shelf.addFriend(name, color, photo, birthday)
    setPending(false)
    if (id) onComplete(id)
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <AvatarEditor photo={photo} name={name} onChange={setPhoto} />
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">이름</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-12 text-base"
          maxLength={20}
          autoComplete="nickname"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-birthday">생일</Label>
        <Input
          id="profile-birthday"
          type="date"
          value={birthday}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(event) => setBirthday(event.target.value)}
          className="h-12 text-base"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>색</Label>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((swatch) => {
            const owner = shelf.data.friends.find((item) => item.color === swatch.id && item.id !== friend?.id)
            const selected = color === swatch.id
            return (
              <button
                key={swatch.id}
                type="button"
                disabled={Boolean(owner)}
                aria-label={owner ? `${swatch.label}, ${owner.name} 사용 중` : swatch.label}
                aria-pressed={selected}
                className="size-11 rounded-full disabled:opacity-30"
                style={{
                  backgroundColor: swatch.hex,
                  boxShadow: selected ? '0 0 0 2px var(--background), 0 0 0 4px #1d9bf0' : undefined,
                }}
                onClick={() => setColor(swatch.id)}
              />
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">흐린 색은 이미 쓰이고 있어요. 색은 10개, 사람도 10명까지입니다.</p>
      </div>
      {full ? (
        <p className="rounded-2xl bg-secondary px-3 py-3 text-sm">
          모임은 10명까지예요. 프로필을 지우면 빈자리와 그 색을 다시 쓸 수 있어요.
        </p>
      ) : null}
      <div className="grid gap-2">
        <Button type="submit" className="h-12 text-base" disabled={pending || full}>
          {pending ? '저장 중' : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" className="h-12 text-base" onClick={onCancel}>
            취소
          </Button>
        ) : null}
        {onDelete ? (
          <Button type="button" variant="destructive" className="h-12 text-base" onClick={onDelete}>
            프로필 삭제
          </Button>
        ) : null}
        {!friend ? (
          <p className="text-center text-xs text-muted-foreground">다른 기기에서는 이름과 생일로 로그인할 수 있어요.</p>
        ) : null}
      </div>
    </form>
  )
}
