import type { PlayerState } from './net.ts'

// 관전할 다음 사람 (컨셉 기획서 규칙 탈락한 뒤). players는 마지막 state이고 그 순서가 들어온 순서임.
// current 다음부터 돌아 처음 나오는 서 있는 사람(내가 아님). current가 나갔으면 처음부터, 끝이면 처음으로 돌아감. 아무도 없으면 null
export function nextTarget(players: readonly PlayerState[], myId: string, current: string | null): string | null {
  const from = players.findIndex((p) => p.id === current)
  for (let k = 1; k <= players.length; k++) {
    const p = players[(from + k) % players.length]
    if (p.id !== myId && p.pose !== 'down') return p.id
  }
  return null
}
