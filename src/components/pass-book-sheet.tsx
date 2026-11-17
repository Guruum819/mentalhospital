import { useState } from 'react'
import { passTargets, resolvedHolderId } from '@/lib/model'
import { readWho } from '@/lib/identity'
import { useShelf } from '@/lib/store'
import type { Book } from '@/lib/types'
import { Avatar } from '@/components/avatar-editor'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function PassBookSheet({
  book,
  open,
  onOpenChange,
}: {
  book: Book | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const shelf = useShelf()
  const [asking, setAsking] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const current = book
  const members = shelf.data.friends.filter((friend) => friend.approved)
  const holderId = current ? resolvedHolderId(current, new Set(members.map((friend) => friend.id))) : null
  const { queued, rest } = passTargets(members, current ? shelf.data.queues[current.id] ?? [] : [], holderId)
  const empty = queued.length === 0 && rest.length === 0

  const askingFriend = members.find((friend) => friend.id === asking) ?? null

  async function send() {
    if (!current || !asking || sending) return
    setSending(true)
    const mine = holderId !== null && holderId === readWho()
    const ok = mine ? await shelf.offerBook(current.id, asking) : await shelf.passBook(current.id, asking)
    setSending(false)
    if (ok) {
      setAsking(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>책 넘기기</DialogTitle>
          <DialogDescription>{current?.title}</DialogDescription>
        </DialogHeader>
        {empty ? (
          <p className="text-sm text-muted-foreground">넘길 멤버가 없어용.</p>
        ) : (
          <div className="max-h-[50dvh] space-y-4 overflow-y-auto">
            {queued.length > 0 ? (
              <section>
                <h3 className="px-1 pb-1 text-[13px] font-medium text-muted-foreground">다음에 읽을 순서</h3>
                <MemberList ids={queued.map((friend) => friend.id)} onPick={setAsking} />
              </section>
            ) : null}
            {rest.length > 0 ? (
              <section>
                <h3 className="px-1 pb-1 text-[13px] font-medium text-muted-foreground">다른 멤버</h3>
                <MemberList ids={rest.map((friend) => friend.id)} onPick={setAsking} />
              </section>
            ) : null}
          </div>
        )}
        <ConfirmDialog
          open={askingFriend !== null}
          title={askingFriend ? `${askingFriend.name}님한테 보낼까용?` : ''}
          description="수락해야 책이 넘어가용."
          confirmLabel="보내기"
          pending={sending}
          onOpenChange={(open) => {
            if (!open) setAsking(null)
          }}
          onConfirm={() => void send()}
        />
      </DialogContent>
    </Dialog>
  )
}

function MemberList({ ids, onPick }: { ids: string[]; onPick: (id: string) => void }) {
  const shelf = useShelf()
  return (
    <div className="grid">
      {ids.map((id) => {
        const friend = shelf.data.friends.find((item) => item.id === id)
        if (!friend) return null
        return (
          <button
            key={friend.id}
            type="button"
            className="flex min-h-14 items-center gap-3 border-b border-border py-2 text-left"
            onClick={() => onPick(friend.id)}
          >
            <Avatar name={friend.name} photo={friend.photo} size={36} />
            <span className="truncate text-[15px] font-bold">{friend.name}</span>
          </button>
        )
      })}
    </div>
  )
}
