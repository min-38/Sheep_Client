import { FALL_LAND_MS, SUICIDE_AIM, SUICIDE_FLASH } from './character.ts'
import { makeCamera, type Camera } from './render.ts'

// 쓰러짐 장면 (시스템 기획서 HUD 쓰러짐, SHEEP-119). 내가 쓰러진 것을 보여 주는 때부터 SCENE_MS 동안 내 몸을 앞 위에서 내려다보며
// 느리게 넘어지는 모습을 보여 주고, 끝나면 관전으로 감. 느린 화면은 내 화면에서만이고 서버와 다른 사람은 모름

// ms. 함께 쓰러져 재대결로 가도 카운트다운(결과 3초 뒤) 전에 끝나야 함. ponytail: 임시 값. 플레이해 보며 정함
export const SCENE_MS = 2500
// 넘어지는 동작을 늦추는 배율. ponytail: 임시 값
export const SLOW = 0.45

// 장면이 시작하고 지난 시간(ms)의 동작 시간(ms)
export const motionMs = (elapsed: number) => elapsed * SLOW

// 바닥에 닿을 때까지 위아래 검은 띠와 바랜 색을 씌움. 시간 초과는 총을 대고 쏜 모습 뒤에 넘어지기 시작함
export const filming = (elapsed: number, reason: 'shot' | 'timeout') =>
  motionMs(elapsed) < (reason === 'timeout' ? SUICIDE_AIM + SUICIDE_FLASH : 0) + FALL_LAND_MS

// 칸. 카메라는 내가 바라보던 쪽 앞 위에서 내 발을 내려다보고, 장면 동안 조금씩 물러나며 올라감. 뒤로 넘어지면 머리가 화면 위쪽으로 감.
// ponytail: 임시 값
const FROM = { back: 2.4, up: 2.0 }
const TO = { back: 2.7, up: 2.3 }
// 칸. 내려다보는 점의 높이. 발목쯤이라 서 있을 때 모자까지, 누우면 몸 전체가 화면 가운데 줄에 듦
const AIM_UP = 0.2

// 장면의 카메라. x, y는 내 발 자리(칸), facing은 쓰러질 때 바라보던 각도, fov는 가로 시야각(도)
export function sceneCamera(x: number, y: number, facing: number, elapsed: number, fov: number): Camera {
  const u = Math.min(1, Math.max(0, elapsed / SCENE_MS))
  const back = FROM.back + (TO.back - FROM.back) * u
  const up = FROM.up + (TO.up - FROM.up) * u
  const cam = makeCamera(x + Math.cos(facing) * back, y + Math.sin(facing) * back, facing + Math.PI, fov, -Math.atan((up - AIM_UP) / back))
  return { ...cam, z: up }
}
