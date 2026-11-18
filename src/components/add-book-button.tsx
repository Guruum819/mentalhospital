import { Plus } from 'lucide-react'

export function AddBookButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="책 추가"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-x text-white shadow-[0_4px_16px_rgba(29,155,240,0.45)]"
      onClick={onClick}
    >
      <Plus className="size-7" strokeWidth={2.5} />
    </button>
  )
}
