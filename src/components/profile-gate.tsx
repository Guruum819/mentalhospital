import { useState, type FormEvent } from 'react'
import { PALETTE } from '@/lib/palette'
import { findProfile } from '@/lib/model'
import { useShelf } from '@/lib/store'
import type { Friend } from '@/lib/types'
import { ProfileForm } from '@/components/profile-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ProfileGate({
  mode,
  me,
  onLogin,
  onCancel,
  onDelete,
  onMode,
}: {
  mode: 'login' | 'signup' | 'edit'
  me: Friend | null
  onLogin: (id: string) => void
  onCancel?: () => void
  onDelete: (friend: Friend) => void
  onMode: (mode: 'login' | 'signup') => void
}) {
  const shelf = useShelf()
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [error, setError] = useState<string | null>(null)
  const full = shelf.data.friends.length >= PALETTE.length
  const nobody = shelf.data.friends.length === 0

  function login(event: FormEvent) {
    event.preventDefault()
    const found = findProfile(shelf.data.friends, name, birthday)
    if (!found) {
      setError('이름과 생일이 맞는 프로필이 없어요.')
      return
    }
    onLogin(found.id)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
      <h1 className="font-serif text-3xl font-bold">교환독서</h1>
      {mode === 'login' && !nobody ? (
        <form onSubmit={login} className="mt-6 grid gap-4">
          <div>
            <h2 className="font-serif text-xl">로그인</h2>
            <p className="mt-1 text-sm text-muted-foreground">이 폰에서 쓸 이름과 생일을 입력해요.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-name">이름</Label>
            <Input id="login-name" value={name} onChange={(event) => setName(event.target.value)} className="h-12 text-base" autoComplete="username" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-birthday">생일</Label>
            <Input id="login-birthday" type="date" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setBirthday(event.target.value)} className="h-12 text-base" required />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="h-12 text-base">들어가기</Button>
          {full ? (
            <p className="text-sm text-muted-foreground">모임은 10명까지예요. 새 프로필은 누군가를 지운 뒤에 만들 수 있어요.</p>
          ) : (
            <button type="button" className="h-11 text-sm text-muted-foreground underline" onClick={() => onMode('signup')}>
              처음이면 프로필 만들기
            </button>
          )}
          {onCancel ? (
            <Button type="button" variant="outline" className="h-12 text-base" onClick={onCancel}>돌아가기</Button>
          ) : null}
        </form>
      ) : (
        <div className="mt-6">
          <h2 className="font-serif text-xl">{mode === 'edit' ? '프로필 수정' : '프로필 만들기'}</h2>
          <div className="mt-4">
            <ProfileForm
              friend={mode === 'edit' ? me : null}
              submitLabel={mode === 'edit' ? '저장' : '시작하기'}
              onCancel={mode === 'edit' ? onCancel : !nobody ? () => onMode('login') : onCancel}
              onComplete={onLogin}
              onDelete={mode === 'edit' && me ? () => onDelete(me) : undefined}
            />
          </div>
        </div>
      )}
    </main>
  )
}
