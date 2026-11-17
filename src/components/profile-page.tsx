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
      <header className="sticky top-0 z-20 flex h-14 items-center border-b bg-background/90 px-2 backdrop-blur">
        <button type="button" className="h-11 px-3 text-lg" onClick={onBack} aria-label="뒤로">
          ←
        </button>
        <h1 className="flex-1 text-center text-base font-bold">프로필</h1>
        <span className="w-11" />
      </header>
      <div className="h-28" style={{ backgroundColor: accent }} />
      <div className="px-4">
        <div className="-mt-12 w-fit rounded-full bg-background p-1">
          <Avatar name={me.name} photo={me.photo} size={84} />
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">{me.name}</h2>
            <p className="text-sm text-muted-foreground">한줄평 {posts.length}</p>
          </div>
          <Button type="button" variant="outline" className="h-10 rounded-full px-4" onClick={onEdit}>
            프로필 수정
          </Button>
        </div>
      </div>
      <ul className="mt-4 border-t">
        {posts.length === 0 ? (
          <li className="px-4 py-8 text-sm text-muted-foreground">아직 남긴 한줄평이 없어요.</li>
        ) : (
          posts.map((review) => {
            const book = shelf.data.books.find((item) => item.id === review.bookId)
            return (
              <li key={review.id} className="flex gap-3 border-b px-4 py-3">
                <Avatar name={me.name} photo={me.photo} size={40} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">{me.name}</p>
                  <StarRating value={review.rating} readOnly size="sm" />
                  <p className="text-sm text-muted-foreground">{book?.title ?? '알 수 없는 책'}</p>
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
