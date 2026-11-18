import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { forgetAdmin, hashSecret, isAdminSession, randomSalt, rememberAdmin } from './admin-auth.ts'
import { toKoreanError } from './errors.ts'
import { readWho } from './identity.ts'
import {
  MAX_AUTHOR,
  MAX_BOOKS,
  MAX_NAME,
  MAX_TITLE,
  cleanBirthday,
  cleanCover,
  cleanPhoto,
  cleanReview,
  cleanText,
  colorTaken,
  newId,
  nextOrder,
  nudgesRemaining,
  resolvedHolderId,
  sameIdentity,
  snapRating,
  markedFinished,
  toggledRead,
  withRead,
  withReading,
  isSafeId,
} from './model.ts'
import { PALETTE } from './palette.ts'
import { cleanPatchDate, cleanPatchLines } from './patch-notes.ts'
import { createRepository, type ShelfRepository } from './repo.ts'
import { starterShelf } from './seed.ts'
import type { Book, Friend, Review, ShelfData } from './types.ts'

type BookInput = {
  title: string
  author: string
  coverUrl: string | null
  buyerId: string
}

type ShelfApi = {
  data: ShelfData
  ready: boolean
  error: string | null
  connected: boolean
  mode: ShelfRepository['mode']
  admin: boolean
  addFriend: (name: string, color: string, photo: string | null, birthday: string) => Promise<string | null>
  updateFriend: (id: string, name: string, color: string, photo: string | null, birthday: string) => Promise<boolean>
  removeFriend: (id: string) => Promise<boolean>
  approveFriend: (id: string) => Promise<boolean>
  addReview: (bookId: string, friendId: string, text: string, rating: number) => Promise<boolean>
  updateReview: (reviewId: string, text: string) => Promise<boolean>
  deleteReview: (reviewId: string) => Promise<boolean>
  toggleLike: (reviewId: string) => Promise<void>
  addReply: (reviewId: string, text: string) => Promise<boolean>
  addBook: (input: BookInput) => Promise<boolean>
  updateBook: (id: string, input: BookInput) => Promise<boolean>
  removeBook: (id: string) => Promise<boolean>
  passBook: (bookId: string, toId: string) => Promise<boolean>
  offerBook: (bookId: string, toId: string) => Promise<boolean>
  cancelOffer: (bookId: string) => Promise<boolean>
  acceptOffer: (bookId: string) => Promise<boolean>
  declineOffer: (bookId: string) => Promise<boolean>
  toggleRead: (bookId: string, friendId: string) => Promise<void>
  setReading: (bookId: string, friendId: string | null) => Promise<void>
  markFinished: (bookId: string) => Promise<void>
  nudge: (bookId: string) => Promise<boolean>
  dismissNudges: (bookId: string) => Promise<void>
  toggleQueue: (bookId: string) => Promise<void>
  addRequest: (text: string, anonymous: boolean) => Promise<boolean>
  deleteRequest: (id: string) => Promise<boolean>
  setRequestDone: (id: string, done: boolean) => Promise<boolean>
  replyRequest: (id: string, text: string) => Promise<boolean>
  markNotificationsRead: () => Promise<void>
  setupAdmin: (password: string, again: string) => Promise<boolean>
  loginAdmin: (password: string) => Promise<boolean>
  changeAdmin: (current: string, next: string, again: string) => Promise<boolean>
  logoutAdmin: () => void
  clearShelf: () => Promise<boolean>
  savePatchNote: (id: string | null, date: string, text: string) => Promise<boolean>
  deletePatchNote: (id: string) => Promise<boolean>
}

const ShelfContext = createContext<ShelfApi | null>(null)

type Pending = {
  reads: Map<string, boolean>
  reading: Map<string, string | null>
  likes: Map<string, boolean>
  noticeReads: Set<string>
}

function cellKey(bookId: string, friendId: string) {
  return `${bookId}/${friendId}`
}

function applyPending(base: ShelfData, pending: Pending): ShelfData {
  let reads = base.reads
  for (const [key, read] of pending.reads) {
    const slash = key.indexOf('/')
    reads = withRead(reads, key.slice(0, slash), key.slice(slash + 1), read)
  }
  let reading = base.reading
  for (const [bookId, friendId] of pending.reading) {
    reading = withReading(reading, bookId, friendId)
  }
  let reviews = base.reviews
  if (pending.likes.size > 0) {
    reviews = reviews.map((review) => {
      let likes = review.likes
      let changed = false
      for (const [key, like] of pending.likes) {
        const slash = key.indexOf('/')
        if (key.slice(0, slash) !== review.id) continue
        const friendId = key.slice(slash + 1)
        const has = likes.includes(friendId)
        if (like === has) continue
        likes = like ? [...likes, friendId] : likes.filter((id) => id !== friendId)
        changed = true
      }
      return changed ? { ...review, likes } : review
    })
  }
  let notifications = base.notifications
  if (pending.noticeReads.size > 0) {
    const grouped = new Map<string, Set<string>>()
    for (const key of pending.noticeReads) {
      const slash = key.indexOf('/')
      const friendId = key.slice(0, slash)
      const noticeId = key.slice(slash + 1)
      const ids = grouped.get(friendId) ?? new Set<string>()
      ids.add(noticeId)
      grouped.set(friendId, ids)
    }
    notifications = { ...notifications }
    for (const [friendId, ids] of grouped) {
      const list = notifications[friendId]
      if (!list) continue
      notifications[friendId] = list.map((notice) => (ids.has(notice.id) && !notice.read ? { ...notice, read: true } : notice))
    }
  }
  return { ...base, reads, reading, reviews, notifications }
}

export function ShelfProvider({ children }: { children: ReactNode }) {
  const [repo] = useState(createRepository)
  const [data, setData] = useState<ShelfData>(starterShelf)
  const dataRef = useRef(data)
  const pendingRef = useRef<Pending>({ reads: new Map(), reading: new Map(), likes: new Map(), noticeReads: new Set() })
  const [pendingTick, setPendingTick] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [adminTick, setAdminTick] = useState(0)

  useEffect(() => {
    return repo.subscribe(
      (next, meta) => {
        dataRef.current = next
        for (const [key, desired] of pendingRef.current.reads) {
          const slash = key.indexOf('/')
          const actual = Boolean(next.reads[key.slice(0, slash)]?.[key.slice(slash + 1)])
          if (actual === desired) pendingRef.current.reads.delete(key)
        }
        for (const [bookId, friendId] of pendingRef.current.reading) {
          const actual = next.reading[bookId] ?? null
          if (actual === friendId) pendingRef.current.reading.delete(bookId)
        }
        for (const [key, desired] of pendingRef.current.likes) {
          const slash = key.indexOf('/')
          const review = next.reviews.find((item) => item.id === key.slice(0, slash))
          const actual = Boolean(review?.likes.includes(key.slice(slash + 1)))
          if (review && actual === desired) pendingRef.current.likes.delete(key)
        }
        for (const key of pendingRef.current.noticeReads) {
          const slash = key.indexOf('/')
          const friendId = key.slice(0, slash)
          const noticeId = key.slice(slash + 1)
          const notice = next.notifications[friendId]?.find((item) => item.id === noticeId)
          if (!notice || notice.read) pendingRef.current.noticeReads.delete(key)
        }
        setData(next)
        setConnected(meta.connected)
        setError(null)
        setReady(true)
      },
      (message) => {
        setError(toKoreanError(new Error(message)))
        setConnected(false)
        setReady(true)
      },
    )
  }, [repo])

  const shown = useMemo(() => applyPending(data, pendingRef.current), [data, pendingTick])

  function bump() {
    setPendingTick((tick) => tick + 1)
  }

  async function guard(work: () => Promise<void>) {
    try {
      await work()
      return true
    } catch (caught) {
      toast.error(toKoreanError(caught))
      return false
    }
  }

  const api = useMemo<ShelfApi>(() => {
    const shownNow = () => applyPending(dataRef.current, pendingRef.current)
    const isAdmin = () => isAdminSession(dataRef.current.admin?.hash ?? null)

    return {
      data: shown,
      ready,
      error,
      connected,
      mode: repo.mode,
      admin: isAdmin(),
      async addFriend(name, color, photo, birthday) {
        const clean = cleanText(name, MAX_NAME)
        const born = cleanBirthday(birthday)
        if (!clean) {
          toast.error('이름을 입력해 주세용.')
          return null
        }
        if (!born) {
          toast.error('생일을 골라 주세용.')
          return null
        }
        const shelf = shownNow()
        if (shelf.friends.length >= PALETTE.length) {
          toast.error('모임은 10명까지예용. 프로필을 지우면 빈 자리와 그 색을 다시 쓸 수 있어용.')
          return null
        }
        if (sameIdentity(shelf.friends, clean, born)) {
          toast.error('같은 이름과 생일이 이미 있어용. 로그인에서 들어가 주세용.')
          return null
        }
        if (colorTaken(shelf.friends, color)) {
          toast.error('그 색은 다른 친구가 쓰고 있어용.')
          return null
        }
        const storedPhoto = cleanPhoto(photo)
        if (photo && !storedPhoto) {
          toast.error('사진이 너무 커용. 조금 더 작게 잘라 주세용.')
          return null
        }
        const friend: Friend = {
          id: newId('friend'),
          name: clean,
          color,
          order: nextOrder(shelf.friends),
          photo: storedPhoto,
          birthday: born,
          approved: shelf.friends.length === 0 && !shelf.admin,
        }
        const ok = await guard(() => repo.saveFriend(friend))
        if (ok) toast.success(friend.approved ? '프로필을 만들었어용.' : '가입 신청을 보냈어용.')
        return ok ? friend.id : null
      },
      async updateFriend(id, name, color, photo, birthday) {
        const clean = cleanText(name, MAX_NAME)
        const born = cleanBirthday(birthday)
        if (!clean) {
          toast.error('이름을 입력해 주세용.')
          return false
        }
        if (!born) {
          toast.error('생일을 골라 주세용.')
          return false
        }
        const shelf = shownNow()
        const current = shelf.friends.find((friend) => friend.id === id)
        if (!current) return false
        if (sameIdentity(shelf.friends, clean, born, id)) {
          toast.error('같은 이름과 생일이 이미 있어용.')
          return false
        }
        if (colorTaken(shelf.friends, color, id)) {
          toast.error('그 색은 다른 친구가 쓰고 있어용.')
          return false
        }
        const storedPhoto = cleanPhoto(photo)
        if (photo && !storedPhoto) {
          toast.error('사진이 너무 커용. 조금 더 작게 잘라 주세용.')
          return false
        }
        return guard(() => repo.saveFriend({ ...current, name: clean, color, photo: storedPhoto, birthday: born }))
      },
      removeFriend(id) {
        if (id !== readWho() && !isAdmin()) {
          toast.error('관리자만 내보낼 수 있어용.')
          return Promise.resolve(false)
        }
        return guard(() => repo.deleteFriend(id))
      },
      async approveFriend(id) {
        if (!isAdmin()) {
          toast.error('관리자만 승인할 수 있어용.')
          return false
        }
        const friend = shownNow().friends.find((item) => item.id === id)
        if (!friend) return false
        const ok = await guard(() => repo.saveFriend({ ...friend, approved: true }))
        if (ok) toast.success('가입을 승인했어용.')
        return ok
      },
      async addReview(bookId, friendId, text, rating) {
        const clean = cleanReview(text)
        const stars = snapRating(rating)
        if (!clean) {
          toast.error('한 줄 평을 입력해 주세용.')
          return false
        }
        if (stars === null) {
          toast.error('별점은 0에서 5까지, 0.5 단위로 골라 주세용.')
          return false
        }
        const shelf = shownNow()
        const reader = shelf.friends.find((friend) => friend.id === friendId)
        if (friendId !== readWho() || !reader?.approved || !shelf.books.some((book) => book.id === bookId)) {
          return false
        }
        if (!shelf.reads[bookId]?.[friendId]) {
          toast.error('이 책을 읽고 나면 코멘트를 달 수 있어용.')
          return false
        }
        const review: Review = {
          id: newId('review'),
          bookId,
          friendId,
          text: clean,
          createdAt: Date.now(),
          rating: stars,
          parentId: null,
          editedAt: null,
          likes: [],
        }
        return guard(() => repo.addReview(review))
      },
      async updateReview(reviewId, text) {
        const clean = cleanReview(text)
        if (!clean) {
          toast.error('한 줄 평을 입력해 주세용.')
          return false
        }
        const review = shownNow().reviews.find((item) => item.id === reviewId)
        if (!review || review.deleted || review.friendId !== readWho()) {
          toast.error('내가 쓴 글만 고칠 수 있어용.')
          return false
        }
        const ok = await guard(() => repo.updateReview(reviewId, clean, Date.now()))
        if (ok) toast.success('수정했어용.')
        return ok
      },
      deleteReview(reviewId) {
        const review = shownNow().reviews.find((item) => item.id === reviewId)
        if (!review || review.deleted || review.friendId !== readWho()) {
          toast.error('내가 쓴 글만 지울 수 있어용.')
          return Promise.resolve(false)
        }
        return guard(() => repo.deleteReview(reviewId))
      },
      async toggleLike(reviewId) {
        const shelf = shownNow()
        const me = readWho()
        const review = shelf.reviews.find((item) => item.id === reviewId)
        if (!me || !review || review.deleted || !shelf.friends.some((friend) => friend.id === me && friend.approved)) return
        const like = !review.likes.includes(me)
        const key = cellKey(reviewId, me)
        pendingRef.current.likes.set(key, like)
        bump()
        try {
          await repo.setReviewLike(reviewId, me, like)
          if (pendingRef.current.likes.get(key) === like) pendingRef.current.likes.delete(key)
          bump()
        } catch (caught) {
          pendingRef.current.likes.delete(key)
          bump()
          toast.error(toKoreanError(caught))
        }
      },
      async addReply(reviewId, text) {
        const clean = cleanReview(text)
        if (!clean) {
          toast.error('답글을 입력해 주세용.')
          return false
        }
        const shelf = shownNow()
        const me = readWho()
        const parent = shelf.reviews.find((item) => item.id === reviewId)
        if (!me || !parent || parent.deleted || !shelf.friends.some((friend) => friend.id === me && friend.approved)) return false
        const reply: Review = {
          id: newId('review'),
          bookId: parent.bookId,
          friendId: me,
          text: clean,
          createdAt: Date.now(),
          rating: null,
          parentId: parent.id,
          editedAt: null,
          likes: [],
        }
        const ok = await guard(() => repo.addReview(reply))
        if (ok) toast.success('답글을 올렸어용.')
        return ok
      },
      async addBook(input) {
        const title = cleanText(input.title, MAX_TITLE)
        if (!title) {
          toast.error('책 제목을 입력해 주세용.')
          return false
        }
        const shelf = shownNow()
        if (shelf.books.length >= MAX_BOOKS) {
          toast.error(`책은 ${MAX_BOOKS}권까지 올릴 수 있어용.`)
          return false
        }
        if (!shelf.friends.some((friend) => friend.id === input.buyerId && friend.approved)) {
          toast.error('프로필로 들어간 뒤에 책을 올릴 수 있어용.')
          return false
        }
        const book: Book = {
          id: newId('book'),
          title,
          author: cleanText(input.author, MAX_AUTHOR) ?? '',
          coverUrl: cleanCover(input.coverUrl),
          buyerId: input.buyerId,
          order: nextOrder(shelf.books),
          holderId: input.buyerId,
        }
        const ok = await guard(() => repo.saveBook(book))
        if (ok) toast.success('책 추가했어용')
        return ok
      },
      async updateBook(id, input) {
        const title = cleanText(input.title, MAX_TITLE)
        if (!title) {
          toast.error('책 제목을 입력해 주세용.')
          return false
        }
        const shelf = shownNow()
        const current = shelf.books.find((book) => book.id === id)
        if (!current || current.buyerId !== readWho()) {
          toast.error('이 책을 올린 사람만 수정할 수 있어용.')
          return false
        }
        const coverUrl = cleanCover(input.coverUrl)
        if (input.coverUrl && !coverUrl) {
          toast.error('표지를 저장하지 못했어용. 다른 사진을 골라 주세용.')
          return false
        }
        const ok = await guard(() =>
          repo.saveBook({
            ...current,
            title,
            author: cleanText(input.author, MAX_AUTHOR) ?? '',
            coverUrl,
            buyerId: current.buyerId,
          }),
        )
        if (ok) toast.success('저장했어용.')
        return ok
      },
      removeBook(id) {
        const shelf = shownNow()
        const book = shelf.books.find((item) => item.id === id)
        if (!book || book.buyerId !== readWho()) {
          toast.error('이 책을 올린 사람만 지울 수 있어용.')
          return Promise.resolve(false)
        }
        return guard(() => repo.deleteBook(id, shelf.reviews))
      },
      async passBook(bookId, toId) {
        const shelf = shownNow()
        const book = shelf.books.find((item) => item.id === bookId)
        const members = shelf.friends.filter((friend) => friend.approved)
        const approved = new Set(members.map((friend) => friend.id))
        const holder = book ? resolvedHolderId(book, approved) : null
        const me = readWho()
        const actorIsMember = Boolean(me && approved.has(me))
        if (!book || !approved.has(toId)) {
          toast.error('넘길 친구를 찾지 못했어용.')
          return false
        }
        if (holder !== me && !isAdmin()) {
          toast.error('지금 갖고 있는 사람만 넘길 수 있어용.')
          return false
        }
        if (toId === holder) {
          toast('이미 그 친구가 갖고 있어용.')
          return false
        }
        const to = members.find((friend) => friend.id === toId)
        const actorId = actorIsMember && me ? me : 'admin'
        const event = { id: newId('handoff'), fromId: holder, toId, at: Date.now() }
        const ok = await guard(() => repo.passBook(bookId, toId, event, actorId))
        if (ok) toast.success(`${to?.name ?? '친구'}님한테 넘겼어용!`)
        return ok
      },
      async offerBook(bookId, toId) {
        const shelf = shownNow()
        const book = shelf.books.find((item) => item.id === bookId)
        const members = shelf.friends.filter((friend) => friend.approved)
        const approved = new Set(members.map((friend) => friend.id))
        const holder = book ? resolvedHolderId(book, approved) : null
        const me = readWho()
        if (!book || !me || holder !== me || !approved.has(toId) || toId === me) {
          toast.error('지금 갖고 있는 사람만 넘길 수 있어용.')
          return false
        }
        if (shelf.transfers[bookId]) {
          toast('이미 넘기는 중이에용')
          return false
        }
        const to = members.find((friend) => friend.id === toId)
        const ok = await guard(() => repo.offerBook(bookId, me, toId, Date.now()))
        if (ok) toast.success(`${to?.name ?? '친구'}님한테 보냈어용`)
        return ok
      },
      async cancelOffer(bookId) {
        const me = readWho()
        const transfer = shownNow().transfers[bookId]
        if (!me || !transfer || transfer.fromId !== me) return false
        const ok = await guard(() => repo.cancelOffer(bookId, me))
        if (ok) toast('넘기기를 취소했어용.')
        return ok
      },
      async acceptOffer(bookId) {
        const me = readWho()
        const transfer = shownNow().transfers[bookId]
        if (!me || !transfer || transfer.toId !== me) return false
        const event = { id: newId('handoff'), fromId: transfer.fromId, toId: me, at: Date.now() }
        return guard(() => repo.acceptOffer(bookId, me, event))
      },
      async declineOffer(bookId) {
        const me = readWho()
        const transfer = shownNow().transfers[bookId]
        if (!me || !transfer || transfer.toId !== me) return false
        return guard(() => repo.declineOffer(bookId, me, Date.now(), newId('decline')))
      },
      async toggleRead(bookId, friendId) {
        if (friendId !== readWho()) {
          toast('본인 것만 체크할 수 있어용')
          return
        }
        const before = shownNow()
        const change = toggledRead(before, bookId, friendId)
        const key = cellKey(bookId, friendId)
        const read = !before.reads[bookId]?.[friendId]
        pendingRef.current.reads.set(key, read)
        if (change.clearedReading) pendingRef.current.reading.set(bookId, null)
        bump()
        try {
          await repo.setRead(bookId, friendId, read, change.clearedReading)
          if (pendingRef.current.reads.get(key) === read) pendingRef.current.reads.delete(key)
          if (change.clearedReading && pendingRef.current.reading.get(bookId) === null) {
            pendingRef.current.reading.delete(bookId)
          }
          bump()
          if (change.clearedReading) {
            const name = before.friends.find((friend) => friend.id === friendId)?.name ?? '친구'
            toast(`${name} 님은 다 읽은 것으로 체크해서, 읽는 중에서 뺐어용.`)
          }
        } catch (caught) {
          pendingRef.current.reads.delete(key)
          if (change.clearedReading) pendingRef.current.reading.delete(bookId)
          bump()
          toast.error(toKoreanError(caught))
        }
      },
      async setReading(bookId, friendId) {
        const me = readWho()
        const shelf = shownNow()
        const book = shelf.books.find((item) => item.id === bookId)
        const holder = book
          ? resolvedHolderId(book, new Set(shelf.friends.filter((friend) => friend.approved).map((friend) => friend.id)))
          : null
        if (!me || holder !== me) {
          toast('지금 갖고 있는 사람만 읽는 중으로 표시할 수 있어용')
          return
        }
        const current = shelf.reading[bookId] ?? null
        const ownFlag = friendId === me || (friendId === null && current === me)
        if (!ownFlag || (friendId === me && current !== null && current !== me)) {
          toast('본인 것만 읽는 중으로 표시할 수 있어용')
          return
        }
        pendingRef.current.reading.set(bookId, friendId)
        bump()
        try {
          await repo.setReading(bookId, friendId)
          if (pendingRef.current.reading.get(bookId) === friendId) {
            pendingRef.current.reading.delete(bookId)
          }
          bump()
        } catch (caught) {
          pendingRef.current.reading.delete(bookId)
          bump()
          toast.error(toKoreanError(caught))
        }
      },
      async markFinished(bookId) {
        const me = readWho()
        const before = shownNow()
        const book = before.books.find((item) => item.id === bookId)
        const holder = book
          ? resolvedHolderId(book, new Set(before.friends.filter((friend) => friend.approved).map((friend) => friend.id)))
          : null
        if (!me || holder !== me) {
          toast('지금 갖고 있는 사람만 완독으로 표시할 수 있어용')
          return
        }
        const change = markedFinished(before, bookId, me)
        const key = cellKey(bookId, me)
        pendingRef.current.reads.set(key, true)
        if (change.clearedReading) pendingRef.current.reading.set(bookId, null)
        bump()
        try {
          await repo.setRead(bookId, me, true, change.clearedReading)
          if (pendingRef.current.reads.get(key) === true) pendingRef.current.reads.delete(key)
          if (change.clearedReading && pendingRef.current.reading.get(bookId) === null) {
            pendingRef.current.reading.delete(bookId)
          }
          bump()
          toast.success('독서 완료! 한 줄 평도 남겨 보세용')
        } catch (caught) {
          pendingRef.current.reads.delete(key)
          if (change.clearedReading) pendingRef.current.reading.delete(bookId)
          bump()
          toast.error(toKoreanError(caught))
        }
      },
      async markNotificationsRead() {
        const me = readWho()
        if (!me) return
        const unread = (shownNow().notifications[me] ?? []).filter((notice) => !notice.read)
        if (unread.length === 0) return
        const keys = unread.map((notice) => `${me}/${notice.id}`)
        for (const key of keys) pendingRef.current.noticeReads.add(key)
        bump()
        try {
          await repo.markNotificationsRead(me, unread.map((notice) => notice.id))
        } catch (caught) {
          for (const key of keys) pendingRef.current.noticeReads.delete(key)
          bump()
          toast.error(toKoreanError(caught))
        }
      },
      async nudge(bookId) {
        const me = readWho()
        const shelf = shownNow()
        const readerId = shelf.reading[bookId]
        const reader = shelf.friends.find((friend) => friend.id === readerId && friend.approved)
        const member = shelf.friends.some((friend) => friend.id === me && friend.approved)
        if (!me || !member || !reader || reader.id === me) {
          toast('지금 읽는 친구에게만 독촉할 수 있어용')
          return false
        }
        if (nudgesRemaining(shelf.nudgeSends[me] ?? [], Date.now()) === 0) {
          toast('오늘 독촉은 다 썼어용')
          return false
        }
        const ok = await guard(() => repo.setNudge(bookId, me, Date.now()))
        if (ok) toast.success(`${reader.name}님한테 독촉했어용!`)
        return ok
      },
      async dismissNudges(bookId) {
        const me = readWho()
        if (!me || shownNow().reading[bookId] !== me) return
        await guard(() => repo.clearNudges(bookId))
      },
      async toggleQueue(bookId) {
        const me = readWho()
        const shelf = shownNow()
        const member = shelf.friends.some((friend) => friend.id === me && friend.approved)
        if (!me || !member) return
        if (shelf.reads[bookId]?.[me]) {
          toast('이미 읽은 책은 대기할 필요가 없어용')
          return
        }
        const joined = (shelf.queues[bookId] ?? []).includes(me)
        const ok = await guard(() => repo.setQueue(bookId, me, joined ? null : Date.now()))
        if (!ok) return
        if (joined) {
          toast('대기에서 빠졌어용.', {
            action: {
              label: '되돌리기',
              onClick: () => {
                void repo.setQueue(bookId, me, Date.now())
              },
            },
          })
          return
        }
        toast.success('대기 신청했어용.')
      },
      async addRequest(text, anonymous) {
        const me = readWho()
        const clean = cleanReview(text)
        if (!me || !clean) {
          toast.error('내용을 입력해 주세용.')
          return false
        }
        const ok = await guard(() =>
          repo.addRequest({
            id: newId('request'),
            friendId: me,
            anonymous,
            text: clean,
            createdAt: Date.now(),
            done: false,
            replies: [],
          }),
        )
        if (ok) toast.success('요청을 올렸어용.')
        return ok
      },
      deleteRequest(id) {
        const post = shownNow().posts.find((item) => item.id === id)
        if (!post || (post.friendId !== readWho() && !isAdmin())) {
          toast.error('이 글은 지울 수 없어용.')
          return Promise.resolve(false)
        }
        return guard(() => repo.deleteRequest(id))
      },
      setRequestDone(id, done) {
        if (!isAdmin()) {
          toast.error('관리자만 완료로 표시할 수 있어용.')
          return Promise.resolve(false)
        }
        return guard(() => repo.setRequestDone(id, done))
      },
      async replyRequest(id, text) {
        if (!isAdmin()) {
          toast.error('답글은 관리자만 달 수 있어용.')
          return false
        }
        const clean = cleanReview(text)
        if (!clean) {
          toast.error('답글을 입력해 주세용.')
          return false
        }
        if (!shownNow().posts.some((post) => post.id === id)) return false
        const ok = await guard(() => repo.addRequestReply(id, { id: newId('reply'), text: clean, createdAt: Date.now() }))
        if (ok) toast.success('답글을 올렸어용.')
        return ok
      },
      async setupAdmin(password, again) {
        if (dataRef.current.admin) {
          toast.error('이미 관리자 암호가 있어용.')
          return false
        }
        if (password.length < 4) {
          toast.error('암호는 네 글자 이상으로 해 주세용.')
          return false
        }
        if (password !== again) {
          toast.error('암호 확인이 달라용.')
          return false
        }
        const salt = randomSalt()
        const hash = await hashSecret(password, salt)
        const ok = await guard(() => repo.saveAdmin({ salt, hash }))
        if (ok) {
          rememberAdmin(hash)
          setAdminTick((tick) => tick + 1)
          toast.success('관리자 암호를 만들었어용.')
        }
        return ok
      },
      async loginAdmin(password) {
        const admin = dataRef.current.admin
        if (!admin) return false
        const hash = await hashSecret(password, admin.salt)
        if (hash !== admin.hash) {
          toast.error('암호가 안 맞아용.')
          return false
        }
        rememberAdmin(hash)
        setAdminTick((tick) => tick + 1)
        toast.success('관리자로 들어왔어용.')
        return true
      },
      async changeAdmin(current, next, again) {
        const admin = dataRef.current.admin
        if (!admin || !isAdmin()) {
          toast.error('관리자로 들어간 뒤에 바꿀 수 있어용.')
          return false
        }
        const currentHash = await hashSecret(current, admin.salt)
        if (currentHash !== admin.hash) {
          toast.error('지금 암호가 안 맞아용.')
          return false
        }
        if (next.length < 4) {
          toast.error('암호는 네 글자 이상으로 해 주세용.')
          return false
        }
        if (next !== again) {
          toast.error('암호 확인이 달라용.')
          return false
        }
        const salt = randomSalt()
        const hash = await hashSecret(next, salt)
        const ok = await guard(() => repo.saveAdmin({ salt, hash }))
        if (ok) {
          rememberAdmin(hash)
          setAdminTick((tick) => tick + 1)
          toast.success('관리자 암호를 바꿨어용.')
        }
        return ok
      },
      logoutAdmin() {
        forgetAdmin()
        setAdminTick((tick) => tick + 1)
        toast.success('관리자에서 나왔어용.')
      },
      clearShelf() {
        if (!isAdmin()) {
          toast.error('책 비우기는 관리자만 할 수 있어용.')
          return Promise.resolve(false)
        }
        return guard(() => repo.clearBooks())
      },
      async savePatchNote(id, dateRaw, text) {
        if (!isAdmin()) {
          toast.error('관리자만 패치노트를 고칠 수 있어용.')
          return false
        }
        const date = cleanPatchDate(dateRaw)
        if (!date) {
          toast.error('날짜를 골라 주세용.')
          return false
        }
        const lines = cleanPatchLines(text)
        if (lines.length === 0) {
          toast.error('내용을 입력해 주세용.')
          return false
        }
        const noteId = id ?? newId('patch')
        if (!isSafeId(noteId)) {
          toast.error('패치노트를 저장하지 못했어용.')
          return false
        }
        const ok = await guard(() => repo.savePatchNote({ id: noteId, date, lines }))
        if (ok) toast.success('패치노트를 저장했어용.')
        return ok
      },
      async deletePatchNote(id) {
        if (!isAdmin()) {
          toast.error('관리자만 패치노트를 고칠 수 있어용.')
          return false
        }
        const ok = await guard(() => repo.deletePatchNote(id))
        if (ok) toast.success('패치노트를 지웠어용.')
        return ok
      },
    }
  }, [shown, ready, error, connected, repo, adminTick])

  return <ShelfContext.Provider value={api}>{children}</ShelfContext.Provider>
}

export function useShelf() {
  const value = useContext(ShelfContext)
  if (!value) throw new Error('서재 화면 밖에서 상태를 읽었어용.')
  return value
}
