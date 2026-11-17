import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  authorFromWikiDescription,
  combineBookHits,
  hitsFromGoogle,
  hitsFromKakao,
  hitsFromWiki,
  httpsUrl,
  kakaoCoverUrl,
  stripHtml,
  titleForHangulQuery,
  type BookHit,
} from '../src/lib/book-search.ts'
import { cleanBirthday, cleanCover, cleanReview, findProfile, fromFirebase, markedFinished, nudgeLine, sameIdentity, sortedBooks, sortedComments, toggledRead } from '../src/lib/model.ts'
import { formatPatchDate } from '../src/lib/patch-notes.ts'
import { PALETTE } from '../src/lib/palette.ts'
import { starterShelf } from '../src/lib/seed.ts'
import type { Friend, ShelfData } from '../src/lib/types.ts'

test('starter shelf has no seeded friends or books', () => {
  const shelf = starterShelf()
  assert.deepEqual(shelf.friends, [])
  assert.deepEqual(shelf.books, [])
  assert.equal(PALETTE.length, 10)
})

test('name plus birthday is the unique login key', () => {
  const friends: Friend[] = [
    { id: 'a', name: '지원', order: 1, color: 'clay', photo: null, birthday: '1998-03-02', approved: true },
    { id: 'b', name: '지원', order: 2, color: 'rose', photo: null, birthday: '2001-11-09', approved: true },
  ]
  assert.equal(sameIdentity(friends, '지원', '1998-03-02'), true)
  assert.equal(sameIdentity(friends, '지원', '1990-01-01'), false)
  assert.equal(findProfile(friends, ' 지원 ', '2001-11-09')?.id, 'b')
  assert.equal(cleanBirthday('1998-02-31'), null)
  assert.equal(cleanBirthday('1998-03-02'), '1998-03-02')
})

test('checking the current reader clears 읽는 중 and unchecking brings it back only when toggled off', () => {
  const shelf: ShelfData = {
    ...starterShelf(),
    friends: [{ id: 'friend-chaeryeong', name: '채령', order: 1, color: 'indigo', photo: null, birthday: '1999-01-01', approved: true }],
    books: [{ id: 'book-1', title: '책', author: '', coverUrl: null, buyerId: 'friend-chaeryeong', order: 1 }],
    reading: { 'book-1': 'friend-chaeryeong' },
  }
  const marked = toggledRead(shelf, 'book-1', 'friend-chaeryeong')
  assert.equal(marked.reads['book-1']?.['friend-chaeryeong'], true)
  assert.equal(marked.clearedReading, true)
  assert.equal(marked.reading['book-1'], undefined)
  const cleared = toggledRead({ ...shelf, reads: marked.reads, reading: marked.reading }, 'book-1', 'friend-chaeryeong')
  assert.equal(cleared.reads['book-1']?.['friend-chaeryeong'], undefined)
})

test('완독 checks 읽음 and clears my 읽는 중', () => {
  const shelf: ShelfData = {
    ...starterShelf(),
    friends: [{ id: 'me', name: '나', order: 1, color: 'indigo', photo: null, birthday: '1999-01-01', approved: true }],
    books: [{ id: 'book-1', title: '책', author: '', coverUrl: null, buyerId: 'me', order: 1 }],
    reading: { 'book-1': 'me' },
  }
  const done = markedFinished(shelf, 'book-1', 'me')
  assert.equal(done.reads['book-1']?.me, true)
  assert.equal(done.clearedReading, true)
  assert.equal(done.reading['book-1'], undefined)
  const other = markedFinished({ ...shelf, reading: { 'book-1': 'other' } }, 'book-1', 'me')
  assert.equal(other.reading['book-1'], 'other')
  assert.equal(other.reads['book-1']?.me, true)
})

test('reviews stay within 200 characters and search keeps cover', () => {
  assert.equal(cleanReview(`가`.repeat(220))?.length, 200)
  assert.equal(stripHtml('<b>작별</b>하지 않는다'), '작별하지 않는다')
  const kakao = hitsFromKakao({
    documents: [{ title: '<b>작별하지 않는다</b>', authors: ['한강'], thumbnail: 'http://example.com/a.jpg' }],
  })
  assert.equal(kakao[0]?.coverUrl, 'https://example.com/a.jpg')
  assert.equal(
    kakaoCoverUrl('https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F5824679%3Ftimestamp%3D20251223144054'),
    'https://t1.daumcdn.net/lbook/image/5824679?timestamp=20251223144054',
  )
  const google = hitsFromGoogle({
    items: [{ id: 'g1', volumeInfo: { title: '데미안', authors: ['헤르만 헤세'], imageLinks: { thumbnail: 'https://books.google.com/a&zoom=1' } } }],
  })
  assert.equal(google[0]?.coverUrl, 'https://books.google.com/a&zoom=2')
  assert.equal(httpsUrl('//thumb.wikimedia.org/a/60px-b.jpg'), 'https://thumb.wikimedia.org/a/60px-b.jpg')
})

test('Hangul search prefers the Korean title and keeps a cover', () => {
  assert.equal(authorFromWikiDescription('한강의 소설'), '한강')
  assert.equal(authorFromWikiDescription('작가 한강의 소설'), '한강')
  assert.equal(authorFromWikiDescription('1919년 헤르만 헤세의 철학, 성장 소설'), '헤르만 헤세')
  assert.equal(authorFromWikiDescription('위키미디어 동음이의어 문서'), '')
  const wiki = hitsFromWiki(
    {
      pages: [
        { id: 1, title: '작별하지 않는다', description: '한강의 소설', thumbnail: null },
        { id: 2, title: '작별', description: '위키미디어 동음이의어 문서' },
        { id: 3, title: '작별하지 않는다 (영화)', description: '영화' },
      ],
    },
    '작별하지 않는다',
  )
  assert.equal(wiki.length, 1)
  assert.equal(wiki[0]?.author, '한강')
  const romanized: BookHit = {
    id: 'ol',
    title: 'Chakpyŏl haji annŭnda',
    author: 'Han Kang',
    coverUrl: 'https://covers.openlibrary.org/b/id/14835467-L.jpg',
    source: 'openlibrary',
  }
  const hits = combineBookHits({ wiki, openlibrary: [romanized] }, '작별하지 않는다')
  assert.equal(hits.length, 1)
  assert.equal(hits[0]?.title, '작별하지 않는다')
  assert.equal(hits[0]?.author, '한강')
  assert.equal(hits[0]?.coverUrl, romanized.coverUrl)
  assert.equal(titleForHangulQuery('Chakpyŏl haji annŭnda', '작별하지 않는다'), '작별하지 않는다')
  assert.equal(titleForHangulQuery('Demian', '작별하지 않는다'), 'Demian')
  const onlyRomanized = combineBookHits({ openlibrary: [romanized] }, '작별하지 않는다')
  assert.equal(onlyRomanized[0]?.title, '작별하지 않는다')
  assert.equal(onlyRomanized[0]?.coverUrl, romanized.coverUrl)
})

test('existing members without an approval flag stay approved and keep their reviews', () => {
  const shelf = fromFirebase({
    settings: { initialized: true },
    friends: {
      'friend-1': { name: '채령', order: 1, color: 'indigo', birthday: '1999-01-01', photo: '' },
    },
    books: {
      'book-1': { title: '작별하지 않는다', author: '한강', coverUrl: 'https://example.com/a.jpg', buyerId: 'friend-1', order: 2 },
    },
    reviews: {
      'review-1': { bookId: 'book-1', friendId: 'friend-1', text: '좋았어용', createdAt: 10, rating: 4.5 },
    },
    reads: { 'book-1': { 'friend-1': true } },
  })
  assert.equal(shelf.friends[0]?.approved, true)
  assert.equal(shelf.reviews[0]?.text, '좋았어용')
  assert.equal(shelf.reviews[0]?.parentId, null)
  assert.equal(shelf.books[0]?.title, '작별하지 않는다')
  assert.equal(shelf.reads['book-1']?.['friend-1'], true)
  const pending = fromFirebase({
    friends: { 'friend-2': { name: '새', order: 2, color: 'rose', birthday: '2000-01-01', approved: false } },
  })
  assert.equal(pending.friends[0]?.approved, false)
})

test('book sort puts unrated last and comment sort follows likes', () => {
  const books = [
    { id: 'old', title: '오래된 책', author: '', coverUrl: null, buyerId: 'a', order: 1 },
    { id: 'new', title: '새 책', author: '', coverUrl: null, buyerId: 'a', order: 3 },
    { id: 'mid', title: '중간 책', author: '', coverUrl: null, buyerId: 'a', order: 2 },
  ]
  const reviews = [
    { id: 'r1', bookId: 'old', friendId: 'a', text: '좋음', createdAt: 1, rating: 5, parentId: null, editedAt: null, likes: ['a'] },
    { id: 'r2', bookId: 'mid', friendId: 'a', text: '보통', createdAt: 2, rating: 3, parentId: null, editedAt: null, likes: [] },
    { id: 'reply', bookId: 'old', friendId: 'a', text: '답', createdAt: 3, rating: null, parentId: 'r1', editedAt: 4, likes: ['a', 'b'] },
  ]
  const newest = sortedBooks(books, 'new', reviews, {}, ['a'])
  assert.deepEqual(newest.map((book) => book.id), ['new', 'mid', 'old'])
  const popular = sortedBooks(books, 'popular', reviews, {}, ['a'])
  assert.deepEqual(popular.map((book) => book.id), ['old', 'mid', 'new'])
  const read = sortedBooks(books, 'read', reviews, { mid: { a: true }, old: { a: true } }, ['a'])
  assert.equal(read[0]?.id === 'mid' || read[0]?.id === 'old', true)
  assert.equal(read[2]?.id, 'new')
  const liked = sortedComments(reviews.filter((review) => !review.parentId), 'likes')
  assert.equal(liked[0]?.id, 'r1')
  assert.equal(nudgeLine(['민수']), '민수님이 빨리 읽으래용!')
  assert.equal(nudgeLine(['민수', '채령']), '채령님 외 1명이 빨리 읽으래용!')
  assert.equal(formatPatchDate('2026-11-17'), '2026년 11월 17일')
  assert.equal(cleanCover('data:image/jpeg;base64,aaaa'), 'data:image/jpeg;base64,aaaa')
  assert.equal(cleanCover('data:image/png;base64,aaaa'), null)
})
