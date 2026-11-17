export function toKoreanError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''
  const text = `${code} ${message}`.toLowerCase()
  if (text.includes('permission_denied') || text.includes('permission denied')) {
    return '데이터베이스가 막혀 있어용. README 규칙을 붙여넣고 게시했는지 봐줘용.'
  }
  if (
    text.includes('network') ||
    text.includes('offline') ||
    text.includes('failed to get') ||
    text.includes('disconnected')
  ) {
    return '네트워크에 연결 못 했당. 잠깐 뒤에 다시 해줘용.'
  }
  if (/[가-힣]/.test(message)) return message
  return '저장을 못 했당. 잠깐 뒤에 다시 해줘용.'
}
