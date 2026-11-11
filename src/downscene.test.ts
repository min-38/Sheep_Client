import { describe, expect, test } from 'vitest'
import { SUICIDE_AIM, SUICIDE_FLASH } from './character.ts'
import { fallEye, fallSide, LANDED_MS, SCENE_MS, suicideSide } from './downscene.ts'

// 서버의 결과를 보여 주는 시간(시스템 기획서 판 흐름 시간). 함께 쓰러져 재대결로 가면 내 쓰러짐이 보인 뒤 적어도 이만큼 지나야 카운트다운임
const RESULT_MS = 3000
// 지연 보정 최대 시간 W(시스템 기획서 리볼버). 탈락은 맞은 발사에서 W 뒤에 오고, 결과는 W + D 뒤에 정해짐
const W_MS = 200

describe('쓰러짐 장면 시간 (시스템 기획서 HUD 쓰러짐)', () => {
  test('재대결 카운트다운 전에 끝남: 내 쓰러짐이 보인 뒤 가장 이른 카운트다운은 결과 시간 뒤', () => {
    // 내 탈락은 결과를 정하기 전에 오고, 보간 지연(0.1초)과 받는 지연(0.4초까지)만큼 늦게 보여도 남음
    expect(SCENE_MS + 100 + 400).toBeLessThanOrEqual(RESULT_MS + W_MS)
  })

  test('맞아도, 시간 초과로 옆머리를 쏴도 장면 안에서 바닥에 닿고 잠시 누워 있음', () => {
    expect(LANDED_MS + 1000).toBeLessThan(SCENE_MS)
    expect(SUICIDE_AIM + SUICIDE_FLASH + LANDED_MS + 500).toBeLessThan(SCENE_MS)
  })
})

// 내가 (10, 10)에 서서 facing 쪽을 볼 때 쏜 사람이 내 둘레 rel 쪽(내가 보는 쪽에서 잰 각도)에 있음
const shooterAt = (facing: number, rel: number) => [10 + 3 * Math.cos(facing + rel), 10 + 3 * Math.sin(facing + rel)] as const

describe('fallSide', () => {
  for (const facing of [0, 1, 4]) {
    test(`총알이 미는 쪽으로 넘어짐 (보는 각도 ${facing})`, () => {
      expect(fallSide(10, 10, facing, ...shooterAt(facing, 0))).toBe('back') // 정면에서 맞음
      expect(fallSide(10, 10, facing, ...shooterAt(facing, Math.PI))).toBe('forward') // 등 뒤에서 맞음
      // 화면 오른쪽은 각도가 커지는 쪽 (render.ts makeCamera). 오른쪽에서 맞으면 왼쪽으로 밀림
      expect(fallSide(10, 10, facing, ...shooterAt(facing, Math.PI / 2))).toBe('left')
      expect(fallSide(10, 10, facing, ...shooterAt(facing, -Math.PI / 2))).toBe('right')
      // 비스듬하면 더 가까운 쪽
      expect(fallSide(10, 10, facing, ...shooterAt(facing, 0.6))).toBe('back')
      expect(fallSide(10, 10, facing, ...shooterAt(facing, 1.0))).toBe('left')
    })
  }

  test('시간 초과는 총 든 손으로 옆머리를 쏴 반대쪽으로 넘어짐', () => {
    expect(suicideSide('right')).toBe('left')
    expect(suicideSide('left')).toBe('right')
  })
})

describe('fallEye', () => {
  const EYE = 0.84
  const facing = 1

  test('맞은 순간은 서 있던 눈 그대로', () => {
    for (const side of ['forward', 'back', 'left', 'right'] as const) {
      const e = fallEye(10, 10, facing, side, 0, EYE)
      const still = { x: 10, y: 10, z: EYE, angle: facing, pitch: 0, roll: 0 }
      for (const key of Object.keys(still) as (keyof typeof still)[]) expect(e[key]).toBeCloseTo(still[key])
    }
  })

  test('무릎이 꺾여 조금 내려앉은 뒤 넘어가며 점점 빨리 내려감', () => {
    const zs = [0, 100, 200, 400, 600, LANDED_MS].map((ms) => fallEye(10, 10, facing, 'back', ms, EYE).z)
    for (let i = 1; i < zs.length; i++) expect(zs[i]).toBeLessThan(zs[i - 1])
    const drop = (a: number, b: number) => fallEye(10, 10, facing, 'back', a, EYE).z - fallEye(10, 10, facing, 'back', b, EYE).z
    expect(drop(LANDED_MS - 200, LANDED_MS - 100)).toBeGreaterThan(drop(300, 400))
  })

  test('바닥에 닿으면 눈이 땅 가까이에서 멈추고, 넘어간 쪽으로 몸 길이만큼 옮겨 감', () => {
    const ahead = [Math.cos(facing), Math.sin(facing)]
    const right = [-Math.sin(facing), Math.cos(facing)]
    const moved = (side: 'forward' | 'back' | 'left' | 'right', dir: number[]) => {
      const e = fallEye(10, 10, facing, side, LANDED_MS + 500, EYE)
      expect(e).toEqual(fallEye(10, 10, facing, side, LANDED_MS + 2000, EYE))
      expect(e.z).toBeLessThan(0.25)
      expect(e.angle).toBe(facing)
      return (e.x - 10) * dir[0] + (e.y - 10) * dir[1]
    }
    expect(moved('forward', ahead)).toBeGreaterThan(0.5)
    expect(moved('back', ahead)).toBeLessThan(-0.5)
    expect(moved('right', right)).toBeGreaterThan(0.5)
    expect(moved('left', right)).toBeLessThan(-0.5)
  })

  test('앞으로 넘어지면 땅을, 뒤로 넘어지면 하늘을 보고, 옆으로 넘어지면 화면이 그쪽으로 기욺', () => {
    const at = (side: 'forward' | 'back' | 'left' | 'right') => fallEye(10, 10, facing, side, LANDED_MS, EYE)
    expect(at('forward').pitch).toBeLessThan(-1)
    expect(at('back').pitch).toBeGreaterThan(1)
    expect(at('right').roll).toBeGreaterThan(1)
    expect(at('left').roll).toBeLessThan(-1)
    expect(at('forward').roll).toBe(0)
    expect(at('right').pitch).toBe(0)
  })
})
