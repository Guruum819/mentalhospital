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
import { booksRecord, friendsRecord, fromFirebase, fromPersisted, reviewsRecord, toPersisted } from './model.ts'
import { clearedBooks, starterFirebaseUpdate, starterShelf } from './seed.ts'
import type { Book, Friend, Review, ShelfData, SyncMode } from './types.ts'

const STORAGE_KEY = 'exchange-reading-v2'
const EMULATOR_FLAG = '__exchangeReadingEmulator'

export type ShelfListener = (data: ShelfData, meta: { connected: boolean }) => void

export interface ShelfRepository {
  mode: SyncMode
  subscribe: (onData: ShelfListener, onError: (message: string) => void) => () => void
  saveFriend: (friend: Friend) => Promise<void>
  deleteFriend: (friendId: string) => Promise<void>
  saveBook: (book: Book) => Promise<void>
  deleteBook: (bookId: string) => Promise<void>
  setRead: (bookId: string, friendId: string, read: boolean, clearReading: boolean) => Promise<void>
  setReading: (bookId: string, friendId: string | null) => Promise<void>
  addReview: (review: Review) => Promise<void>
  deleteReview: (reviewId: string) => Promise<void>
  replaceShelf: (data: ShelfData) => Promise<void>
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

function createFirebaseRepo(): ShelfRepository {
  let current = starterShelf()
  let seeding = false

  return {
    mode: 'firebase',
    subscribe(onData, onError) {
      const db = database()
      let connected = false
      let seen = false
      const unsubData = onValue(
        ref(db),
        (snap) => {
          const data = fromFirebase(snap.val())
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
          if (!data.initialized) {
            void write({ 'settings/initialized': true }).catch(() => undefined)
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
        [`friends/${friend.id}`]: {
          name: friend.name,
          order: friend.order,
          color: friend.color,
          photo: friend.photo ?? '',
          birthday: friend.birthday,
        },
      })
    },
    async deleteFriend(friendId) {
      const values: Record<string, unknown> = { [`friends/${friendId}`]: null }
      for (const book of current.books) values[`reads/${book.id}/${friendId}`] = null
      for (const [bookId, readerId] of Object.entries(current.reading)) {
        if (readerId === friendId) values[`reading/${bookId}`] = null
      }
      for (const review of current.reviews) {
        if (review.friendId === friendId) values[`reviews/${review.id}`] = null
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
    async deleteBook(bookId) {
      const values: Record<string, unknown> = {
        [`books/${bookId}`]: null,
        [`reads/${bookId}`]: null,
        [`reading/${bookId}`]: null,
      }
      for (const review of current.reviews) {
        if (review.bookId === bookId) values[`reviews/${review.id}`] = null
      }
      await write(values)
    },
    async setRead(bookId, friendId, read, clearReading) {
      const values: Record<string, unknown> = {
        [`reads/${bookId}/${friendId}`]: read ? true : null,
      }
      if (clearReading) values[`reading/${bookId}`] = null
      await write(values)
    },
    async setReading(bookId, friendId) {
      await write({ [`reading/${bookId}`]: friendId })
    },
    async addReview(review) {
      await write({
        [`reviews/${review.id}`]: {
          bookId: review.bookId,
          friendId: review.friendId,
          text: review.text,
          createdAt: review.createdAt,
          rating: review.rating,
        },
      })
    },
    async deleteReview(reviewId) {
      await write({ [`reviews/${reviewId}`]: null })
    },
    async replaceShelf(data) {
      await write({
        friends: friendsRecord(data.friends),
        books: booksRecord(data.books),
        reads: Object.keys(data.reads).length ? data.reads : null,
        reading: Object.keys(data.reading).length ? data.reading : null,
        reviews: data.reviews.length ? reviewsRecord(data.reviews) : null,
        'settings/initialized': true,
        'settings/passcodeSalt': data.passcodeSalt,
        'settings/passcodeHash': data.passcodeHash,
      })
    },
  }
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
      const reading = Object.fromEntries(
        Object.entries(current.reading).filter(([, reader]) => reader !== friendId),
      )
      persist(
        {
          ...current,
          friends: current.friends.filter((friend) => friend.id !== friendId),
          reads,
          reading,
          reviews: current.reviews.filter((review) => review.friendId !== friendId),
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
    async deleteBook(bookId) {
      const reads = { ...current.reads }
      delete reads[bookId]
      const reading = { ...current.reading }
      delete reading[bookId]
      persist(
        {
          ...current,
          books: current.books.filter((book) => book.id !== bookId),
          reads,
          reading,
          reviews: current.reviews.filter((review) => review.bookId !== bookId),
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
      if (clearReading) delete reading[bookId]
      persist({ ...current, reads, reading }, true)
    },
    async setReading(bookId, friendId) {
      const reading = { ...current.reading }
      if (friendId) reading[bookId] = friendId
      else delete reading[bookId]
      persist({ ...current, reading }, true)
    },
    async addReview(review) {
      persist({ ...current, reviews: [review, ...current.reviews.filter((item) => item.id !== review.id)] }, true)
    },
    async deleteReview(reviewId) {
      persist({ ...current, reviews: current.reviews.filter((review) => review.id !== reviewId) }, true)
    },
    async replaceShelf(data) {
      persist(data, true)
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
  if (readFirebaseConfig()) return createFirebaseRepo()
  return createDemoRepo()
}

export function emptyReplacement(current: ShelfData): ShelfData {
  return clearedBooks(current)
}
