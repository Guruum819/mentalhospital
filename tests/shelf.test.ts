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
import { cleanBirthday, cleanCover, cleanReview, dropMemberNotifications, findProfile, fromFirebase, fromPersisted, handoffAlertLine, holderAfterRemoval, holderLine, offerAlertLine, pendingPassLine, tookAlertLine, declineAlertLine, isSafeId, likeAlertLine, passTargets, resolvedHolderId, likeNotice, likeNoticeId, markedFinished, newId, nextNudgeSends, nextReviewsAfterDelete, nudgeAlertLine, nudgeAllowanceLine, nudgeLine, nudgeNotice, nudgesRemaining, readNotifications, replyAlertLine, replyNotice, requestAlertLine, requestNotice, reviewsAfterMemberRemoval, sameIdentity, seoulDay, sortedBooks, sortedComments, toggledRead, toPersisted, withNotification, withoutNotification } from '../src/lib/model.ts'
import { cleanPatchDate, cleanPatchLines, visiblePatchNotes } from '../src/lib/patch-notes.ts'
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
  const popularLow = sortedBooks(books, 'popular', reviews, {}, ['a'], true)
  assert.deepEqual(popularLow.map((book) => book.id), ['mid', 'old', 'new'])
  const read = sortedBooks(books, 'read', reviews, { mid: { a: true }, old: { a: true } }, ['a'])
  assert.equal(read[0]?.id === 'mid' || read[0]?.id === 'old', true)
  assert.equal(read[2]?.id, 'new')
  const liked = sortedComments(reviews.filter((review) => !review.parentId), 'likes')
  assert.equal(liked[0]?.id, 'r1')
  assert.equal(nudgeLine(['민수']), '민수님이 뱉으래용!')
  assert.equal(nudgeLine(['민수', '채령']), '채령님 외 1명이 뱉으래용!')
  assert.equal(formatPatchDate('2026-11-17'), '2026년 11월 17일')
  assert.equal(cleanCover('data:image/jpeg;base64,aaaa'), 'data:image/jpeg;base64,aaaa')
  assert.equal(cleanCover('data:image/png;base64,aaaa'), null)
})

test('notifications stay under the member, skip my own actions, and unlike removes a like', () => {
  const me = newId('friend')
  const other = newId('friend')
  const reviewId = newId('review')
  const replyId = newId('review')
  const bookId = newId('book')
  const review = { id: reviewId, friendId: me, bookId }
  const like = likeNotice(review, other, 20)
  assert.ok(like)
  assert.equal(like.recipientId, me)
  assert.equal(isSafeId(like.notice.id), true)
  assert.equal(like.notice.id, likeNoticeId(reviewId, other))
  assert.equal(likeNotice(review, me, 20), null)
  const reply = replyNotice(
    { id: reviewId, friendId: me },
    { id: replyId, friendId: other, bookId, text: '다음 장도 좋았어용', createdAt: 30 },
  )
  assert.equal(reply?.notice.preview, '다음 장도 좋았어용')
  assert.equal(replyNotice({ id: reviewId, friendId: me }, { id: replyId, friendId: me, bookId, text: '내가 달았어용', createdAt: 31 }), null)
  const nudge = nudgeNotice(me, bookId, other, 40)
  assert.equal(nudge?.recipientId, me)
  assert.equal(nudgeNotice(me, bookId, me, 40), null)
  let shelf = starterShelf()
  shelf = withNotification(shelf, like.recipientId, like.notice)
  shelf = withNotification(shelf, reply!.recipientId, reply!.notice)
  shelf = withNotification(shelf, nudge!.recipientId, nudge!.notice)
  assert.deepEqual(
    shelf.notifications[me]?.map((notice) => notice.kind),
    ['nudge', 'reply', 'like'],
  )
  shelf = withoutNotification(shelf, me, like.notice.id)
  assert.equal(shelf.notifications[me]?.some((notice) => notice.kind === 'like'), false)
  shelf = readNotifications(shelf, me, shelf.notifications[me]?.map((notice) => notice.id) ?? [])
  assert.equal(shelf.notifications[me]?.every((notice) => notice.read), true)
  const kept = withNotification(starterShelf(), other, { ...like.notice, id: 'like-other' })
  const dropped = dropMemberNotifications({ ...kept, notifications: { ...kept.notifications, ...shelf.notifications } }, me)
  assert.equal(dropped.notifications[me], undefined)
  assert.equal(dropped.notifications[other]?.length, 1)
  const raw = fromFirebase({
    friends: {
      [me]: {
        name: '채령',
        order: 1,
        color: 'indigo',
        birthday: '1999-01-01',
        photo: '',
        notifications: {
          [nudge!.notice.id]: { kind: 'nudge', actorId: other, bookId, createdAt: 5, read: false },
          old: { kind: 'like', actorId: other, bookId, reviewId, createdAt: 1, read: true },
        },
      },
    },
  })
  assert.equal(raw.friends[0]?.name, '채령')
  assert.deepEqual(
    raw.notifications[me]?.map((notice) => notice.createdAt),
    [5, 1],
  )
  const persisted = fromPersisted(toPersisted(raw))
  assert.equal(persisted?.notifications[me]?.[0]?.kind, 'nudge')
  const legacy = fromPersisted({ version: 1, friends: raw.friends, books: [] })
  assert.deepEqual(legacy?.notifications, {})
  assert.equal(likeAlertLine('민수'), '민수님이 내 한 줄 평을 좋아해용')
  assert.equal(replyAlertLine('민수', '다음 장도 좋았어용'), '민수님이 내 한 줄 평에 답글을 달았어용: 다음 장도 좋았어용')
  assert.equal(replyAlertLine('민수', '가'.repeat(50)).endsWith('…'), true)
  assert.equal(replyAlertLine('민수', '가'.repeat(50)).includes('가'.repeat(41)), false)
  assert.equal(nudgeAlertLine('민수', '작별하지 않는다'), '민수님이 『작별하지 않는다』 뱉으래용!')
  const request = requestNotice({ id: 'post-1', friendId: 'friend-chaeryeong' }, { id: 'reply-1', text: '표지를 고쳐 둘게용', createdAt: 9 })
  assert.equal(request?.recipientId, 'friend-chaeryeong')
  assert.equal(request?.notice.postId, 'post-1')
  assert.equal(requestAlertLine('표지를 고쳐 둘게용'), '관리자에게 답변이 달렸어용: 표지를 고쳐 둘게용')
  const notified = fromFirebase({
    friends: {
      'friend-chaeryeong': {
        name: '채령',
        order: 1,
        color: 'indigo',
        birthday: '1994-04-04',
        notifications: {
          [request!.notice.id]: { kind: 'request', actorId: 'admin', postId: 'post-1', preview: '표지를 고쳐 둘게용', createdAt: 9, read: false },
        },
      },
    },
  })
  assert.equal(notified.notifications['friend-chaeryeong']?.[0]?.kind, 'request')
  assert.equal(notified.notifications['friend-chaeryeong']?.[0]?.postId, 'post-1')
  assert.equal(notified.friends[0]?.name, '채령')
})

test('each member gets four nudges per Seoul day', () => {
  const late = Date.parse('2026-11-16T14:59:59.000Z')
  const midnight = Date.parse('2026-11-16T15:00:00.000Z')
  assert.equal(seoulDay(late), '2026-11-16')
  assert.equal(seoulDay(midnight), '2026-11-17')
  const used = [late, late + 1, late + 2, late + 3]
  assert.equal(nudgesRemaining(used, late), 0)
  assert.equal(nextNudgeSends(used, late + 4), null)
  assert.equal(nudgesRemaining(used, midnight), 4)
  assert.deepEqual(nextNudgeSends(used, midnight), [midnight])
  assert.equal(nudgesRemaining([late, midnight], midnight), 3)
  assert.equal(nudgeAllowanceLine(2), '오늘 2번 남았어용')
  assert.equal(nudgeAllowanceLine(0), '오늘 독촉은 다 썼어용')
  const me = 'friend-minsu'
  const shelf = fromFirebase({
    friends: {
      [me]: {
        name: '민수',
        order: 1,
        color: 'rose',
        birthday: '1992-02-02',
        nudgeSends: { [late]: late, old: true },
      },
    },
  })
  assert.equal(shelf.friends[0]?.name, '민수')
  assert.deepEqual(shelf.nudgeSends[me], [late])
})

test('a book stays with its buyer until someone passes it on', () => {
  const book = { id: 'book-1', title: '작별하지 않는다', author: '', coverUrl: null, buyerId: 'friend-chaeryeong', order: 1 }
  const both = new Set(['friend-chaeryeong', 'friend-minsu'])
  assert.equal(resolvedHolderId(book, both), 'friend-chaeryeong')
  assert.equal(holderLine('채령', false), '지금 채령님이 갖고 있어용')
  assert.equal(holderLine('채령', true), '지금 내가 갖고 있어용')
  assert.equal(holderLine(null, false), '지금 갖고 있는 사람이 없어용')
  const passed = { ...book, holderId: 'friend-minsu' }
  assert.equal(resolvedHolderId(passed, both), 'friend-minsu')
  assert.equal(holderAfterRemoval(passed, 'friend-minsu', new Set(['friend-chaeryeong'])), 'friend-chaeryeong')
  assert.equal(holderAfterRemoval(book, 'friend-chaeryeong', new Set(['friend-minsu'])), '')
  assert.equal(holderAfterRemoval(passed, 'friend-chaeryeong', new Set(['friend-minsu'])), undefined)
  const targets = passTargets(
    [{ id: 'friend-minsu' }, { id: 'friend-chaeryeong' }, { id: 'friend-other' }],
    ['friend-other'],
    'friend-chaeryeong',
  )
  assert.deepEqual(targets.queued.map((friend) => friend.id), ['friend-other'])
  assert.deepEqual(targets.rest.map((friend) => friend.id), ['friend-minsu'])
  assert.equal(handoffAlertLine('채령', '작별하지 않는다'), '채령님이 『작별하지 않는다』을 넘겨줬어용!')
  assert.equal(offerAlertLine('채령', '작별하지 않는다'), '채령님이 『작별하지 않는다』을 넘겨주려고 해용!')
  assert.equal(tookAlertLine('민수', '작별하지 않는다'), '민수님이 『작별하지 않는다』을 받았어용!')
  assert.equal(declineAlertLine('민수'), '민수님이 거절했어용')
  assert.equal(pendingPassLine('민수'), '민수님한테 넘기는 중이에용')
  const parsed = fromFirebase({
    friends: { 'friend-chaeryeong': { name: '채령', order: 1, color: 'indigo', birthday: '1994-04-04' } },
    books: { 'book-1': { ...book, holderId: '' } },
    settings: { handoffs: { 'book-1': { 'handoff-1': { fromId: 'friend-chaeryeong', toId: 'friend-minsu', at: 4 } } } },
  })
  assert.equal(parsed.books[0]?.holderId, '')
  assert.equal(resolvedHolderId(parsed.books[0]!, new Set(['friend-chaeryeong'])), null)
  assert.equal(parsed.handoffs['book-1']?.[0]?.fromId, 'friend-chaeryeong')
})

test('nested replies stay attached when a parent comment is removed', () => {
  const base = {
    bookId: 'book-1',
    rating: null,
    editedAt: null,
    likes: [] as string[],
  }
  const reviews = [
    { ...base, id: 'top', friendId: 'a', text: '본글', createdAt: 1, parentId: null },
    { ...base, id: 'r1', friendId: 'b', text: '하나', createdAt: 2, parentId: 'top' },
    { ...base, id: 'r2', friendId: 'a', text: '둘', createdAt: 3, parentId: 'r1' },
    { ...base, id: 'leaf', friendId: 'b', text: '끝', createdAt: 4, parentId: 'r2' },
  ]
  const kept = nextReviewsAfterDelete(reviews, 'r1')
  assert.equal(kept.find((review) => review.id === 'r1')?.deleted, true)
  assert.equal(kept.some((review) => review.id === 'r2'), true)
  const leafGone = nextReviewsAfterDelete(kept, 'leaf')
  assert.equal(leafGone.some((review) => review.id === 'leaf'), false)
  assert.equal(leafGone.some((review) => review.id === 'r2'), true)
  const cleared = nextReviewsAfterDelete(
    leafGone.map((review) => (review.id === 'r2' ? { ...review, deleted: true } : review)),
    'r2',
  )
  assert.equal(cleared.some((review) => review.id === 'r2'), true)
  const afterChild = nextReviewsAfterDelete(cleared, 'r2')
  assert.equal(afterChild.find((review) => review.id === 'r2')?.deleted, true)
  const removed = reviewsAfterMemberRemoval(reviews, 'a')
  assert.equal(removed.find((review) => review.id === 'top')?.deleted, true)
  assert.equal(removed.find((review) => review.id === 'r2')?.deleted, true)
  assert.equal(removed.some((review) => review.id === 'r1'), true)
  assert.equal(removed.some((review) => review.id === 'leaf'), true)
  const parsed = fromFirebase({
    reviews: {
      deep: { bookId: 'book-1', friendId: 'b', text: '깊이', createdAt: 5, parentId: 'r1', deleted: true },
    },
    friends: { b: { name: '룬', order: 1, color: 'forest', birthday: '1999-01-01' } },
  })
  assert.equal(parsed.reviews[0]?.deleted, true)
  assert.equal(parsed.reviews[0]?.parentId, 'r1')
})

test('patch notes seed once and then follow the saved list', () => {
  const seeded = fromFirebase({
    settings: {
      patchNotes: {
        'patch-2026-11-17': { date: '2026-11-17', lines: { 0: '  첫째  ', 1: '' } },
      },
    },
  })
  assert.equal(seeded.patchNotesReady, false)
  assert.equal(seeded.patchNotes.length, 1)
  assert.equal(seeded.patchNotes[0]?.lines[0], '첫째')
  const ready = fromFirebase({
    settings: { patchNotesReady: true, patchNotes: {} },
  })
  assert.equal(ready.patchNotesReady, true)
  assert.deepEqual(visiblePatchNotes(ready.patchNotesReady, ready.patchNotes), [])
  assert.equal(visiblePatchNotes(false, []).length > 0, true)
  assert.equal(cleanPatchDate('2026-02-31'), null)
  assert.equal(cleanPatchDate('2026-11-18'), '2026-11-18')
  assert.deepEqual(cleanPatchLines(' 하나 \n\n둘 '), ['하나', '둘'])
  const roundTrip = fromPersisted(toPersisted({ ...ready, patchNotes: [{ id: 'patch-1', date: '2026-11-18', lines: ['남음'] }] }))
  assert.equal(roundTrip?.patchNotes[0]?.lines[0], '남음')
  assert.equal(roundTrip?.patchNotesReady, true)
})

test('a missing holder stays with the buyer', () => {
  const shelf = fromFirebase({
    friends: { me: { name: '민주', order: 1, color: 'rose', birthday: '1996-04-12' } },
    books: {
      bought: { title: '흰', author: '한강', buyerId: 'me', order: 2 },
      held: { title: '작별인사', author: '김영하', buyerId: 'other', holderId: 'me', order: 1 },
    },
  })
  const ids = new Set(['me'])
  assert.equal(resolvedHolderId(shelf.books.find((book) => book.id === 'bought')!, ids), 'me')
  assert.equal(resolvedHolderId(shelf.books.find((book) => book.id === 'held')!, ids), 'me')
})
