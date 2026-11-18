import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  connectDatabaseEmulator,
  getDatabase,
  onValue,
  ref,
  runTransaction,
  update,
  type Database,
} from 'firebase/database'
import { emulatorAddress, readFirebaseConfig } from './config.ts'
import {
  dropMemberNotifications,
  fromFirebase,
  fromPersisted,
  handoffNotice,
  offerNoticeId,
  holderAfterRemoval,
  resolvedHolderId,
  isSafeId,
  likeNotice,
  nextNudgeSends,
  nextReviewsAfterDelete,
  nudgeNotice,
  readNotifications,
  requestNotice,
  replyNotice,
  reviewsAfterMemberRemoval,
  toPersisted,
  withNotification,
  withoutNotification,
} from './model.ts'
import { PATCH_NOTES } from './patch-notes.ts'
import { starterFirebaseUpdate, starterShelf } from './seed.ts'
import type { AdminLock, BoardPost, BoardReply, Book, Friend, Handoff, Notice, PatchNote, Review, ShelfData, SyncMode } from './types.ts'

const STORAGE_KEY = 'exchange-reading-v2'
const EMULATOR_FLAG = '__exchangeReadingEmulator'

export type ShelfListener = (data: ShelfData, meta: { connected: boolean }) => void

export interface ShelfRepository {
  mode: SyncMode
  subscribe: (onData: ShelfListener, onError: (message: string) => void) => () => void
  saveFriend: (friend: Friend) => Promise<void>
  deleteFriend: (friendId: string) => Promise<void>
  saveBook: (book: Book) => Promise<void>
  passBook: (bookId: string, toId: string, event: Handoff, actorId: string) => Promise<void>
  offerBook: (bookId: string, fromId: string, toId: string, at: number) => Promise<void>
  cancelOffer: (bookId: string, holderId: string) => Promise<void>
  acceptOffer: (bookId: string, recipientId: string, event: Handoff) => Promise<void>
  declineOffer: (bookId: string, recipientId: string, at: number, noticeId: string) => Promise<void>
  deleteBook: (bookId: string, reviews?: readonly Review[]) => Promise<void>
  setRead: (bookId: string, friendId: string, read: boolean, clearReading: boolean) => Promise<void>
  setReading: (bookId: string, friendId: string | null) => Promise<void>
  addReview: (review: Review) => Promise<void>
  updateReview: (reviewId: string, text: string, editedAt: number) => Promise<void>
  deleteReview: (reviewId: string) => Promise<void>
  setReviewLike: (reviewId: string, friendId: string, like: boolean) => Promise<void>
  setNudge: (bookId: string, friendId: string, at: number) => Promise<void>
  clearNudges: (bookId: string) => Promise<void>
  setQueue: (bookId: string, friendId: string, at: number | null) => Promise<void>
  saveAdmin: (admin: AdminLock) => Promise<void>
  savePatchNote: (note: PatchNote) => Promise<void>
  deletePatchNote: (id: string) => Promise<void>
  addRequest: (post: BoardPost) => Promise<void>
  deleteRequest: (postId: string) => Promise<void>
  setRequestDone: (postId: string, done: boolean) => Promise<void>
  addRequestReply: (postId: string, reply: BoardReply) => Promise<void>
  markNotificationsRead: (friendId: string, ids: readonly string[]) => Promise<void>
  /** Deletes books, reads, reviews, nudges, and queues. Leaves friends and board posts alone. */
  clearBooks: () => Promise<void>
}

function database(): Database {
  const options = readFirebaseConfig()
  if (!options) throw new Error('Firebase 설정이 없어용.')
  const app = getApps().length ? getApp() : initializeApp(options)
  const db = getDatabase(app)
  const emulator = emulatorAddress()
  const flag = globalThis as typeof globalThis & { [EMULATOR_FLAG]?: boolean }
  if (emulator && !flag[EMULATOR_FLAG]) {
    connectDatabaseEmulator(db, emulator.host, emulator.port)
    flag[EMULATOR_FLAG] = true
  }
  return db
}

async function write(values: Record<string, unknown>) {
  await update(ref(database()), values)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Existing members have no approved flag. Write only that field so other profile data stays. */
function approvalPatch(raw: unknown, friendIds: ReadonlySet<string>): Record<string, unknown> {
  if (!isRecord(raw) || !isRecord(raw.friends)) return {}
  const patch: Record<string, unknown> = {}
  for (const [id, value] of Object.entries(raw.friends)) {
    if (!friendIds.has(id) || !isRecord(value) || 'approved' in value) continue
    patch[`friends/${id}/approved`] = true
  }
  return patch
}

function reviewPayload(review: Review) {
  return {
    bookId: review.bookId,
    friendId: review.friendId,
    text: review.text,
    createdAt: review.createdAt,
    rating: review.rating,
    parentId: review.parentId,
    editedAt: review.editedAt,
    likes: Object.fromEntries(review.likes.map((id) => [id, true])),
    ...(review.deleted ? { deleted: true } : {}),
  }
}

function notificationValue(notice: Notice) {
  const value: Record<string, unknown> = {
    kind: notice.kind,
    actorId: notice.actorId,
    createdAt: notice.createdAt,
    read: notice.read,
  }
  if (notice.bookId) value.bookId = notice.bookId
  if (notice.reviewId) value.reviewId = notice.reviewId
  if (notice.preview) value.preview = notice.preview
  if (notice.postId) value.postId = notice.postId
  return value
}

function requestPayload(post: BoardPost) {
  return {
    friendId: post.friendId,
    anonymous: post.anonymous,
    text: post.text,
    createdAt: post.createdAt,
    done: post.done,
    replies: Object.fromEntries(post.replies.map((reply) => [reply.id, { text: reply.text, createdAt: reply.createdAt }])),
  }
}

function createFirebaseRepo(): ShelfRepository {
  let current = starterShelf()
  let seeding = false
  let seedingNotes = false
  const migrated = new Set<string>()

  return {
    mode: 'firebase',
    subscribe(onData, onError) {
      const db = database()
      let connected = false
      let seen = false
      const unsubData = onValue(
        ref(db),
        (snap) => {
          const raw: unknown = snap.val()
          const data = fromFirebase(raw)
          if (!data.initialized && data.friends.length === 0 && data.books.length === 0) {
            if (!seeding) {
              seeding = true
              write(starterFirebaseUpdate())
                .catch((error: unknown) => onError(error instanceof Error ? error.message : '시작 데이터를 쓰지 못했어용.'))
                .finally(() => {
                  seeding = false
                })
            }
            return
          }
          const patch: Record<string, unknown> = {}
          if (!data.initialized) patch['settings/initialized'] = true
          const approvals = approvalPatch(raw, new Set(data.friends.map((friend) => friend.id)))
          for (const [path, value] of Object.entries(approvals)) {
            const id = path.split('/')[1] ?? ''
            if (!migrated.has(id)) {
              migrated.add(id)
              patch[path] = value
            }
          }
          if (Object.keys(patch).length > 0) {
            void write(patch).catch(() => {
              for (const path of Object.keys(approvals)) {
                const id = path.split('/')[1] ?? ''
                migrated.delete(id)
              }
            })
          }
          current = data.initialized ? data : { ...data, initialized: true }
          seen = true
          onData(current, { connected })
          if (!data.patchNotesReady && !seedingNotes) {
            seedingNotes = true
            void runTransaction(ref(db, 'settings'), (value) => {
              if (value !== null && (typeof value !== 'object' || Array.isArray(value))) return
              const settings = (value ?? {}) as Record<string, unknown>
              if (settings.patchNotesReady === true) return
              const existing = settings.patchNotes
              const hasNotes = !!existing && typeof existing === 'object' && !Array.isArray(existing) && Object.keys(existing).length > 0
              if (hasNotes) return { ...settings, patchNotesReady: true }
              const patchNotes: Record<string, { date: string; lines: string[] }> = {}
              for (const note of PATCH_NOTES) patchNotes[note.id] = { date: note.date, lines: [...note.lines] }
              return { ...settings, patchNotes, patchNotesReady: true }
            })
              .then((result) => {
                if (!result.committed) seedingNotes = false
              })
              .catch(() => {
                seedingNotes = false
              })
          }
        },
        (error) => onError(error.message),
      )
      const unsubConn = onValue(ref(db, '.info/connected'), (snap) => {
        connected = snap.val() === true
        if (seen) onData(current, { connected })
      })
      return () => {
        unsubData()
        unsubConn()
      }
    },
    async saveFriend(friend) {
      await write({
        [`friends/${friend.id}/name`]: friend.name,
        [`friends/${friend.id}/order`]: friend.order,
        [`friends/${friend.id}/color`]: friend.color,
        [`friends/${friend.id}/photo`]: friend.photo ?? '',
        [`friends/${friend.id}/birthday`]: friend.birthday,
        [`friends/${friend.id}/approved`]: friend.approved,
      })
    },
    async deleteFriend(friendId) {
      const values: Record<string, unknown> = { [`friends/${friendId}`]: null }
      for (const book of current.books) values[`reads/${book.id}/${friendId}`] = null
      for (const [bookId, readerId] of Object.entries(current.reading)) {
        if (readerId === friendId) values[`reading/${bookId}`] = null
      }
      const kept = reviewsAfterMemberRemoval(current.reviews, friendId)
      const keptById = new Map(kept.map((review) => [review.id, review]))
      for (const review of current.reviews) {
        const updated = keptById.get(review.id)
        if (!updated) values[`reviews/${review.id}`] = null
        else if (updated.deleted && !review.deleted) values[`reviews/${review.id}/deleted`] = true
        if (updated && review.likes.includes(friendId)) values[`reviews/${review.id}/likes/${friendId}`] = null
      }
      for (const post of current.posts) {
        if (post.friendId === friendId) values[`settings/requests/${post.id}`] = null
      }
      for (const [bookId, ids] of Object.entries(current.nudges)) {
        if (ids.includes(friendId)) values[`settings/nudges/${bookId}/${friendId}`] = null
      }
      for (const [bookId, ids] of Object.entries(current.queues)) {
        if (ids.includes(friendId)) values[`settings/queues/${bookId}/${friendId}`] = null
      }
      const approvedAfter = new Set(current.friends.filter((friend) => friend.id !== friendId && friend.approved).map((friend) => friend.id))
      for (const book of current.books) {
        const nextHolder = holderAfterRemoval(book, friendId, approvedAfter)
        if (nextHolder !== undefined) values[`books/${book.id}/holderId`] = nextHolder
      }
      for (const [bookId, transfer] of Object.entries(current.transfers)) {
        if (transfer.fromId !== friendId && transfer.toId !== friendId) continue
        values[`settings/transfers/${bookId}`] = null
        values[`friends/${transfer.toId}/notifications/${offerNoticeId(bookId)}`] = null
      }
      await write(values)
    },
    async offerBook(bookId, fromId, toId, at) {
      const book = current.books.find((item) => item.id === bookId)
      if (!book || current.transfers[bookId]) throw new Error('이미 넘기는 중이에용')
      if (!current.friends.some((friend) => friend.id === toId && friend.approved)) return
      const values: Record<string, unknown> = {
        [`settings/transfers/${bookId}`]: { fromId, toId, at },
      }
      const built = handoffNotice(fromId, toId, bookId, `offer-${bookId}`, at)
      if (built) {
        values[`friends/${toId}/notifications/${offerNoticeId(bookId)}`] = {
          ...notificationValue({ ...built.notice, id: offerNoticeId(bookId), kind: 'offer' }),
        }
      }
      await write(values)
    },
    async cancelOffer(bookId, holderId) {
      const transfer = current.transfers[bookId]
      if (!transfer || transfer.fromId !== holderId) return
      await write({
        [`settings/transfers/${bookId}`]: null,
        [`friends/${transfer.toId}/notifications/${offerNoticeId(bookId)}`]: null,
      })
    },
    async acceptOffer(bookId, recipientId, event) {
      const transfer = current.transfers[bookId]
      const book = current.books.find((item) => item.id === bookId)
      if (!transfer || !book || transfer.toId !== recipientId) return
      const values: Record<string, unknown> = {
        [`books/${bookId}/holderId`]: recipientId,
        [`settings/transfers/${bookId}`]: null,
        [`friends/${recipientId}/notifications/${offerNoticeId(bookId)}`]: null,
        [`settings/handoffs/${bookId}/${event.id}`]: { fromId: event.fromId ?? '', toId: event.toId, at: event.at },
      }
      const told = handoffNotice(recipientId, transfer.fromId, bookId, event.id, event.at)
      if (told) {
        values[`friends/${transfer.fromId}/notifications/${told.notice.id}`] = notificationValue({ ...told.notice, kind: 'took' })
      }
      await write(values)
    },
    async declineOffer(bookId, recipientId, at, noticeId) {
      const transfer = current.transfers[bookId]
      const book = current.books.find((item) => item.id === bookId)
      if (!transfer || !book || transfer.toId !== recipientId) return
      const told = handoffNotice(recipientId, transfer.fromId, bookId, noticeId, at)
      const values: Record<string, unknown> = {
        [`settings/transfers/${bookId}`]: null,
        [`friends/${recipientId}/notifications/${offerNoticeId(bookId)}`]: null,
      }
      if (told) values[`friends/${transfer.fromId}/notifications/${told.notice.id}`] = notificationValue({ ...told.notice, kind: 'decline' })
      await write(values)
    },
    async saveBook(book) {
      const creating = !current.books.some((item) => item.id === book.id)
      const values: Record<string, unknown> = {
        [`books/${book.id}/title`]: book.title,
        [`books/${book.id}/author`]: book.author,
        [`books/${book.id}/coverUrl`]: book.coverUrl ?? '',
        [`books/${book.id}/buyerId`]: book.buyerId,
        [`books/${book.id}/order`]: book.order,
      }
      if (creating) values[`books/${book.id}/holderId`] = book.holderId || book.buyerId
      await write(values)
    },
    async passBook(bookId, toId, event, actorId) {
      const book = current.books.find((item) => item.id === bookId)
      if (!book || !current.friends.some((friend) => friend.id === toId && friend.approved)) return
      const values: Record<string, unknown> = {
        [`books/${bookId}/holderId`]: toId,
        [`settings/handoffs/${bookId}/${event.id}`]: { fromId: event.fromId ?? '', toId: event.toId, at: event.at },
      }
      const built = handoffNotice(actorId, toId, bookId, event.id, event.at)
      if (built && current.friends.some((friend) => friend.id === built.recipientId)) {
        values[`friends/${built.recipientId}/notifications/${built.notice.id}`] = notificationValue(built.notice)
      }
      await write(values)
    },
    async deleteBook(bookId, reviews = current.reviews) {
      const values: Record<string, unknown> = {
        [`books/${bookId}`]: null,
        [`reads/${bookId}`]: null,
        [`reading/${bookId}`]: null,
        [`settings/nudges/${bookId}`]: null,
        [`settings/queues/${bookId}`]: null,
        [`settings/handoffs/${bookId}`]: null,
        [`settings/transfers/${bookId}`]: null,
      }
      for (const review of reviews) {
        if (review.bookId === bookId) values[`reviews/${review.id}`] = null
      }
      await write(values)
    },
    async setRead(bookId, friendId, read, clearReading) {
      const values: Record<string, unknown> = {
        [`reads/${bookId}/${friendId}`]: read ? true : null,
      }
      if (read) values[`settings/queues/${bookId}/${friendId}`] = null
      if (clearReading) {
        values[`reading/${bookId}`] = null
        values[`settings/nudges/${bookId}`] = null
      }
      await write(values)
    },
    async setReading(bookId, friendId) {
      if (!holderMaySetReading(current, bookId, friendId)) return
      const values: Record<string, unknown> = { [`reading/${bookId}`]: friendId }
      values[`settings/nudges/${bookId}`] = null
      if (friendId) values[`settings/queues/${bookId}/${friendId}`] = null
      await write(values)
    },
    async addReview(review) {
      const values: Record<string, unknown> = { [`reviews/${review.id}`]: reviewPayload(review) }
      if (review.parentId) {
        const parent = current.reviews.find((item) => item.id === review.parentId)
        const built = parent ? replyNotice(parent, review) : null
        if (built) values[`friends/${built.recipientId}/notifications/${built.notice.id}`] = notificationValue(built.notice)
      }
      await write(values)
    },
    async updateReview(reviewId, text, editedAt) {
      await write({
        [`reviews/${reviewId}/text`]: text,
        [`reviews/${reviewId}/editedAt`]: editedAt,
      })
    },
    async deleteReview(reviewId) {
      const next = nextReviewsAfterDelete(current.reviews, reviewId)
      const nextById = new Map(next.map((review) => [review.id, review]))
      const values: Record<string, unknown> = {}
      for (const review of current.reviews) {
        const updated = nextById.get(review.id)
        if (!updated) values[`reviews/${review.id}`] = null
        else if (updated.deleted && !review.deleted) values[`reviews/${review.id}/deleted`] = true
      }
      if (Object.keys(values).length === 0) return
      await write(values)
    },
    async setReviewLike(reviewId, friendId, like) {
      const values: Record<string, unknown> = {
        [`reviews/${reviewId}/likes/${friendId}`]: like ? true : null,
      }
      const review = current.reviews.find((item) => item.id === reviewId)
      const built = review ? likeNotice(review, friendId, Date.now()) : null
      if (built) {
        values[`friends/${built.recipientId}/notifications/${built.notice.id}`] = like ? notificationValue(built.notice) : null
      }
      await write(values)
    },
    async setNudge(bookId, friendId, at) {
      const readerId = current.reading[bookId]
      if (!readerId || readerId === friendId) return
      const previous = current.nudgeSends[friendId] ?? []
      const next = nextNudgeSends(previous, at)
      if (!next) throw new Error('오늘 독촉은 다 썼어용')
      const values: Record<string, unknown> = { [`settings/nudges/${bookId}/${friendId}`]: at }
      const kept = new Set(next)
      for (const old of previous) {
        if (!kept.has(old)) values[`friends/${friendId}/nudgeSends/${old}`] = null
      }
      values[`friends/${friendId}/nudgeSends/${at}`] = at
      const built = nudgeNotice(current.reading[bookId], bookId, friendId, at)
      if (built) values[`friends/${built.recipientId}/notifications/${built.notice.id}`] = notificationValue(built.notice)
      await write(values)
    },
    async clearNudges(bookId) {
      await write({ [`settings/nudges/${bookId}`]: null })
    },
    async setQueue(bookId, friendId, at) {
      await write({ [`settings/queues/${bookId}/${friendId}`]: at })
    },
    async saveAdmin(admin) {
      await write({ 'settings/admin': { salt: admin.salt, hash: admin.hash } })
    },
    async savePatchNote(note) {
      if (!isSafeId(note.id)) throw new Error('패치노트를 저장하지 못했어용.')
      await write({
        [`settings/patchNotes/${note.id}`]: { date: note.date, lines: note.lines },
        'settings/patchNotesReady': true,
      })
    },
    async deletePatchNote(id) {
      if (!isSafeId(id)) throw new Error('패치노트를 지우지 못했어용.')
      await write({
        [`settings/patchNotes/${id}`]: null,
        'settings/patchNotesReady': true,
      })
    },
    async addRequest(post) {
      await write({ [`settings/requests/${post.id}`]: requestPayload(post) })
    },
    async deleteRequest(postId) {
      await write({ [`settings/requests/${postId}`]: null })
    },
    async setRequestDone(postId, done) {
      await write({ [`settings/requests/${postId}/done`]: done })
    },
    async addRequestReply(postId, reply) {
      const values: Record<string, unknown> = {
        [`settings/requests/${postId}/replies/${reply.id}`]: { text: reply.text, createdAt: reply.createdAt },
      }
      const post = current.posts.find((item) => item.id === postId)
      const author = post && current.friends.some((friend) => friend.id === post.friendId) ? post : null
      const built = author ? requestNotice(author, reply) : null
      if (built) values[`friends/${built.recipientId}/notifications/${built.notice.id}`] = notificationValue(built.notice)
      await write(values)
    },
    async markNotificationsRead(friendId, ids) {
      const values: Record<string, unknown> = {}
      for (const id of ids) {
        if (!isSafeId(friendId) || !isSafeId(id)) continue
        values[`friends/${friendId}/notifications/${id}/read`] = true
      }
      if (Object.keys(values).length === 0) return
      await write(values)
    },
    async clearBooks() {
      await write({
        books: null,
        reads: null,
        reading: null,
        reviews: null,
        'settings/nudges': null,
        'settings/queues': null,
        'settings/handoffs': null,
        'settings/transfers': null,
      })
    },
  }
}

function dropSends(sends: ShelfData['nudgeSends'], friendId: string): ShelfData['nudgeSends'] {
  if (!sends[friendId]) return sends
  const next = { ...sends }
  delete next[friendId]
  return next
}

function holderMaySetReading(shelf: ShelfData, bookId: string, friendId: string | null): boolean {
  const book = shelf.books.find((item) => item.id === bookId)
  if (!book) return false
  const holder = resolvedHolderId(book, new Set(shelf.friends.filter((friend) => friend.approved).map((friend) => friend.id)))
  if (!holder) return false
  if (friendId) return friendId === holder
  return shelf.reading[bookId] === holder
}

function withoutId(queue: ShelfData['queues'], bookId: string, friendId: string): ShelfData['queues'] {
  const next = { ...queue, [bookId]: (queue[bookId] ?? []).filter((id) => id !== friendId) }
  if (next[bookId].length === 0) delete next[bookId]
  return next
}

function createDemoRepo(): ShelfRepository {
  let current = readDemo()
  let listener: ShelfListener | null = null
  let channel: BroadcastChannel | null = null

  function persist(next: ShelfData, notify: boolean) {
    current = next
    const payload = toPersisted(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // private mode still keeps this tab's memory
    }
    channel?.postMessage(payload)
    if (notify) listener?.(current, { connected: true })
  }

  function accept(raw: unknown) {
    const next = fromPersisted(raw)
    if (!next) return
    current = next
    listener?.(current, { connected: true })
  }

  return {
    mode: 'demo',
    subscribe(onData) {
      listener = onData
      channel?.close()
      channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(STORAGE_KEY)
      if (channel) channel.onmessage = (event) => accept(event.data)
      const onStorage = (event: StorageEvent) => {
        if (event.key !== STORAGE_KEY || !event.newValue) return
        try {
          accept(JSON.parse(event.newValue))
        } catch {
          // ignore malformed storage
        }
      }
      window.addEventListener('storage', onStorage)
      onData(current, { connected: true })
      return () => {
        listener = null
        window.removeEventListener('storage', onStorage)
        channel?.close()
        channel = null
      }
    },
    async saveFriend(friend) {
      const friends = current.friends.some((item) => item.id === friend.id)
        ? current.friends.map((item) => (item.id === friend.id ? friend : item))
        : [...current.friends, friend]
      persist({ ...current, friends }, true)
    },
    async deleteFriend(friendId) {
      const reads = Object.fromEntries(
        Object.entries(current.reads).map(([bookId, marks]) => {
          const next = { ...marks }
          delete next[friendId]
          return [bookId, next]
        }),
      )
      const reading = Object.fromEntries(Object.entries(current.reading).filter(([, reader]) => reader !== friendId))
      const nudges = Object.fromEntries(
        Object.entries(current.nudges)
          .map(([bookId, ids]) => [bookId, ids.filter((id) => id !== friendId)] as const)
          .filter(([, ids]) => ids.length > 0),
      )
      const queues = Object.fromEntries(
        Object.entries(current.queues)
          .map(([bookId, ids]) => [bookId, ids.filter((id) => id !== friendId)] as const)
          .filter(([, ids]) => ids.length > 0),
      )
      persist(
        {
          ...current,
          friends: current.friends.filter((friend) => friend.id !== friendId),
          reads,
          reading,
          reviews: reviewsAfterMemberRemoval(current.reviews, friendId),
          posts: current.posts.filter((post) => post.friendId !== friendId),
          nudges,
          queues,
          notifications: dropMemberNotifications(current, friendId).notifications,
          nudgeSends: dropSends(current.nudgeSends, friendId),
          books: current.books.map((book) => {
            const nextHolder = holderAfterRemoval(
              book,
              friendId,
              new Set(current.friends.filter((friend) => friend.id !== friendId && friend.approved).map((friend) => friend.id)),
            )
            return nextHolder === undefined ? book : { ...book, holderId: nextHolder }
          }),
          transfers: Object.fromEntries(
            Object.entries(current.transfers).filter(([, transfer]) => transfer.fromId !== friendId && transfer.toId !== friendId),
          ),
        },
        true,
      )
    },
    async saveBook(book) {
      const existing = current.books.find((item) => item.id === book.id)
      const stored: Book = existing
        ? { ...existing, ...book, holderId: book.holderId !== undefined ? book.holderId : existing.holderId }
        : { ...book, holderId: book.holderId || book.buyerId }
      const books = existing ? current.books.map((item) => (item.id === book.id ? stored : item)) : [...current.books, stored]
      persist({ ...current, books }, true)
    },
    async passBook(bookId, toId, event, actorId) {
      const book = current.books.find((item) => item.id === bookId)
      if (!book || !current.friends.some((friend) => friend.id === toId && friend.approved)) return
      let next: ShelfData = {
        ...current,
        books: current.books.map((item) => (item.id === bookId ? { ...item, holderId: toId } : item)),
        handoffs: {
          ...current.handoffs,
          [bookId]: [event, ...(current.handoffs[bookId] ?? []).filter((item) => item.id !== event.id)],
        },
      }
      const built = handoffNotice(actorId, toId, bookId, event.id, event.at)
      if (built && current.friends.some((friend) => friend.id === built.recipientId)) {
        next = withNotification(next, built.recipientId, built.notice)
      }
      persist(next, true)
    },
    async offerBook(bookId, fromId, toId, at) {
      const book = current.books.find((item) => item.id === bookId)
      if (!book || current.transfers[bookId]) throw new Error('이미 넘기는 중이에용')
      if (!current.friends.some((friend) => friend.id === toId && friend.approved)) return
      const built = handoffNotice(fromId, toId, bookId, `offer-${bookId}`, at)
      let next: ShelfData = {
        ...current,
        transfers: { ...current.transfers, [bookId]: { fromId, toId, at } },
      }
      if (built) next = withNotification(next, toId, { ...built.notice, id: offerNoticeId(bookId), kind: 'offer' })
      persist(next, true)
    },
    async cancelOffer(bookId, holderId) {
      const transfer = current.transfers[bookId]
      if (!transfer || transfer.fromId !== holderId) return
      let next: ShelfData = { ...current, transfers: { ...current.transfers } }
      delete next.transfers[bookId]
      next = withoutNotification(next, transfer.toId, offerNoticeId(bookId))
      persist(next, true)
    },
    async acceptOffer(bookId, recipientId, event) {
      const transfer = current.transfers[bookId]
      const book = current.books.find((item) => item.id === bookId)
      if (!transfer || !book || transfer.toId !== recipientId) return
      let next: ShelfData = {
        ...current,
        books: current.books.map((item) => (item.id === bookId ? { ...item, holderId: recipientId } : item)),
        transfers: { ...current.transfers },
        handoffs: {
          ...current.handoffs,
          [bookId]: [event, ...(current.handoffs[bookId] ?? []).filter((item) => item.id !== event.id)],
        },
      }
      delete next.transfers[bookId]
      next = withoutNotification(next, recipientId, offerNoticeId(bookId))
      const told = handoffNotice(recipientId, transfer.fromId, bookId, event.id, event.at)
      if (told) next = withNotification(next, transfer.fromId, { ...told.notice, kind: 'took' })
      persist(next, true)
    },
    async declineOffer(bookId, recipientId, at, noticeId) {
      const transfer = current.transfers[bookId]
      const book = current.books.find((item) => item.id === bookId)
      if (!transfer || !book || transfer.toId !== recipientId) return
      let next: ShelfData = { ...current, transfers: { ...current.transfers } }
      delete next.transfers[bookId]
      next = withoutNotification(next, recipientId, offerNoticeId(bookId))
      const told = handoffNotice(recipientId, transfer.fromId, bookId, noticeId, at)
      if (told) next = withNotification(next, transfer.fromId, { ...told.notice, kind: 'decline' })
      persist(next, true)
    },
    async deleteBook(bookId, reviews = current.reviews) {
      const reads = { ...current.reads }
      delete reads[bookId]
      const reading = { ...current.reading }
      delete reading[bookId]
      const nudges = { ...current.nudges }
      delete nudges[bookId]
      const queues = { ...current.queues }
      delete queues[bookId]
      const handoffs = { ...current.handoffs }
      delete handoffs[bookId]
      const transfers = { ...current.transfers }
      delete transfers[bookId]
      const dropped = new Set(reviews.filter((review) => review.bookId === bookId).map((review) => review.id))
      persist(
        {
          ...current,
          books: current.books.filter((book) => book.id !== bookId),
          reads,
          reading,
          reviews: current.reviews.filter((review) => review.bookId !== bookId && !dropped.has(review.id)),
          nudges,
          queues,
          handoffs,
          transfers,
        },
        true,
      )
    },
    async setRead(bookId, friendId, read, clearReading) {
      const marks = { ...current.reads[bookId] }
      if (read) marks[friendId] = true
      else delete marks[friendId]
      const reads = { ...current.reads }
      if (Object.keys(marks).length) reads[bookId] = marks
      else delete reads[bookId]
      const reading = { ...current.reading }
      const nudges = { ...current.nudges }
      const queues = read ? withoutId(current.queues, bookId, friendId) : current.queues
      if (clearReading) {
        delete reading[bookId]
        delete nudges[bookId]
      }
      persist({ ...current, reads, reading, nudges, queues }, true)
    },
    async setReading(bookId, friendId) {
      if (!holderMaySetReading(current, bookId, friendId)) return
      const reading = { ...current.reading }
      if (friendId) reading[bookId] = friendId
      else delete reading[bookId]
      const nudges = { ...current.nudges }
      delete nudges[bookId]
      const queues = friendId ? withoutId(current.queues, bookId, friendId) : current.queues
      persist({ ...current, reading, nudges, queues }, true)
    },
    async addReview(review) {
      let next: ShelfData = { ...current, reviews: [review, ...current.reviews.filter((item) => item.id !== review.id)] }
      if (review.parentId) {
        const parent = current.reviews.find((item) => item.id === review.parentId)
        const built = parent ? replyNotice(parent, review) : null
        if (built) next = withNotification(next, built.recipientId, built.notice)
      }
      persist(next, true)
    },
    async updateReview(reviewId, text, editedAt) {
      persist(
        {
          ...current,
          reviews: current.reviews.map((review) => (review.id === reviewId ? { ...review, text, editedAt } : review)),
        },
        true,
      )
    },
    async deleteReview(reviewId) {
      persist({ ...current, reviews: nextReviewsAfterDelete(current.reviews, reviewId) }, true)
    },
    async setReviewLike(reviewId, friendId, like) {
      let next: ShelfData = {
        ...current,
        reviews: current.reviews.map((review) => {
          if (review.id !== reviewId) return review
          const likes = review.likes.filter((id) => id !== friendId)
          if (like) likes.push(friendId)
          return { ...review, likes }
        }),
      }
      const review = current.reviews.find((item) => item.id === reviewId)
      const built = review ? likeNotice(review, friendId, Date.now()) : null
      if (built) {
        next = like
          ? withNotification(next, built.recipientId, built.notice)
          : withoutNotification(next, built.recipientId, built.notice.id)
      }
      persist(next, true)
    },
    async setNudge(bookId, friendId, at) {
      const readerId = current.reading[bookId]
      if (!readerId || readerId === friendId) return
      const ids = current.nudges[bookId] ?? []
      const sends = nextNudgeSends(current.nudgeSends[friendId] ?? [], at)
      if (!sends) throw new Error('오늘 독촉은 다 썼어용')
      let next: ShelfData = {
        ...current,
        nudges: { ...current.nudges, [bookId]: ids.includes(friendId) ? ids : [...ids, friendId] },
        nudgeSends: { ...current.nudgeSends, [friendId]: sends },
      }
      const built = nudgeNotice(current.reading[bookId], bookId, friendId, at)
      if (built) next = withNotification(next, built.recipientId, built.notice)
      persist(next, true)
    },
    async clearNudges(bookId) {
      const nudges = { ...current.nudges }
      delete nudges[bookId]
      persist({ ...current, nudges }, true)
    },
    async setQueue(bookId, friendId, at) {
      if (at === null) {
        persist({ ...current, queues: withoutId(current.queues, bookId, friendId) }, true)
        return
      }
      const ids = current.queues[bookId] ?? []
      if (ids.includes(friendId)) return
      persist({ ...current, queues: { ...current.queues, [bookId]: [...ids, friendId] } }, true)
    },
    async saveAdmin(admin) {
      persist({ ...current, admin }, true)
    },
    async savePatchNote(note) {
      if (!isSafeId(note.id)) throw new Error('패치노트를 저장하지 못했어용.')
      const rest = current.patchNotes.filter((item) => item.id !== note.id)
      persist({ ...current, patchNotes: [note, ...rest], patchNotesReady: true }, true)
    },
    async deletePatchNote(id) {
      if (!isSafeId(id)) throw new Error('패치노트를 지우지 못했어용.')
      persist(
        { ...current, patchNotes: current.patchNotes.filter((item) => item.id !== id), patchNotesReady: true },
        true,
      )
    },
    async addRequest(post) {
      persist({ ...current, posts: [post, ...current.posts.filter((item) => item.id !== post.id)] }, true)
    },
    async deleteRequest(postId) {
      persist({ ...current, posts: current.posts.filter((post) => post.id !== postId) }, true)
    },
    async setRequestDone(postId, done) {
      persist(
        { ...current, posts: current.posts.map((post) => (post.id === postId ? { ...post, done } : post)) },
        true,
      )
    },
    async addRequestReply(postId, reply) {
      const post = current.posts.find((item) => item.id === postId)
      let next: ShelfData = {
        ...current,
        posts: current.posts.map((item) => (item.id === postId ? { ...item, replies: [...item.replies, reply] } : item)),
      }
      const author = post && current.friends.some((friend) => friend.id === post.friendId) ? post : null
      const built = author ? requestNotice(author, reply) : null
      if (built) next = withNotification(next, built.recipientId, built.notice)
      persist(next, true)
    },
    async markNotificationsRead(friendId, ids) {
      persist(readNotifications(current, friendId, ids), true)
    },
    async clearBooks() {
      persist(
        { ...current, books: [], reads: {}, reading: {}, reviews: [], nudges: {}, queues: {}, handoffs: {}, transfers: {} },
        true,
      )
    },
  }
}

function readDemo(): ShelfData {
  let data: ShelfData | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) data = fromPersisted(JSON.parse(raw))
  } catch {
    data = null
  }
  if (!data) {
    data = starterShelf()
  }
  const seeded = seedPatchNotesOnce(data)
  if (!data.patchNotesReady || seeded.patchNotes !== data.patchNotes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(seeded)))
    } catch {
      // ignore
    }
  }
  return seeded
}

/** Copies the built-in list a single time. After that the saved list, even empty, wins. */
function seedPatchNotesOnce(data: ShelfData): ShelfData {
  if (data.patchNotesReady) return data
  if (data.patchNotes.length > 0) return { ...data, patchNotesReady: true }
  return {
    ...data,
    patchNotes: PATCH_NOTES.map((note) => ({ id: note.id, date: note.date, lines: [...note.lines] })),
    patchNotesReady: true,
  }
}

export function createRepository(): ShelfRepository {
  if (import.meta.env.VITE_DEMO === '1') return createDemoRepo()
  if (readFirebaseConfig()) return createFirebaseRepo()
  return createDemoRepo()
}

