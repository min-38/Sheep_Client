// 닉네임 규칙 (시스템 기획서 방 화면 닉네임). 서버 Nickname.Normalize와 같은 규칙이어야, 클라가 받아 준 이름을 서버가 버리지 않음.
// 완성형 한글(가~힣)·영문·숫자만. 자모만 쓴 이름(ㅋㅋ)은 포스터에서 읽기 어려워 받지 않음
const NAME = /^[가-힣A-Za-z0-9]{2,8}$/

// 앞뒤 공백을 지우고 규칙에 맞으면 그 이름, 아니면 null. 받는 글자는 모두 UTF-16 한 단위라 서버와 글자 수가 같음
export function normalizeNickname(raw: string): string | null {
  const name = raw.trim()
  return NAME.test(name) ? name : null
}
