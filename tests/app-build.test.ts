import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatBuildLabel, isNewerBuild } from '../src/lib/app-build.ts'

test('build label uses Seoul time', () => {
  assert.equal(formatBuildLabel('2026-11-17T05:10:00.000Z'), '11월 17일 14:10')
  assert.equal(formatBuildLabel('not-a-date'), '')
})

test('a later deploy counts as a newer build', () => {
  assert.equal(isNewerBuild('2026-11-17T05:10:00.000Z', '2026-11-17T05:10:00.000Z'), false)
  assert.equal(isNewerBuild('2026-11-17T05:10:00.000Z', '2026-11-17T05:12:00.000Z'), true)
  assert.equal(isNewerBuild('nope', '2026-11-17T05:12:00.000Z'), false)
})
