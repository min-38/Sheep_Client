// 첫 화면 배경 카메라. 가운데(cx, cy)에서 radius 떨어진 원을 돌며 늘 가운데를 봄. 돌수록 뒤의 하늘 그림이 다 지나감.
// phase는 가운데에서 본 카메라의 방위(라디안), angle은 makeCamera에 넘기는 시선
export function orbit(cx: number, cy: number, radius: number, phase: number) {
  return { x: cx + radius * Math.cos(phase), y: cy + radius * Math.sin(phase), angle: phase + Math.PI }
}
