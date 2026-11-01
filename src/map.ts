import type { Grid } from './raycast.ts'

// ponytail: 크기는 임시 값. 걷는 거리가 정해지면 7명이 걷기를 마쳐도 벽에 닿지 않게 다시 잡음
const SIZE = 21

// 임시 고정 맵. 서버가 맵을 보내기 전까지 씀 (SHEEP-7). 둘레만 벽인 빈 결투장
export const MAP: Grid = Array.from({ length: SIZE }, (_, y) =>
  Array.from({ length: SIZE }, (_, x) => (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1 ? 1 : 0)),
)
