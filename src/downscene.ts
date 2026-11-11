import type { Hand } from './settings.ts'

// 쓰러짐 장면 (시스템 기획서 HUD 쓰러짐, SHEEP-166. SHEEP-119의 위에서 느리게 보기를 바꿈). 내가 쓰러진 것을 보여 주는 때부터
// SCENE_MS 동안 내 눈 그대로 맞은 쪽으로 넘어져 바닥에 눕고, 끝나면 관전으로 감. 서부 영화 같은 느린 화면이나 띠는 없음.
// 이 눈은 내 화면에서만이고 서버와 다른 사람은 모름

// ms. 함께 쓰러져 재대결로 가도 카운트다운(결과 3초 뒤) 전에 끝나야 함. ponytail: 임시 값. 플레이해 보며 정함
export const SCENE_MS = 2500

// 넘어지는 쪽. 내가 보던 쪽을 앞으로 잼
export type FallSide = 'forward' | 'back' | 'left' | 'right'

// 총알은 쏜 사람 자리(fromX, fromY)에서 맞은 사람 자리(x, y)로 날아와 맞은 사람을 그쪽으로 밂. facing은 맞은 사람이 보던 각도.
// 화면 오른쪽은 각도가 커지는 쪽 (render.ts makeCamera). 비스듬히 맞으면 더 가까운 쪽으로 넘어짐
export function fallSide(x: number, y: number, facing: number, fromX: number, fromY: number): FallSide {
  const push = Math.atan2(y - fromY, x - fromX) - facing
  const ahead = Math.cos(push)
  const side = Math.sin(push)
  if (Math.abs(ahead) >= Math.abs(side)) return ahead > 0 ? 'forward' : 'back'
  return side > 0 ? 'right' : 'left'
}

// 제한 시간이 지나면 총 든 손으로 옆머리를 쏨. 총알이 머리를 반대쪽으로 밂
export const suicideSide = (hand: Hand): FallSide => (hand === 'right' ? 'left' : 'right')

// ms. 맞고 무릎이 꺾여 주저앉는 동안, 그 뒤 발을 축으로 바닥까지 넘어가는 동안. ponytail: 임시 값. 플레이해 보며 정함
const BUCKLE_MS = 180
const TOPPLE_MS = 650
// 맞은 때부터 바닥에 닿기까지(ms). 시간 초과는 옆머리를 쏜 뒤부터 잼
export const LANDED_MS = BUCKLE_MS + TOPPLE_MS
// 무릎이 꺾여 눈이 내려앉는 몫, 다 넘어졌을 때 몸이 섰던 데서 기운 각도(라디안). 눕기 전 팔이나 어깨가 먼저 땅에 닿아 90°까지는 가지 않음
const BUCKLE = 0.12
const LAND = 1.35
// 넘어지는 쪽 각도. 내가 보던 쪽에서 잼
const TOWARD: Record<FallSide, number> = { forward: 0, right: Math.PI / 2, back: Math.PI, left: -Math.PI / 2 }

// 1인칭 눈. x, y, z는 자리와 높이(칸), angle과 pitch는 render.ts 카메라와 같고, roll은 화면을 기울이는 각도(라디안, 오른쪽으로 넘어지면 +)
export type FallView = { x: number; y: number; z: number; angle: number; pitch: number; roll: number }

// 맞은 뒤 ms가 지난 내 눈. x, y는 발 자리, facing은 보던 각도, eye는 서 있을 때 눈높이(칸).
// 무릎이 꺾여 조금 내려앉은 뒤 발을 축으로 통나무처럼 넘어가고, 떨어지듯 점점 빨라짐. 앞으로 넘어지면 땅을, 뒤로 넘어지면 하늘을 보고,
// 옆으로 넘어지면 그쪽으로 화면이 기욺
export function fallEye(x: number, y: number, facing: number, side: FallSide, ms: number, eye: number): FallView {
  const k = Math.min(1, Math.max(0, ms / BUCKLE_MS))
  const height = eye * (1 - BUCKLE * k * k * (3 - 2 * k))
  const u = Math.min(1, Math.max(0, (ms - BUCKLE_MS) / TOPPLE_MS))
  const tilt = LAND * u * u
  const out = height * Math.sin(tilt)
  const toward = facing + TOWARD[side]
  return {
    x: x + Math.cos(toward) * out,
    y: y + Math.sin(toward) * out,
    z: height * Math.cos(tilt),
    angle: facing,
    pitch: side === 'forward' ? -tilt : side === 'back' ? tilt : 0,
    roll: side === 'right' ? tilt : side === 'left' ? -tilt : 0,
  }
}
