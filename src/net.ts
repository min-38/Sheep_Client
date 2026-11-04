import type { Grid } from './raycast.ts'

// 기술 설계서 메시지 표를 손으로 옮김. 표가 바뀌면 여기도 고침
export type ClientMessage =
  | { type: 'createRoom' }
  | { type: 'joinRoom'; code: string }
  // angle은 라디안, 0 이상 2π 미만. 범위 밖이면 서버가 버림
  | { type: 'turn'; angle: number }

// x·y는 칸 단위(map의 [y][x]와 같은 축), angle은 turn과 같음
export type PlayerState = { id: string; x: number; y: number; angle: number }

export type ServerMessage =
  | { type: 'roomCreated'; code: string; playerId: string }
  | { type: 'joined'; code: string; playerId: string }
  | { type: 'error'; reason: 'notFound' | 'full' }
  | { type: 'map'; width: number; height: number; cells: Grid }
  | { type: 'state'; tick: number; players: PlayerState[] }

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
      return m.reason === 'notFound' || m.reason === 'full' ? { type: 'error', reason: m.reason } : null
    case 'map':
      return isGrid(m.cells, m.width, m.height) ? { type: 'map', width: m.width, height: m.height, cells: m.cells } : null
    case 'state':
      return Number.isInteger(m.tick) && Array.isArray(m.players) && m.players.every(isPlayer)
        ? { type: 'state', tick: m.tick, players: m.players }
        : null
    default:
      return null
  }
}

const isPlayer = (p: any): p is PlayerState =>
  typeof p?.id === 'string' && [p.x, p.y, p.angle].every(Number.isFinite)

// 레이캐스터는 칸이 다 숫자이고 모든 줄 길이가 같다고 봄
function isGrid(cells: unknown, width: unknown, height: unknown): cells is Grid {
  return (
    Array.isArray(cells) &&
    cells.length === height &&
    cells.every((row) => Array.isArray(row) && row.length === width && row.every((c) => typeof c === 'number'))
  )
}
