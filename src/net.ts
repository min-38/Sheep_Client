import type { Grid } from './raycast.ts'

// 기술 설계서 메시지 표를 손으로 옮김. 표가 바뀌면 여기도 고침
export type ClientMessage = { type: 'createRoom' } | { type: 'joinRoom'; code: string }

export type ServerMessage =
  | { type: 'roomCreated'; code: string }
  | { type: 'joined'; code: string }
  | { type: 'error'; reason: 'notFound' | 'full' }
  | { type: 'map'; width: number; height: number; cells: Grid }

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
      return typeof m.code === 'string' ? { type: m.type, code: m.code } : null
    case 'error':
      return m.reason === 'notFound' || m.reason === 'full' ? { type: 'error', reason: m.reason } : null
    case 'map':
      return isGrid(m.cells, m.width, m.height) ? { type: 'map', width: m.width, height: m.height, cells: m.cells } : null
    default:
      return null
  }
}

// 레이캐스터는 칸이 다 숫자이고 모든 줄 길이가 같다고 봄
function isGrid(cells: unknown, width: unknown, height: unknown): cells is Grid {
  return (
    Array.isArray(cells) &&
    cells.length === height &&
    cells.every((row) => Array.isArray(row) && row.length === width && row.every((c) => typeof c === 'number'))
  )
}
