export function toKoreanError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''
  const text = `${code} ${message}`.toLowerCase()
  if (text.includes('permission_denied') || text.includes('permission denied')) {
    return '데이터베이스가 막혀 있어용. README의 보안 규칙을 붙여넣고 게시했는지 확인해 주세용.'
  }
  if (
    text.includes('network') ||
    text.includes('offline') ||
    text.includes('failed to get') ||
    text.includes('disconnected')
  ) {
    return '네트워크에 연결하지 못했어용. 잠시 후 다시 시도해 주세용.'
  }
  if (/[가-힣]/.test(message)) return message
  return '저장하지 못했어용. 잠시 후 다시 시도해 주세용.'
}
