const TAU = Math.PI * 2

// 마우스 좌우 이동량(px)만큼 시점을 돌림. 오른쪽(+dx)이 화면 오른쪽으로 도는 방향.
// 0 이상 2π 미만으로 묶어 오래 돌아도 값이 커지지 않게 함. 이 값을 그대로 turn으로 보냄
export function turn(angle: number, dx: number, sensitivity: number): number {
  const a = (angle + dx * sensitivity) % TAU
  // 0 바로 아래 값에 2π를 더하면 반올림돼 정확히 2π가 될 수 있어 한 번 더 묶음
  return a < 0 ? (a + TAU) % TAU : a
}
