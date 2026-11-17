import { booksRecord, friendsRecord } from './model.ts'
import type { ShelfData } from './types.ts'

/** 친구 이름은 넣지 않습니다. 프로필을 만든 사람만 목록에 쌓입니다. */
export function starterShelf(current?: Pick<ShelfData, 'passcodeSalt' | 'passcodeHash'>): ShelfData {
  return {
    friends: [],
    books: [],
    reads: {},
    reading: {},
    reviews: [],
    passcodeSalt: current?.passcodeSalt ?? null,
    passcodeHash: current?.passcodeHash ?? null,
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
  }
}

export function starterFirebaseUpdate(current?: Pick<ShelfData, 'passcodeSalt' | 'passcodeHash'>) {
  const shelf = starterShelf(current)
  return {
    friends: friendsRecord(shelf.friends),
    books: booksRecord(shelf.books),
    reads: null,
    reading: null,
    reviews: null,
    'settings/initialized': true,
    'settings/passcodeSalt': shelf.passcodeSalt,
    'settings/passcodeHash': shelf.passcodeHash,
  }
}
