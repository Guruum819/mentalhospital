import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hitsFromGoogle, hitsFromKakao, stripHtml } from '../src/lib/book-search.ts'
import { cleanBirthday, cleanReview, findProfile, sameIdentity, toggledRead } from '../src/lib/model.ts'
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
    { id: 'a', name: '지원', order: 1, color: 'clay', photo: null, birthday: '1998-03-02' },
    { id: 'b', name: '지원', order: 2, color: 'rose', photo: null, birthday: '2001-11-09' },
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
    friends: [{ id: 'friend-chaeryeong', name: '채령', order: 1, color: 'indigo', photo: null, birthday: '1999-01-01' }],
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

test('reviews stay within 200 characters and search keeps cover', () => {
  assert.equal(cleanReview(`가`.repeat(220))?.length, 200)
  assert.equal(stripHtml('<b>작별</b>하지 않는다'), '작별하지 않는다')
  const kakao = hitsFromKakao({
    documents: [{ title: '<b>작별하지 않는다</b>', authors: ['한강'], thumbnail: 'http://example.com/a.jpg' }],
  })
  assert.equal(kakao[0]?.coverUrl, 'https://example.com/a.jpg')
  const google = hitsFromGoogle({
    items: [{ id: 'g1', volumeInfo: { title: '데미안', authors: ['헤르만 헤세'], imageLinks: { thumbnail: 'https://books.google.com/a&zoom=1' } } }],
  })
  assert.equal(google[0]?.coverUrl, 'https://books.google.com/a&zoom=2')
})
