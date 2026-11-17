import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  connectDatabaseEmulator,
  getDatabase,
  onValue,
  ref,
  update,
  type Database,
} from 'firebase/database'
import { emulatorAddress, readFirebaseConfig } from './config.ts'
import {
  dropMemberNotifications,
  fromFirebase,
  fromPersisted,
  isSafeId,
  likeNotice,
  nextNudgeSends,
  nudgeNotice,
  readNotifications,
  requestNotice,
  replyNotice,
  toPersisted,
  withNotification,
  withoutNotification,
} from './model.ts'
import { starterFirebaseUpdate, starterShelf } from './seed.ts'
import type { AdminLock, BoardPost, BoardReply, Book, Friend, Notice, Review, ShelfData, SyncMode } from './types.ts'

const STORAGE_KEY = 'exchange-reading-v2'
const EMULATOR_FLAG = '__exchangeReadingEmulator'

export type ShelfListener = (data: ShelfData, meta: { connected: boolean }) => void

export interface ShelfRepository {
  mode: SyncMode
  subscribe: (onData: ShelfListener, onError: (message: string) => void) => () => void
  saveFriend: (friend: Friend) => Promise<void>
  deleteFriend: (friendId: string) => Promise<void>
  saveBook: (book: Book) => Promise<void>
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
      const removed = new Set<string>()
      for (const review of current.reviews) {
        if (review.friendId === friendId) {
          values[`reviews/${review.id}`] = null
          removed.add(review.id)
        } else if (review.likes.includes(friendId)) {
          values[`reviews/${review.id}/likes/${friendId}`] = null
        }
      }
      for (const review of current.reviews) {
        if (review.parentId && removed.has(review.parentId)) values[`reviews/${review.id}`] = null
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
      await write(values)
    },
    async saveBook(book) {
      await write({
        [`books/${book.id}`]: {
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl ?? '',
          buyerId: book.buyerId,
          order: book.order,
        },
      })
    },
    async deleteBook(bookId, reviews = current.reviews) {
      const values: Record<string, unknown> = {
        [`books/${bookId}`]: null,
        [`reads/${bookId}`]: null,
        [`reading/${bookId}`]: null,
        [`settings/nudges/${bookId}`]: null,
        [`settings/queues/${bookId}`]: null,
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
      if (clearReading) {
        values[`reading/${bookId}`] = null
        values[`settings/nudges/${bookId}`] = null
      }
      await write(values)
    },
    async setReading(bookId, friendId) {
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
      const values: Record<string, unknown> = { [`reviews/${reviewId}`]: null }
      for (const review of current.reviews) {
        if (review.parentId === reviewId) values[`reviews/${review.id}`] = null
      }
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
      if ((current.nudges[bookId] ?? []).includes(friendId)) return
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
      const removed = new Set(current.reviews.filter((review) => review.friendId === friendId).map((review) => review.id))
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
          reviews: current.reviews
            .filter((review) => review.friendId !== friendId && !(review.parentId && removed.has(review.parentId)))
            .map((review) => ({ ...review, likes: review.likes.filter((id) => id !== friendId) })),
          posts: current.posts.filter((post) => post.friendId !== friendId),
          nudges,
          queues,
          notifications: dropMemberNotifications(current, friendId).notifications,
          nudgeSends: dropSends(current.nudgeSends, friendId),
        },
        true,
      )
    },
    async saveBook(book) {
      const books = current.books.some((item) => item.id === book.id)
        ? current.books.map((item) => (item.id === book.id ? book : item))
        : [...current.books, book]
      persist({ ...current, books }, true)
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
      if (clearReading) {
        delete reading[bookId]
        delete nudges[bookId]
      }
      persist({ ...current, reads, reading, nudges }, true)
    },
    async setReading(bookId, friendId) {
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
      persist(
        {
          ...current,
          reviews: current.reviews.filter((review) => review.id !== reviewId && review.parentId !== reviewId),
        },
        true,
      )
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
      if (ids.includes(friendId)) return
      const sends = nextNudgeSends(current.nudgeSends[friendId] ?? [], at)
      if (!sends) throw new Error('오늘 독촉은 다 썼어용')
      let next: ShelfData = {
        ...current,
        nudges: { ...current.nudges, [bookId]: [...ids, friendId] },
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
        { ...current, books: [], reads: {}, reading: {}, reviews: [], nudges: {}, queues: {} },
        true,
      )
    },
  }
}

function readDemo(): ShelfData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = fromPersisted(JSON.parse(raw))
      if (parsed) return parsed
    }
  } catch {
    // fall through to the shared starter shelf
  }
  const seed = starterShelf()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(seed)))
  } catch {
    // ignore
  }
  return seed
}

export function createRepository(): ShelfRepository {
  if (import.meta.env.VITE_DEMO === '1') return createDemoRepo()
  if (readFirebaseConfig()) return createFirebaseRepo()
  return createDemoRepo()
}

