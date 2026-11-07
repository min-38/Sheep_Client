// 첫 화면의 방 목록 한 줄 (시스템 기획서 방 화면 대기실 보기). 서버 rooms 메시지의 방 하나
export type RoomInfo = { code: string; name: string; players: { nickname: string; color: number }[]; max: number; playing: boolean }

// 목수건 8색. color 번호 순서 (시스템 기획서 방 화면 사람 색)
export const BANDANA = ['#d83a3a', '#4fb3e8', '#34a853', '#f2cf2a', '#f08a1c', '#ee77b8', '#f4f4f4', '#2a2a2a']

// 한 줄에 적는 사람 수. 넘으면 "외 N명"
const SHOWN = 3

export const joinable = (r: RoomInfo) => !r.playing && r.players.length < r.max

// ponytail: 임시 문구. 게임 안 문구 스타일이 정해지면 바꿈
export const roomStatus = (r: RoomInfo) => (r.playing ? '판 진행 중' : r.players.length >= r.max ? '꽉 참' : '준비 중')

export function memberText(players: RoomInfo['players']): string {
  const names = players.slice(0, SHOWN).map((p) => p.nickname).join(', ')
  return players.length > SHOWN ? `${names} 외 ${players.length - SHOWN}명` : names
}
