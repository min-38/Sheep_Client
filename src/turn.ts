const TAU = Math.PI * 2

// 마우스 좌우 이동량(px)만큼 시점을 돌림. 오른쪽(+dx)이 화면 오른쪽으로 도는 방향.
// 0 이상 2π 미만으로 묶어 오래 돌아도 값이 커지지 않게 함. 이 값을 그대로 turn으로 보냄
export function turn(angle: number, dx: number, sensitivity: number): number {
  const a = (angle + dx * sensitivity) % TAU
  // 0 바로 아래 값에 2π를 더하면 반올림돼 정확히 2π가 될 수 있어 한 번 더 묶음
  return a < 0 ? (a + TAU) % TAU : a
}

// 위아래 시선의 한계(라디안). 위가 +. 서버 Room.MaxPitch와 같은 값이어야 보낸 turn의 pitch를 서버가 버리지 않음.
// ponytail: 임시 값(시스템 기획서 조작). 플레이해 보며 정함
export const MAX_PITCH = 0.5

// 마우스 위아래 이동량(px)만큼 시선을 기울임. 마우스를 아래로(+dy) 움직이면 아래를 봄. 한계를 넘지 않게 자름
export function tilt(pitch: number, dy: number, sensitivity: number): number {
  return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch - dy * sensitivity))
}
