export type Friend = {
  id: string
  name: string
  order: number
  color: string
  photo: string | null
  /** YYYY-MM-DD. Together with name, this is the login key. */
  birthday: string
}

export type Review = {
  id: string
  bookId: string
  friendId: string
  text: string
  createdAt: number
  /** 0–5 in steps of 0.5. Null if a review was saved before ratings existed. */
  rating: number | null
}

export type Book = {
  id: string
  title: string
  author: string
  coverUrl: string | null
  buyerId: string
  order: number
}

export type ReadMap = Record<string, Record<string, true>>

export type ShelfData = {
  friends: Friend[]
  books: Book[]
  reads: ReadMap
  /** bookId → friendId of the person currently reading that copy. */
  reading: Record<string, string>
  reviews: Review[]
  passcodeSalt: string | null
  passcodeHash: string | null
  initialized: boolean
}

export type SyncMode = 'firebase' | 'demo'
