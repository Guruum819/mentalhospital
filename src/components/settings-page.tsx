import { ChevronLeft } from 'lucide-react'

export function SettingsPage({
  onBack,
  onSwitch,
  onLogout,
  onDelete,
  onPasscode,
  onGuide,
  onClearBooks,
}: {
  onBack: () => void
  onSwitch: () => void
  onLogout: () => void
  onDelete: () => void
  onPasscode: () => void
  onGuide: () => void
  onClearBooks: () => void
}) {
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
      <div className="grid">
        <SettingsRow label="계정 전환" detail="이름과 생일로 다른 프로필에 들어가요" onClick={onSwitch} />
        <SettingsRow label="로그아웃" detail="이 기기에서 이 계정만 빠져요" onClick={onLogout} />
        <SettingsRow label="계정 삭제" detail="체크와 한줄평이 지워지고 색이 비어요" danger onClick={onDelete} />
        <SettingsRow label="그룹 암호" onClick={onPasscode} />
        <SettingsRow label="사용 안내" onClick={onGuide} />
        <SettingsRow label="책 비우기" detail="프로필은 그대로 두고 책만 지워요" onClick={onClearBooks} />
      </div>
      <p className="px-4 py-6 text-center text-xs text-muted-foreground">모임은 10명까지예요.</p>
    </div>
  )
}

function SettingsRow({
  label,
  detail,
  danger,
  onClick,
}: {
  label: string
  detail?: string
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
