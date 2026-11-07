import { toServerTime } from './clock.ts'
import type { Grid } from './raycast.ts'

// 기술 설계서 메시지 표를 손으로 옮김. 표가 바뀌면 여기도 고침
export type ClientMessage =
  | { type: 'createRoom' }
  | { type: 'joinRoom'; code: string }
  // angle은 라디안, 0 이상 2π 미만. 범위 밖이면 서버가 버림
  | { type: 'turn'; angle: number }
  // 값을 보냄. 두 번 보내도 결과가 같음
  | { type: 'ready'; ready: boolean }
  // t0은 보낸 순간의 performance.now() (ms). 방에 들어가기 전에도 보냄
  | { type: 'clockSync'; t0: number }
  // angle은 turn과 같음. pitch는 위아래 시선(라디안, 위가 +)이고 서버는 머리와 몸 판정(SHEEP-56)부터 읽음.
  // at은 쏜 시각(ms, 서버 시계). M4 서버는 발사 간격을 잴 때만 씀
  | { type: 'fire'; angle: number; pitch: number; at: number }

// x·y는 칸 단위(map의 [y][x]와 같은 축), angle은 turn과 같음. pose는 동작 (서 있음, 걷기, 쓰러짐)
export type PlayerState = { id: string; x: number; y: number; angle: number; pose: 'stand' | 'walk' | 'down'; ready: boolean }

// 서버가 알리는 판 단계. lobby는 판이 끝나 준비 중으로 돌아가는 시각임
export type Phase = 'countdown' | 'walk' | 'duel' | 'lobby'

// 판 결과. playerIds는 이긴 사람 1명, 또는 재대결하는 사람들. rounds는 재대결 때 새로 장전하는 총알 수이고 승리면 0
export type RoundResult = { outcome: 'win' | 'rematch'; playerIds: string[]; rounds: number }

export type ServerMessage =
  | { type: 'roomCreated'; code: string; playerId: string }
  | { type: 'joined'; code: string; playerId: string }
  | { type: 'error'; reason: 'notFound' | 'full' | 'playing' }
  | { type: 'map'; width: number; height: number; cells: Grid }
  | { type: 'state'; tick: number; players: PlayerState[] }
  // clockSync의 답. t0은 보낸 값 그대로, ts는 서버 시각(ms)
  | { type: 'serverTime'; t0: number; ts: number }
  // at은 그 단계가 시작하는 서버 시각(ms). serverTime의 ts와 같은 시계
  | { type: 'phase'; phase: Phase; at: number }
  // 서버가 받아들인 발사. angle은 fire의 angle 그대로
  | { type: 'shot'; playerId: string; angle: number }
  | { type: 'eliminated'; playerId: string }
  // 결과 시간이 끝나는 시각은 바로 뒤의 phase로 옴 (승리면 lobby, 재대결이면 countdown)
  | ({ type: 'result' } & RoundResult)

// 쏜 순간 내 시각(ms, performance.now())을 서버 시계로 바꿔 보냄. 서버는 이 시각으로 발사 간격을 재고, M5부터 쏜 순서를 가림
export const fireMessage = (angle: number, pitch: number, shotAt: number, offset: number): ClientMessage => ({ type: 'fire', angle, pitch, at: toServerTime(shotAt, offset) })

// 서버가 보낸 JSON 하나를 읽음. 모양이 틀리면 null을 돌려주고 받는 쪽은 무시함 (서버와 같음)
export function parseServerMessage(text: string): ServerMessage | null {
  let m
  try {
    m = JSON.parse(text)
  } catch {
    return null
  }
  switch (m?.type) {
    case 'roomCreated':
    case 'joined':
      return typeof m.code === 'string' && typeof m.playerId === 'string' ? { type: m.type, code: m.code, playerId: m.playerId } : null
    case 'error':
      return m.reason === 'notFound' || m.reason === 'full' || m.reason === 'playing' ? { type: 'error', reason: m.reason } : null
    case 'map':
      return isGrid(m.cells, m.width, m.height) ? { type: 'map', width: m.width, height: m.height, cells: m.cells } : null
    case 'state':
      return Number.isInteger(m.tick) && Array.isArray(m.players) && m.players.every(isPlayer)
        ? { type: 'state', tick: m.tick, players: m.players }
        : null
    case 'serverTime':
      return Number.isFinite(m.t0) && Number.isFinite(m.ts) ? { type: 'serverTime', t0: m.t0, ts: m.ts } : null
    case 'phase':
      return (m.phase === 'countdown' || m.phase === 'walk' || m.phase === 'duel' || m.phase === 'lobby') && Number.isFinite(m.at)
        ? { type: 'phase', phase: m.phase, at: m.at }
        : null
    case 'shot':
      return typeof m.playerId === 'string' && Number.isFinite(m.angle) ? { type: 'shot', playerId: m.playerId, angle: m.angle } : null
    case 'eliminated':
      return typeof m.playerId === 'string' ? { type: 'eliminated', playerId: m.playerId } : null
    case 'result':
      return (m.outcome === 'win' || m.outcome === 'rematch') &&
        Array.isArray(m.playerIds) &&
        m.playerIds.every((id: unknown) => typeof id === 'string') &&
        Number.isInteger(m.rounds) &&
        m.rounds >= 0
        ? { type: 'result', outcome: m.outcome, playerIds: m.playerIds, rounds: m.rounds }
        : null
    default:
      return null
  }
}

const isPlayer = (p: any): p is PlayerState =>
  typeof p?.id === 'string' &&
  [p.x, p.y, p.angle].every(Number.isFinite) &&
  (p.pose === 'stand' || p.pose === 'walk' || p.pose === 'down') &&
  typeof p.ready === 'boolean'

// 레이캐스터는 칸이 다 숫자이고 모든 줄 길이가 같다고 봄
function isGrid(cells: unknown, width: unknown, height: unknown): cells is Grid {
  return (
    Array.isArray(cells) &&
    cells.length === height &&
    cells.every((row) => Array.isArray(row) && row.length === width && row.every((c) => typeof c === 'number'))
  )
}
