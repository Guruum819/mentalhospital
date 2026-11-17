export type PatchNote = {
  /** YYYY-MM-DD. Newest entries belong at the top. */
  date: string
  lines: string[]
}

export const PATCH_NOTES: PatchNote[] = [
  {
    date: '2026-11-17',
    lines: [
      '보안을 강화했어용!',
      '새로 가입하면 관리자 승인을 기다려용.',
      '그룹 암호는 없앴고, 책 비우기는 관리자만 할 수 있어용.',
      '표지를 검색하거나 사진으로 바꿀 수 있어용.',
      '한 줄 평에 답글, 좋아요, 수정이 생겼어용.',
      '읽는 친구를 독촉하고, 다음에 읽을 순서를 정할 수 있어용.',
      '설정에 수정 요청 게시판이랑 패치노트를 넣었어용.',
      '책 목록이랑 코멘트를 정렬하고, 프로필에 탭을 넣었어용.',
      '멤버 색 중 하늘색을 회색으로 바꿨어용.',
      '관리자가 멤버를 강퇴할 수 있어용.',
      '읽음으로 체크한 뒤에 한 줄 평을 쓸 수 있어용.',
      '패치노트랑 수정 요청을 설정에서 따로 열게 했어용.',
      '설정에서 계정 삭제를 맨 아래로 내렸어용.',
      '홈 화면 앱도 새 버전으로 새로고침할 수 있어용.',
      '새 버전이 올라오면 입력 중이 아니면 알아서 새로고침해용.',
      '관리자는 멤버로 안 들어가도 수정 요청에 답글을 달 수 있어용.',
      '헤더 종을 누르면 좋아요, 답글, 독촉 알림을 볼 수 있어용.',
      '독촉은 하루에 4번까지고, 서울 자정에 다시 쓸 수 있어용.',
      '읽는 중 알약 옆에서 그 친구한테 독촉할 수 있어용.',
      '독촉 알림은 「뱉으래용」으로 바꿨어용.',
      '관리자가 수정 요청에 답글을 달면 알림이 와용.',
      '읽는 중에서 완독을 고르면 읽음으로 체크돼용.',
    ],
  },
]

/** Newest day first. Add another `{ date, lines }` entry for a future day. */
export function patchNotesNewestFirst(): PatchNote[] {
  return [...PATCH_NOTES].sort((a, b) => b.date.localeCompare(a.date))
}

export function formatPatchDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${year}년 ${Number(month)}월 ${Number(day)}일`
}
