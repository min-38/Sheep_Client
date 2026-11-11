import { t } from './i18n/index.ts'

// 첫 화면의 방 목록 한 줄 (시스템 기획서 방 화면 대기실 보기). 서버 rooms 메시지의 방 하나
export type RoomInfo = { code: string; name: string; players: { nickname: string; color: number }[]; max: number; playing: boolean }

// 목수건 8색. color 번호 순서 (시스템 기획서 방 화면 사람 색). 2번은 선인장에 묻히는 초록 대신 보라 (SHEEP-179)
export const BANDANA = ['#d83a3a', '#4fb3e8', '#8e44d6', '#f2cf2a', '#f08a1c', '#ee77b8', '#f4f4f4', '#2a2a2a']

// 한 줄에 적는 사람 수. 넘으면 나머지는 수만 적음
const SHOWN = 3

export const joinable = (r: RoomInfo) => !r.playing && r.players.length < r.max

export const roomStatus = (r: RoomInfo) => (r.playing ? t.lobby.playing : r.players.length >= r.max ? t.lobby.full : t.lobby.waiting)

export function memberText(players: RoomInfo['players']): string {
  const names = players.slice(0, SHOWN).map((p) => p.nickname).join(', ')
  return players.length > SHOWN ? t.lobby.members(names, players.length - SHOWN) : names
}
