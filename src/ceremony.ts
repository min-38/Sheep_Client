import { SUN_AZ } from './desert.ts'
import { makeCamera, type Camera } from './render.ts'

// 승리 세레모니 (사용자 결정 2026-11-10, SHEEP-136, 시안 C). 승리 결과 시간이 끝나는 시각(준비 중 시각, 서버 시계)에서 거꾸로 잼.
// 걸어감(WALKOFF_MS) 동안 모두의 카메라가 이긴 사람 뒤로 가 넓게 보고, 이긴 사람은 해 쪽으로 천천히 걸어감. 그 마지막 IRIS_MS 동안
// 화면이 동그랗게 닫힘. 다 닫힌 검은 화면에 무성 영화 자막으로 받은 돈을 PAID_MS 동안 보인 뒤 술집으로 넘어감
// (사용자 결정 2026-11-11, SHEEP-150 시안 C). 그 앞은 지금처럼 판 끝 포스터.
// 서버 RoundFlow.WinResultDuration(10초)에서 WALKOFF_MS와 PAID_MS를 뺀 4초가 포스터를 보이는 시간임

// ms. ponytail: 임시 값. 플레이해 보며 정함
export const WALKOFF_MS = 4000
export const IRIS_MS = 1200
export const PAID_MS = 2000

// 해가 있는 쪽(라디안). 하늘의 해는 늘 같은 방위에 있음 (desert.ts)
const SUN = (SUN_AZ * Math.PI) / 180
// 칸/ms. 결투 전 걸음과 같은 빠르기(0.3칸을 0.7초에, SHEEP-141)
const PACE = 0.3 / 700
// 칸. 카메라는 이긴 사람이 선 자리에서 해 반대쪽으로 BACK, 높이 UP에서 해 쪽을 보고 움직이지 않아 걸어가는 사람이 점점 작아짐.
// ponytail: 둘레만 벽인 21칸 결투장이라 다 걸은 자리(중심에서 4칸)에서 어느 쪽으로 BACK을 물러나도 벽에 닿지 않음. 맵에 벽이 생기면 카메라를 벽 앞에서 멈춤
const BACK = 2.2
const UP = 0.75

// now(서버 시계)에 세레모니가 시작하고 지난 시간(ms). 아직 포스터를 보일 때면 null
// 받은 돈 자막 동안에도 이어 셈. 화면은 닫혀 있어 걷는 모습은 보이지 않음
export const walkoffAt = (end: number, now: number) => (now >= end - PAID_MS - WALKOFF_MS ? now - (end - PAID_MS - WALKOFF_MS) : null)

// 세레모니 시간(walkoffAt)이 이만큼 지나 화면이 다 닫혔으면 받은 돈 자막을 보임
export const paidShown = (walkoff: number | null) => walkoff !== null && walkoff >= WALKOFF_MS

// 이긴 사람이 (x, y)에서 걷기 시작해 elapsed(ms) 지난 자리와 바라보는 쪽
export const walkerAt = (x: number, y: number, elapsed: number) => ({ x: x + Math.cos(SUN) * PACE * elapsed, y: y + Math.sin(SUN) * PACE * elapsed, facing: SUN })

// 이긴 사람이 선 자리(x, y) 뒤에서 해 쪽을 보는 카메라. 걸어가는 사람의 발밑이 화면 가운데 조금 아래에 오게 살짝 내려다봄
export function walkoffCamera(x: number, y: number, fov: number): Camera {
  const cam = makeCamera(x - Math.cos(SUN) * BACK, y - Math.sin(SUN) * BACK, SUN, fov, -Math.atan((UP - 0.5) / (BACK + 2)))
  return { ...cam, z: UP }
}

// now(서버 시계)에 아이리스 구멍 크기(0~1). 1은 다 열림, 0은 다 닫힘
export const irisOpen = (end: number, now: number) => Math.min(1, Math.max(0, (end - PAID_MS - now) / IRIS_MS))
