import { describe, expect, test } from 'vitest'
import { FALL_LAND_MS, SUICIDE_AIM, SUICIDE_FLASH } from './character.ts'
import { filming, motionMs, SCENE_MS, sceneCamera, SLOW } from './downscene.ts'
import { horizonY } from './render.ts'

// 서버의 결과를 보여 주는 시간(시스템 기획서 판 흐름 시간). 함께 쓰러져 재대결로 가면 내 쓰러짐이 보인 뒤 적어도 이만큼 지나야 카운트다운임
const RESULT_MS = 3000
// 지연 보정 최대 시간 W(시스템 기획서 리볼버). 탈락은 맞은 발사에서 W 뒤에 오고, 결과는 W + D 뒤에 정해짐
const W_MS = 200

describe('쓰러짐 장면 시간 (시스템 기획서 HUD 쓰러짐)', () => {
  test('재대결 카운트다운 전에 끝남: 내 쓰러짐이 보인 뒤 가장 이른 카운트다운은 결과 시간 뒤', () => {
    // 내 탈락은 결과를 정하기 전에 오고, 보간 지연(0.1초)과 받는 지연(0.4초까지)만큼 늦게 보여도 남음
    expect(SCENE_MS + 100 + 400).toBeLessThanOrEqual(RESULT_MS + W_MS)
  })

  test('느리게 넘어져도 장면 안에서 바닥에 닿고, 시간 초과도 자살 모습 뒤에 바닥에 닿음', () => {
    expect(FALL_LAND_MS / SLOW).toBeLessThan(SCENE_MS)
    expect((SUICIDE_AIM + SUICIDE_FLASH + FALL_LAND_MS) / SLOW).toBeLessThan(SCENE_MS + 1500)
    expect(motionMs(1000)).toBeCloseTo(1000 * SLOW)
  })

  test('바닥에 닿을 때까지만 영화처럼 띠와 바랜 색', () => {
    expect(filming(0, 'shot')).toBe(true)
    expect(filming(FALL_LAND_MS / SLOW - 1, 'shot')).toBe(true)
    expect(filming(FALL_LAND_MS / SLOW + 1, 'shot')).toBe(false)
    // 시간 초과는 총을 대고 쏜 뒤에 넘어지기 시작함
    expect(filming((SUICIDE_AIM + SUICIDE_FLASH + FALL_LAND_MS) / SLOW - 1, 'timeout')).toBe(true)
  })
})

describe('sceneCamera', () => {
  const W = 480
  const H = 270
  const FOV = 66
  // 화면에 비친 점 [x, y]. 칸 단위 바닥 자리와 높이
  function project(cam: ReturnType<typeof sceneCamera>, px: number, py: number, up: number) {
    const proj = W / (2 * Math.hypot(cam.planeX, cam.planeY))
    const rx = px - cam.x
    const ry = py - cam.y
    const invDet = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY)
    const z = invDet * (cam.planeX * ry - cam.planeY * rx)
    const sx = (invDet * (cam.dirY * rx - cam.dirX * ry)) / z
    return [(W / 2) * (1 + sx), horizonY(H, proj, cam.pitch) + (proj * ((cam.z ?? 0.5) - up)) / z]
  }

  test('내 앞 위에 서서 나를 내려다봄: 서 있는 발과 누운 머리가 화면 가운데 줄 안', () => {
    for (const facing of [0, 1, 4]) {
      for (const elapsed of [0, SCENE_MS]) {
        const cam = sceneCamera(10, 10, facing, elapsed, FOV)
        // 카메라는 바라보는 쪽 앞에 있고, 나를 향해 봄
        expect(Math.cos(facing) * (cam.x - 10) + Math.sin(facing) * (cam.y - 10)).toBeGreaterThan(1)
        expect(cam.dirX * Math.cos(facing) + cam.dirY * Math.sin(facing)).toBeCloseTo(-1)
        expect(cam.pitch).toBeLessThan(0)
        const feet = project(cam, 10, 10, 0)
        // 뒤로 넘어져 누우면 머리가 발에서 바라보는 쪽 반대로 0.9칸쯤
        const head = project(cam, 10 - Math.cos(facing) * 0.9, 10 - Math.sin(facing) * 0.9, 0.05)
        for (const [x, y] of [feet, head]) {
          expect(Math.abs(x - W / 2)).toBeLessThan(1)
          expect(y).toBeGreaterThan(H * 0.15)
          expect(y).toBeLessThan(H * 0.85)
        }
      }
    }
  })
})
