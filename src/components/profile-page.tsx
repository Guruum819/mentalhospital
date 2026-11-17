import { ChevronLeft } from 'lucide-react'
import { paletteColor } from '@/lib/palette'
import { useShelf } from '@/lib/store'
import type { Friend } from '@/lib/types'
import { Avatar } from '@/components/avatar-editor'
import { StarRating } from '@/components/star-rating'
import { Button } from '@/components/ui/button'

export function ProfilePage({ me, onBack, onEdit }: { me: Friend; onBack: () => void; onEdit: () => void }) {
  const shelf = useShelf()
  const accent = paletteColor(me.color).hex
  const posts = shelf.data.reviews.filter((review) => review.friendId === me.id)

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="relative flex h-14 items-center">
          <button type="button" className="grid size-11 place-items-center" onClick={onBack} aria-label="뒤로">
            <ChevronLeft className="size-6" />
          </button>
          <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-[17px] font-bold">{me.name}</h1>
        </div>
      </header>
      <div className="h-24" style={{ backgroundColor: accent }} />
      <div className="px-4">
        <div className="-mt-10 w-fit rounded-full bg-background p-1">
          <Avatar name={me.name} photo={me.photo} size={80} />
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold tracking-tight">{me.name}</h2>
            <p className="text-[15px] text-muted-foreground">한줄평 {posts.length}</p>
          </div>
          <Button type="button" variant="outline" className="h-9 shrink-0 px-4" onClick={onEdit}>
            프로필 수정
          </Button>
        </div>
      </div>
      <ul className="mt-4 border-t border-border">
        {posts.length === 0 ? (
          <li className="px-4 py-8 text-[15px] text-muted-foreground">아직 남긴 한줄평이 없어요.</li>
        ) : (
          posts.map((review) => {
            const book = shelf.data.books.find((item) => item.id === review.bookId)
            return (
              <li key={review.id} className="flex gap-3 border-b border-border px-4 py-3">
                <Avatar name={me.name} photo={me.photo} size={40} />
                <div className="min-w-0">
                  <p className="text-[15px] font-bold">{me.name}</p>
                  <StarRating value={review.rating} readOnly size="sm" />
                  <p className="text-[15px] text-x">{book?.title ?? '알 수 없는 책'}</p>
                  <p className="mt-1 text-[15px] leading-snug whitespace-pre-wrap">{review.text}</p>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
