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
  /** Set when this comment answers another comment. Replies can nest without a depth limit. */
  parentId: string | null
  /** The text stays in storage, but the thread shows a placeholder so children are not lost. */
  deleted?: boolean
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

/** One member's inbox item. Stored under that member in Realtime Database. */
export type Notice = {
  id: string
  kind: 'like' | 'reply' | 'nudge' | 'request' | 'handoff' | 'offer' | 'took' | 'decline'
  actorId: string
  /** Empty when this opens the request board instead of a book. */
  bookId: string
  /** Parent review for a like or reply. Empty for a nudge or a board reply. */
  reviewId: string | null
  /** Board post for an admin reply. */
  postId: string | null
  /** Reply text. Empty for a like or nudge. */
  preview: string | null
  createdAt: number
  read: boolean
}

export type Book = {
  id: string
  title: string
  author: string
  coverUrl: string | null
  buyerId: string
  order: number
  /**
   * Who physically has the copy.
   * Missing or null follows the buyer. '' means nobody has it.
   */
  holderId?: string | null
}

export type Handoff = {
  id: string
  fromId: string | null
  toId: string
  at: number
}

/** One open hand-off ask per book. The holder does not change until it is accepted. */
export type Transfer = {
  fromId: string
  toId: string
  at: number
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
  /** recipient friend id → newest first. */
  notifications: Record<string, Notice[]>
  /** friend id → timestamps of 독촉 they sent. The daily cap counts Seoul midnights. */
  nudgeSends: Record<string, number[]>
  /** bookId → newest handoff first. */
  handoffs: Record<string, Handoff[]>
  /** bookId → the one pending hand-off, if someone has been asked. */
  transfers: Record<string, Transfer>
  patchNotes: PatchNote[]
  /** True after the notes have been seeded or saved. An empty list then stays empty. */
  patchNotesReady: boolean
  initialized: boolean
}

export type SyncMode = 'firebase' | 'demo'

export type PatchNote = {
  id: string
  /** YYYY-MM-DD. */
  date: string
  lines: string[]
}

export type BookSort = 'new' | 'popular' | 'read'
export type CommentSort = 'likes' | 'new'
