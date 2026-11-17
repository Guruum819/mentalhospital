import { PALETTE } from './palette.ts'
import type { Book, BookSort, CommentSort, Friend, IdQueue, Notice, ReadMap, Review, ShelfData } from './types.ts'

export const MAX_NAME = 20
export const MAX_TITLE = 80
export const MAX_AUTHOR = 60
export const MAX_BOOKS = 200

const BAD_ID = /[.#$[\]/\u0000-\u001f]/

export function emptyShelf(): ShelfData {
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
    initialized: false,
  }
}

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.slice(0, max)
}

export function isSafeId(id: string): boolean {
  return id.length > 0 && id.length <= 80 && !BAD_ID.test(id)
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function nextOrder(items: readonly { order: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.order), 0) + 1
}

export function countReads(
  reads: ReadMap,
  bookId: string,
  friendIds: readonly string[],
): number {
  const marks = reads[bookId]
  if (!marks) return 0
  return friendIds.reduce((total, id) => total + (marks[id] ? 1 : 0), 0)
}

export function countFriendReads(
  reads: ReadMap,
  friendId: string,
  bookIds: readonly string[],
): number {
  return bookIds.reduce((total, id) => total + (reads[id]?.[friendId] ? 1 : 0), 0)
}

export function visibleFriends(friends: readonly Friend[]): Friend[] {
  return friends.filter((friend) => friend.approved)
}

export function shelfStats(data: ShelfData) {
  const friendIds = visibleFriends(data.friends).map((friend) => friend.id)
  const readCells = data.books.reduce(
    (total, book) => total + countReads(data.reads, book.id, friendIds),
    0,
  )
  return {
    bookCount: data.books.length,
    friendCount: friendIds.length,
    readCells,
    totalCells: data.books.length * friendIds.length,
  }
}

export function hasFriendName(
  friends: readonly Friend[],
  name: string,
  exceptId?: string,
): boolean {
  const key = name.trim()
  return friends.some((friend) => friend.id !== exceptId && friend.name.trim() === key)
}

export function cleanBirthday(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  if (year < 1900) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date.getTime() > today.getTime()) return null
  return value
}

export function sameIdentity(
  friends: readonly Friend[],
  name: string,
  birthday: string,
  exceptId?: string,
): boolean {
  const key = name.trim()
  return friends.some(
    (friend) => friend.id !== exceptId && friend.name.trim() === key && friend.birthday === birthday,
  )
}

export function findProfile(friends: readonly Friend[], name: string, birthday: string): Friend | null {
  const key = name.trim()
  const matches = friends.filter((friend) => friend.name.trim() === key && friend.birthday === birthday)
  return matches.length === 1 ? matches[0] : null
}

export function colorTaken(
  friends: readonly Friend[],
  color: string,
  exceptId?: string,
): Friend | undefined {
  return friends.find((friend) => friend.id !== exceptId && friend.color === color)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseColor(value: unknown): string | null {
  return typeof value === 'string' && PALETTE.some((color) => color.id === value)
    ? value
    : null
}

function sortFriends(friends: Friend[]): Friend[] {
  return friends.sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko'),
  )
}

function sortBooks(books: Book[]): Book[] {
  return books.sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ko'),
  )
}

function parseReads(raw: unknown): ReadMap {
  if (!isRecord(raw)) return {}
  const reads: ReadMap = {}
  for (const [bookId, marks] of Object.entries(raw)) {
    if (!isSafeId(bookId) || !isRecord(marks)) continue
    const kept: Record<string, true> = {}
    for (const [friendId, value] of Object.entries(marks)) {
      if (value === true && isSafeId(friendId)) kept[friendId] = true
    }
    if (Object.keys(kept).length > 0) reads[bookId] = kept
  }
  return reads
}

function friendFrom(id: string, raw: unknown): Friend | null {
  if (!isSafeId(id) || !isRecord(raw)) return null
  const name = cleanText(raw.name, MAX_NAME)
  const color = parseColor(raw.color)
  if (!name || !color) return null
  const order = typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : 0
  const birthday = cleanBirthday(raw.birthday)
  if (!birthday) return null
  return {
    id,
    name,
    color,
    order,
    photo: cleanPhoto(raw.photo),
    birthday,
    approved: raw.approved !== false,
  }
}

export const MAX_REVIEW = 200
const MAX_PHOTO = 150_000

export function cleanPhoto(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('data:image/jpeg;base64,')) return null
  if (value.length > MAX_PHOTO) return null
  return value
}

export function snapRating(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  if (!Number.isFinite(number)) return null
  const snapped = Math.round(number * 2) / 2
  if (snapped < 0 || snapped > 5) return null
  return snapped
}

export function averageRating(reviews: readonly Pick<Review, 'rating'>[]): number | null {
  const values = reviews.map((review) => review.rating).filter((rating): rating is number => rating !== null)
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, rating) => sum + rating, 0) / values.length) * 10) / 10
}

export function cleanReview(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const chars = Array.from(text)
  return chars.length > MAX_REVIEW ? chars.slice(0, MAX_REVIEW).join('') : text
}

const MAX_COVER_URL = 800
const MAX_COVER_DATA = 180_000

export function cleanCover(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value.startsWith('data:image/jpeg;base64,')) {
    if (value.length > MAX_COVER_DATA) return null
    return value
  }
  const url = value.trim().replace(/^http:\/\//i, 'https://')
  if (!/^https:\/\/\S+$/i.test(url) || url.length > MAX_COVER_URL) return null
  return url
}

function bookFrom(id: string, raw: unknown): Book | null {
  if (!isSafeId(id) || !isRecord(raw)) return null
  const title = cleanText(raw.title, MAX_TITLE)
  const buyerId = typeof raw.buyerId === 'string' ? raw.buyerId : ''
  if (!title || !isSafeId(buyerId)) return null
  const order = typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : 0
  return {
    id,
    title,
    author: cleanText(raw.author, MAX_AUTHOR) ?? '',
    coverUrl: cleanCover(raw.coverUrl),
    buyerId,
    order,
  }
}

function parseReviews(raw: unknown): Review[] {
  const source = Array.isArray(raw) ? raw : isRecord(raw) ? Object.entries(raw).map(([id, value]) => ({ ...(isRecord(value) ? value : {}), id })) : []
  const reviews: Review[] = []
  for (const item of source) {
    if (!isRecord(item) || typeof item.id !== 'string' || !isSafeId(item.id)) continue
    const bookId = typeof item.bookId === 'string' ? item.bookId : ''
    const friendId = typeof item.friendId === 'string' ? item.friendId : ''
    const text = cleanReview(item.text)
    const createdAt = typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : 0
    if (!isSafeId(bookId) || !isSafeId(friendId) || !text) continue
    const parentId = typeof item.parentId === 'string' && isSafeId(item.parentId) ? item.parentId : null
    const editedAt = typeof item.editedAt === 'number' && Number.isFinite(item.editedAt) ? item.editedAt : null
    reviews.push({
      id: item.id,
      bookId,
      friendId,
      text,
      createdAt,
      rating: snapRating(item.rating),
      parentId,
      editedAt,
      likes: parseLikeIds(item.likes),
    })
  }
  return reviews.sort((a, b) => b.createdAt - a.createdAt)
}

function parseLikeIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === 'string' && isSafeId(id))
  }
  if (!isRecord(raw)) return []
  return Object.entries(raw)
    .filter((entry): entry is [string, true] => entry[1] === true && isSafeId(entry[0]))
    .map(([id]) => id)
}

function parseIdQueue(raw: unknown): IdQueue {
  if (!isRecord(raw)) return {}
  const queue: IdQueue = {}
  for (const [bookId, marks] of Object.entries(raw)) {
    if (!isSafeId(bookId)) continue
    if (Array.isArray(marks)) {
      const ids = marks.filter((id): id is string => typeof id === 'string' && isSafeId(id))
      if (ids.length > 0) queue[bookId] = ids
      continue
    }
    if (!isRecord(marks)) continue
    const rows = Object.entries(marks)
      .filter((entry): entry is [string, number] => isSafeId(entry[0]) && typeof entry[1] === 'number' && Number.isFinite(entry[1]))
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    if (rows.length > 0) queue[bookId] = rows.map(([id]) => id)
  }
  return queue
}

function parseAdmin(raw: unknown): ShelfData['admin'] {
  if (!isRecord(raw)) return null
  const salt = typeof raw.salt === 'string' ? raw.salt : ''
  const hash = typeof raw.hash === 'string' ? raw.hash : ''
  if (!/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{64}$/.test(hash)) return null
  return { salt, hash }
}

function parseReplyList(raw: unknown): ShelfData['posts'][number]['replies'] {
  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw.map((item, index) => [isRecord(item) && typeof item.id === 'string' ? item.id : `reply-${index}`, item])
    : isRecord(raw)
      ? Object.entries(raw)
      : []
  return entries
    .map(([replyId, reply]) => {
      if (!isSafeId(replyId) || !isRecord(reply)) return null
      const replyText = cleanReview(reply.text)
      const at = typeof reply.createdAt === 'number' && Number.isFinite(reply.createdAt) ? reply.createdAt : 0
      if (!replyText) return null
      return { id: replyId, text: replyText, createdAt: at }
    })
    .filter((reply): reply is ShelfData['posts'][number]['replies'][number] => reply !== null)
    .sort((a, b) => a.createdAt - b.createdAt)
}

function parsePosts(raw: unknown): ShelfData['posts'] {
  if (Array.isArray(raw)) {
    const record: Record<string, unknown> = {}
    for (const item of raw) {
      if (isRecord(item) && typeof item.id === 'string' && isSafeId(item.id)) record[item.id] = item
    }
    return parsePosts(record)
  }
  if (!isRecord(raw)) return []
  const posts: ShelfData['posts'] = []
  for (const [id, value] of Object.entries(raw)) {
    if (!isSafeId(id) || !isRecord(value)) continue
    const friendId = typeof value.friendId === 'string' ? value.friendId : ''
    const text = cleanReview(value.text)
    const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : 0
    if (!isSafeId(friendId) || !text) continue
    const replies = parseReplyList(value.replies)
    posts.push({
      id,
      friendId,
      anonymous: value.anonymous === true,
      text,
      createdAt,
      done: value.done === true,
      replies,
    })
  }
  return posts.sort((a, b) => b.createdAt - a.createdAt)
}

function parseNotice(id: string, raw: unknown): Notice | null {
  if (!isSafeId(id) || !isRecord(raw)) return null
  const kind = raw.kind === 'like' || raw.kind === 'reply' || raw.kind === 'nudge' || raw.kind === 'request' ? raw.kind : null
  const actorId = typeof raw.actorId === 'string' ? raw.actorId : ''
  const bookId = typeof raw.bookId === 'string' ? raw.bookId : ''
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0
  const postId = typeof raw.postId === 'string' && isSafeId(raw.postId) ? raw.postId : null
  if (!kind || !isSafeId(actorId)) return null
  if (kind === 'request' ? !postId : !isSafeId(bookId)) return null
  const reviewId = typeof raw.reviewId === 'string' && isSafeId(raw.reviewId) ? raw.reviewId : null
  return {
    id,
    kind,
    actorId,
    bookId,
    reviewId,
    postId,
    preview: cleanReview(raw.preview),
    createdAt,
    read: raw.read === true,
  }
}

function parseNoticeList(raw: unknown): Notice[] {
  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw.map((item, index) => [isRecord(item) && typeof item.id === 'string' ? item.id : `notice-${index}`, item])
    : isRecord(raw)
      ? Object.entries(raw)
      : []
  return entries
    .map(([id, value]) => parseNotice(id, value))
    .filter((notice): notice is Notice => notice !== null)
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
}

function parseNotificationMap(raw: unknown): Record<string, Notice[]> {
  if (!isRecord(raw)) return {}
  const map: Record<string, Notice[]> = {}
  for (const [friendId, value] of Object.entries(raw)) {
    if (!isSafeId(friendId)) continue
    const list = parseNoticeList(value)
    if (list.length > 0) map[friendId] = list
  }
  return map
}

function parseStampList(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is number => typeof item === 'number' && Number.isFinite(item) && item > 0)
      .sort((a, b) => a - b)
  }
  if (!isRecord(raw)) return []
  const stamps: number[] = []
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) stamps.push(value)
    else if (value === true) {
      const at = Number(key)
      if (Number.isFinite(at) && at > 0) stamps.push(at)
    }
  }
  return [...new Set(stamps)].sort((a, b) => a - b)
}

function parseNudgeSendMap(raw: unknown): Record<string, number[]> {
  if (!isRecord(raw)) return {}
  const map: Record<string, number[]> = {}
  for (const [friendId, value] of Object.entries(raw)) {
    if (!isSafeId(friendId)) continue
    const list = parseStampList(value)
    if (list.length > 0) map[friendId] = list
  }
  return map
}

/** Realtime Database keeps each member's sends on that member: friends/{id}/nudgeSends. */
function parseNudgeSendsUnderFriends(raw: unknown): Record<string, number[]> {
  if (!isRecord(raw)) return {}
  const map: Record<string, number[]> = {}
  for (const [friendId, value] of Object.entries(raw)) {
    if (!isSafeId(friendId) || !isRecord(value)) continue
    const list = parseStampList(value.nudgeSends)
    if (list.length > 0) map[friendId] = list
  }
  return map
}

/** Realtime Database keeps each inbox on the member: friends/{id}/notifications. */
function parseNotificationsUnderFriends(raw: unknown): Record<string, Notice[]> {
  if (!isRecord(raw)) return {}
  const map: Record<string, Notice[]> = {}
  for (const [friendId, value] of Object.entries(raw)) {
    if (!isSafeId(friendId) || !isRecord(value)) continue
    const list = parseNoticeList(value.notifications)
    if (list.length > 0) map[friendId] = list
  }
  return map
}

function parseReading(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {}
  const reading: Record<string, string> = {}
  for (const [bookId, friendId] of Object.entries(raw)) {
    if (isSafeId(bookId) && typeof friendId === 'string' && isSafeId(friendId)) {
      reading[bookId] = friendId
    }
  }
  return reading
}

export function fromFirebase(raw: unknown): ShelfData {
  if (!isRecord(raw)) return emptyShelf()
  const settings = isRecord(raw.settings) ? raw.settings : {}
  const friendsRaw = isRecord(raw.friends) ? raw.friends : {}
  const friends = sortFriends(
    Object.entries(friendsRaw)
      .map(([id, value]) => friendFrom(id, value))
      .filter((friend): friend is Friend => friend !== null),
  )
  const books = sortBooks(
    Object.entries(isRecord(raw.books) ? raw.books : {})
      .map(([id, value]) => bookFrom(id, value))
      .filter((book): book is Book => book !== null),
  )
  return {
    friends,
    books,
    reads: parseReads(raw.reads),
    reading: parseReading(raw.reading),
    reviews: parseReviews(raw.reviews),
    admin: parseAdmin(settings.admin),
    posts: parsePosts(settings.requests),
    nudges: parseIdQueue(settings.nudges),
    queues: parseIdQueue(settings.queues),
    notifications: parseNotificationsUnderFriends(friendsRaw),
    nudgeSends: parseNudgeSendsUnderFriends(friendsRaw),
    initialized: settings.initialized === true,
  }
}

export function toPersisted(data: ShelfData) {
  return { version: 1 as const, ...data }
}

export function fromPersisted(raw: unknown): ShelfData | null {
  if (!isRecord(raw) || raw.version !== 1) return null
  if (!Array.isArray(raw.friends) || !Array.isArray(raw.books)) return null
  const friends = sortFriends(
    raw.friends
      .map((item) => {
        if (!isRecord(item) || typeof item.id !== 'string') return null
        return friendFrom(item.id, item)
      })
      .filter((friend): friend is Friend => friend !== null),
  )
  const books = sortBooks(
    raw.books
      .map((item) => {
        if (!isRecord(item) || typeof item.id !== 'string') return null
        return bookFrom(item.id, item)
      })
      .filter((book): book is Book => book !== null),
  )
  return {
    friends,
    books,
    reads: parseReads(raw.reads),
    reading: parseReading(raw.reading),
    reviews: parseReviews(raw.reviews),
    admin: parseAdmin(raw.admin),
    posts: parsePosts(raw.posts),
    nudges: parseIdQueue(raw.nudges),
    queues: parseIdQueue(raw.queues),
    notifications: parseNotificationMap(raw.notifications),
    nudgeSends: parseNudgeSendMap(raw.nudgeSends),
    initialized: raw.initialized === true,
  }
}

export function reviewsRecord(reviews: readonly Review[]) {
  return Object.fromEntries(
    reviews.map((review) => [
      review.id,
      {
        bookId: review.bookId,
        friendId: review.friendId,
        text: review.text,
        createdAt: review.createdAt,
        rating: review.rating,
        parentId: review.parentId,
        editedAt: review.editedAt,
        likes: Object.fromEntries(review.likes.map((id) => [id, true])),
      },
    ]),
  )
}

export function friendsRecord(friends: readonly Friend[]) {
  return Object.fromEntries(
    friends.map((friend) => [
      friend.id,
      {
        name: friend.name,
        order: friend.order,
        color: friend.color,
        photo: friend.photo ?? '',
        birthday: friend.birthday,
        approved: friend.approved,
      },
    ]),
  )
}

export function booksRecord(books: readonly Book[]) {
  return Object.fromEntries(
    books.map((book) => [
      book.id,
      {
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl ?? '',
        buyerId: book.buyerId,
        order: book.order,
      },
    ]),
  )
}

export function withRead(
  reads: ReadMap,
  bookId: string,
  friendId: string,
  read: boolean,
): ReadMap {
  const next: ReadMap = { ...reads, [bookId]: { ...reads[bookId] } }
  if (read) next[bookId][friendId] = true
  else delete next[bookId][friendId]
  if (Object.keys(next[bookId]).length === 0) delete next[bookId]
  return next
}

export function withReading(
  reading: Record<string, string>,
  bookId: string,
  friendId: string | null,
): Record<string, string> {
  const next = { ...reading }
  if (friendId) next[bookId] = friendId
  else delete next[bookId]
  return next
}

/** Toggle 읽음. Checking the person who is currently reading clears 읽는 중. */
export function toggledRead(
  data: ShelfData,
  bookId: string,
  friendId: string,
): { reads: ReadMap; reading: Record<string, string>; clearedReading: boolean } {
  const read = !data.reads[bookId]?.[friendId]
  const clearedReading = read && data.reading[bookId] === friendId
  return {
    reads: withRead(data.reads, bookId, friendId, read),
    reading: clearedReading ? withReading(data.reading, bookId, null) : data.reading,
    clearedReading,
  }
}

/** Mark 완독: I have read it, and I am no longer the current reader. */
export function markedFinished(
  data: ShelfData,
  bookId: string,
  friendId: string,
): { reads: ReadMap; reading: Record<string, string>; clearedReading: boolean } {
  const clearedReading = data.reading[bookId] === friendId
  return {
    reads: withRead(data.reads, bookId, friendId, true),
    reading: clearedReading ? withReading(data.reading, bookId, null) : data.reading,
    clearedReading,
  }
}

export function topLevelReviews(reviews: readonly Review[], bookId?: string): Review[] {
  return reviews.filter((review) => !review.parentId && (bookId === undefined || review.bookId === bookId))
}

export function sortedBooks(
  books: readonly Book[],
  mode: BookSort,
  reviews: readonly Review[],
  reads: ReadMap,
  friendIds: readonly string[],
): Book[] {
  const copy = books.slice()
  const byOrder = (a: Book, b: Book) => b.order - a.order || a.title.localeCompare(b.title, 'ko')
  if (mode === 'popular') {
    copy.sort((a, b) => {
      const left = averageRating(topLevelReviews(reviews, a.id))
      const right = averageRating(topLevelReviews(reviews, b.id))
      if (left === null && right === null) return byOrder(a, b)
      if (left === null) return 1
      if (right === null) return -1
      return right - left || byOrder(a, b)
    })
    return copy
  }
  if (mode === 'read') {
    copy.sort((a, b) => countReads(reads, b.id, friendIds) - countReads(reads, a.id, friendIds) || byOrder(a, b))
    return copy
  }
  copy.sort(byOrder)
  return copy
}

export function sortedComments(reviews: readonly Review[], mode: CommentSort): Review[] {
  const copy = reviews.slice()
  if (mode === 'likes') {
    copy.sort((a, b) => b.likes.length - a.likes.length || b.createdAt - a.createdAt)
    return copy
  }
  copy.sort((a, b) => b.createdAt - a.createdAt)
  return copy
}

const NOTICE_PREVIEW = 40

function noticeBody(id: string): string {
  const cut = id.indexOf('-')
  return cut >= 0 ? id.slice(cut + 1) : id
}

function noticeKey(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts.map(noticeBody)].join('-')
}

export function likeNoticeId(reviewId: string, actorId: string): string {
  return noticeKey('like', reviewId, actorId)
}

export function replyNoticeId(replyId: string): string {
  return noticeKey('reply', replyId)
}

export function nudgeNoticeId(bookId: string, actorId: string): string {
  return noticeKey('nudge', bookId, actorId)
}

export function requestNoticeId(replyId: string): string {
  return noticeKey('request', replyId)
}

export function likeNotice(
  review: Pick<Review, 'id' | 'friendId' | 'bookId'>,
  actorId: string,
  at: number,
): { recipientId: string; notice: Notice } | null {
  if (review.friendId === actorId || !isSafeId(actorId) || !isSafeId(review.friendId) || !isSafeId(review.bookId)) return null
  const id = likeNoticeId(review.id, actorId)
  if (!isSafeId(id)) return null
  return {
    recipientId: review.friendId,
    notice: {
      id,
      kind: 'like',
      actorId,
      bookId: review.bookId,
      reviewId: review.id,
      postId: null,
      preview: null,
      createdAt: at,
      read: false,
    },
  }
}

export function replyNotice(
  parent: Pick<Review, 'id' | 'friendId'>,
  reply: Pick<Review, 'id' | 'friendId' | 'bookId' | 'text' | 'createdAt'>,
): { recipientId: string; notice: Notice } | null {
  if (parent.friendId === reply.friendId || !isSafeId(parent.friendId) || !isSafeId(reply.friendId) || !isSafeId(reply.bookId)) {
    return null
  }
  const preview = cleanReview(reply.text)
  const id = replyNoticeId(reply.id)
  if (!preview || !isSafeId(id) || !isSafeId(parent.id)) return null
  return {
    recipientId: parent.friendId,
    notice: {
      id,
      kind: 'reply',
      actorId: reply.friendId,
      bookId: reply.bookId,
      reviewId: parent.id,
      postId: null,
      preview,
      createdAt: reply.createdAt,
      read: false,
    },
  }
}

export function nudgeNotice(
  readerId: string | null | undefined,
  bookId: string,
  actorId: string,
  at: number,
): { recipientId: string; notice: Notice } | null {
  if (!readerId || readerId === actorId || !isSafeId(readerId) || !isSafeId(bookId) || !isSafeId(actorId)) return null
  const id = nudgeNoticeId(bookId, actorId)
  if (!isSafeId(id)) return null
  return {
    recipientId: readerId,
    notice: {
      id,
      kind: 'nudge',
      actorId,
      bookId,
      reviewId: null,
      postId: null,
      preview: null,
      createdAt: at,
      read: false,
    },
  }
}

export function requestNotice(
  post: { id: string; friendId: string },
  reply: { id: string; text: string; createdAt: number },
): { recipientId: string; notice: Notice } | null {
  if (!isSafeId(post.id) || !isSafeId(post.friendId)) return null
  const preview = cleanReview(reply.text)
  const id = requestNoticeId(reply.id)
  if (!preview || !isSafeId(id)) return null
  return {
    recipientId: post.friendId,
    notice: {
      id,
      kind: 'request',
      actorId: 'admin',
      bookId: '',
      reviewId: null,
      postId: post.id,
      preview,
      createdAt: reply.createdAt,
      read: false,
    },
  }
}

export function withNotification(data: ShelfData, recipientId: string, notice: Notice): ShelfData {
  const current = data.notifications[recipientId] ?? []
  const next = [notice, ...current.filter((item) => item.id !== notice.id)].sort(
    (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id),
  )
  return { ...data, notifications: { ...data.notifications, [recipientId]: next } }
}

export function withoutNotification(data: ShelfData, recipientId: string, noticeId: string): ShelfData {
  const current = data.notifications[recipientId]
  if (!current) return data
  const next = current.filter((item) => item.id !== noticeId)
  const notifications = { ...data.notifications }
  if (next.length > 0) notifications[recipientId] = next
  else delete notifications[recipientId]
  return { ...data, notifications }
}

export function dropMemberNotifications(data: ShelfData, friendId: string): ShelfData {
  if (!data.notifications[friendId]) return data
  const notifications = { ...data.notifications }
  delete notifications[friendId]
  return { ...data, notifications }
}

export function readNotifications(data: ShelfData, friendId: string, ids: readonly string[]): ShelfData {
  const current = data.notifications[friendId]
  if (!current || ids.length === 0) return data
  const wanted = new Set(ids)
  let changed = false
  const next = current.map((notice) => {
    if (!wanted.has(notice.id) || notice.read) return notice
    changed = true
    return { ...notice, read: true }
  })
  if (!changed) return data
  return { ...data, notifications: { ...data.notifications, [friendId]: next } }
}

export function noticePreview(text: string): string {
  const chars = Array.from(text)
  if (chars.length <= NOTICE_PREVIEW) return text
  return `${chars.slice(0, NOTICE_PREVIEW).join('')}…`
}

export function likeAlertLine(name: string): string {
  return `${name}님이 내 한 줄 평을 좋아해용`
}

export function replyAlertLine(name: string, preview: string): string {
  return `${name}님이 내 한 줄 평에 답글을 달았어용: ${noticePreview(preview)}`
}

export function nudgeAlertLine(name: string, title: string): string {
  return `${name}님이 『${title}』 뱉으래용!`
}

export function requestAlertLine(preview: string): string {
  return `관리자에게 답변이 달렸어용: ${noticePreview(preview)}`
}

export const DAILY_NUDGE_LIMIT = 4
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000

/** YYYY-MM-DD in Asia/Seoul. Korea has no daylight saving. */
export function seoulDay(at: number): string {
  const shifted = new Date(at + SEOUL_OFFSET_MS)
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${month}-${day}`
}

export function nudgesRemaining(stamps: readonly number[], now: number): number {
  const day = seoulDay(now)
  const used = stamps.filter((stamp) => seoulDay(stamp) === day).length
  return Math.max(0, DAILY_NUDGE_LIMIT - used)
}

/** Today's sends plus this one, or null when the daily cap is already used. Older days are dropped. */
export function nextNudgeSends(stamps: readonly number[], at: number): number[] | null {
  const day = seoulDay(at)
  const today = stamps.filter((stamp) => seoulDay(stamp) === day)
  if (today.length >= DAILY_NUDGE_LIMIT) return null
  return [...today, at].sort((a, b) => a - b)
}

export function nudgeAllowanceLine(remaining: number): string {
  if (remaining <= 0) return '오늘 독촉은 다 썼어용'
  return `오늘 ${remaining}번 남았어용`
}

export function unreadNotificationCount(notifications: ShelfData['notifications'], friendId: string): number {
  return (notifications[friendId] ?? []).reduce((total, notice) => total + (notice.read ? 0 : 1), 0)
}

/** Names are oldest nudge first. The sentence names the latest person. */
export function nudgeLine(namesOldestFirst: readonly string[]): string {
  if (namesOldestFirst.length === 0) return ''
  const name = namesOldestFirst[namesOldestFirst.length - 1] ?? ''
  if (namesOldestFirst.length === 1) return `${name}님이 뱉으래용!`
  return `${name}님 외 ${namesOldestFirst.length - 1}명이 뱉으래용!`
}
