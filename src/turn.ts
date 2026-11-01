const TAU = Math.PI * 2

// 마우스 좌우 이동량(px)만큼 시점을 돌림. 오른쪽(+dx)이 화면 오른쪽으로 도는 방향.
// 0~2π로 묶어 오래 돌아도 값이 커지지 않게 함
export function turn(angle: number, dx: number, sensitivity: number): number {
  const a = (angle + dx * sensitivity) % TAU
  return a < 0 ? a + TAU : a
}
