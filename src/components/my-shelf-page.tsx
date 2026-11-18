import { useState } from 'react'
import { ChevronLeft, ImageOff } from 'lucide-react'
import { resolvedHolderId } from '@/lib/model'
import type { Book, ReadMap } from '@/lib/types'
import { TextTabs } from '@/components/text-tabs'
import { AddBookButton } from '@/components/add-book-button'

type Tab = 'bought' | 'holding' | 'read'

const TABS: [Tab, string][] = [
  ['bought', '구매한 책'],
  ['holding', '보유한 책'],
  ['read', '읽은 책'],
]

export function MyShelfPage({
  meId,
  title,
  books,
  reads,
  approvedIds,
  onBack,
  onOpenBook,
  onAdd,
}: {
  meId: string
  title: string
  books: readonly Book[]
  reads: ReadMap
  approvedIds: ReadonlySet<string>
  onBack: () => void
  onOpenBook: (bookId: string) => void
  onAdd?: () => void
}) {
  const [tab, setTab] = useState<Tab>('bought')
  const bought = books.filter((book) => book.buyerId === meId)
  const holding = books.filter((book) => resolvedHolderId(book, approvedIds) === meId)
  const read = books.filter((book) => reads[book.id]?.[meId])
  const shown = tab === 'bought' ? bought : tab === 'holding' ? holding : read

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="relative flex h-14 items-center">
          <button type="button" className="grid size-11 place-items-center" onClick={onBack} aria-label="뒤로">
            <ChevronLeft className="size-6" />
          </button>
          <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-[17px] font-bold">{title}</h1>
        </div>
        <TextTabs
          label="내 서재"
          value={tab}
          tabs={TABS.map(([id, label]) => ({ id, label }))}
          onChange={setTab}
        />
      </header>
      {shown.length === 0 ? (
        <p className="px-6 py-16 text-center text-[15px] text-muted-foreground">{emptyCopy(tab)}</p>
      ) : (
        <ul className={`grid grid-cols-3 gap-x-3 gap-y-5 px-4 py-4 ${tab === 'bought' && onAdd ? 'pb-28' : ''}`}>
          {shown.map((book) => (
            <li key={book.id}>
              <button type="button" className="w-full text-left" onClick={() => onOpenBook(book.id)}>
                <Cover book={book} />
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-4 font-bold">{book.title}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {tab === 'bought' && onAdd ? <AddBookButton onClick={onAdd} /> : null}
    </div>
  )
}

function emptyCopy(tab: Tab) {
  if (tab === 'bought') return '아직 구매한 책이 없어용.'
  if (tab === 'holding') return '아직 보유한 책이 없어용.'
  return '아직 읽은 책이 없어용.'
}

function Cover({ book }: { book: Book }) {
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-border shadow-sm">
      {book.coverUrl ? (
        <img src={book.coverUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
          <ImageOff className="size-4" />
          <span className="px-1 text-center text-[11px] leading-tight">표지가 없어용</span>
        </span>
      )}
    </div>
  )
}
