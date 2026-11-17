import { booksRecord, friendsRecord } from './model.ts'
import type { ShelfData } from './types.ts'

/** 친구 이름은 넣지 않습니다. 프로필을 만든 사람만 목록에 쌓입니다. */
export function starterShelf(): ShelfData {
  return {
    friends: [],
    books: [],
    reads: {},
    reading: {},
    reviews: [],
    admin: null,
    posts: [],
    nudges: {},
    queues: {},
    notifications: {},
    nudgeSends: {},
    handoffs: {},
    initialized: true,
  }
}

export function clearedBooks(current: ShelfData): ShelfData {
  return {
    ...current,
    books: [],
    reads: {},
    reading: {},
    reviews: [],
    nudges: {},
    queues: {},
  }
}

export function starterFirebaseUpdate() {
  const shelf = starterShelf()
  return {
    friends: friendsRecord(shelf.friends),
    books: booksRecord(shelf.books),
    reads: null,
    reading: null,
    reviews: null,
    'settings/initialized': true,
  }
}
