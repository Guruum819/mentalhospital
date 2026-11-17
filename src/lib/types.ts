export type Friend = {
  id: string
  name: string
  order: number
  color: string
  photo: string | null
  /** YYYY-MM-DD. Together with name, this is the login key. */
  birthday: string
  /** Missing on older records means approved. New signups stay false until an admin allows them. */
  approved: boolean
}

export type Review = {
  id: string
  bookId: string
  friendId: string
  text: string
  createdAt: number
  /** 0–5 in steps of 0.5. Null on a reply, or if a review was saved before ratings existed. */
  rating: number | null
  /** Set when this is a one-level reply to another review. */
  parentId: string | null
  editedAt: number | null
  /** Friend ids who liked this review. One like per member. */
  likes: string[]
}

export type BoardReply = {
  id: string
  text: string
  createdAt: number
}

export type BoardPost = {
  id: string
  friendId: string
  anonymous: boolean
  text: string
  createdAt: number
  done: boolean
  replies: BoardReply[]
}

export type AdminLock = {
  salt: string
  hash: string
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

/** bookId → friend ids, oldest first. */
export type IdQueue = Record<string, string[]>

export type ShelfData = {
  friends: Friend[]
  books: Book[]
  reads: ReadMap
  /** bookId → friendId of the person currently reading that copy. */
  reading: Record<string, string>
  reviews: Review[]
  admin: AdminLock | null
  posts: BoardPost[]
  nudges: IdQueue
  queues: IdQueue
  initialized: boolean
}

export type SyncMode = 'firebase' | 'demo'

export type BookSort = 'new' | 'popular' | 'read'
export type CommentSort = 'likes' | 'new'
