// 닉네임 규칙 (시스템 기획서 방 화면 닉네임). 서버 Nickname.Normalize와 같은 규칙이어야, 클라가 받아 준 이름을 서버가 버리지 않음.
// 한글(완성형 가~힣, 호환 자모 ㄱ~ㅣ)·영문·숫자만. 자모 뒤의 한글 채움 문자(U+3164)는 보이지 않는 글자라 넣지 않음
const NAME = /^[가-힣ㄱ-ㅣA-Za-z0-9]{2,8}$/

// 앞뒤 공백을 지우고 규칙에 맞으면 그 이름, 아니면 null. 받는 글자는 모두 UTF-16 한 단위라 서버와 글자 수가 같음
export function normalizeNickname(raw: string): string | null {
  const name = raw.trim()
  return NAME.test(name) ? name : null
}
