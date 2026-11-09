import { describe, expect, test } from 'vitest'
import revolverData from './assets/revolver-rig.json'
import { BORE, CHAMBER_RADIUS, chamberAt, CHAMBERS, CYLINDER_TURN, cylinderSvg, FLUTE_DISTANCE, FLUTE_RADIUS, outline, RADIUS } from './cylinder.ts'
import type { Rig } from './rig.ts'

const dist = ([ax, ay]: [number, number], [bx, by]: [number, number]) => Math.hypot(ax - bx, ay - by)

describe('chamberAt', () => {
  test('0번 칸이 맨 위, 1번 칸은 왼쪽 위', () => {
    expect(chamberAt(0)[0]).toBeCloseTo(50)
    expect(chamberAt(0)[1]).toBeCloseTo(50 - BORE)
    expect(chamberAt(1)[0]).toBeLessThan(50)
    expect(chamberAt(1)[1]).toBeLessThan(50)
  })

  test('1인칭 총의 칸 차례와 같음: 실린더 축에서 0번이 위, 1번이 왼쪽(-z)', () => {
    // revolver-rig.json에서 실린더 뼈는 손잡이 쪽 x축(총열)을 축으로 놓였고, 그 local -x가 위, z가 오른쪽임
    const bullets = (revolverData as Rig).joints.filter((j) => j.chamber !== undefined)
    const at = (n: number) => bullets.find((j) => j.chamber === n)!.t
    expect(at(0)[0]).toBeLessThan(0)
    expect(at(0)[2]).toBeCloseTo(0)
    expect(at(1)[2]).toBeLessThan(0)
  })

  test('도는 시간은 1인칭 총의 Fire 클립에서 실린더가 마지막 자리에 닿는 시각', () => {
    const rig = revolverData as Rig
    const cylinder = rig.joints.findIndex((j) => j.name === 'DEF_Cylinder')
    const ch = rig.clips.Fire.channels.find((c) => c.joint === cylinder && c.path === 'rotation')!
    const last = JSON.stringify(ch.values.at(-1))
    const reached = ch.times[ch.values.findIndex((v) => JSON.stringify(v) === last)]
    expect(reached * 1000).toBeCloseTo(CYLINDER_TURN, -1)
  })
})

describe('실린더 모양', () => {
  test('칸끼리, 칸과 바깥, 칸과 홈 사이에 쇠 벽이 남음', () => {
    expect(dist(chamberAt(0), chamberAt(1)) - 2 * CHAMBER_RADIUS).toBeGreaterThan(3)
    expect(RADIUS - BORE - CHAMBER_RADIUS).toBeGreaterThan(3)
    // 홈 중심은 칸과 칸 사이(30°)
    const flute: [number, number] = [50 + FLUTE_DISTANCE * Math.sin(Math.PI / 6), 50 - FLUTE_DISTANCE * Math.cos(Math.PI / 6)]
    expect(dist(flute, chamberAt(0)) - FLUTE_RADIUS - CHAMBER_RADIUS).toBeGreaterThan(1)
  })

  test('윤곽은 바깥 호 6개와 홈 호 6개로 닫힘', () => {
    const d = outline()
    expect(d.match(/A46 46/g)).toHaveLength(CHAMBERS)
    expect(d.match(new RegExp(`A${FLUTE_RADIUS} ${FLUTE_RADIUS}`, 'g'))).toHaveLength(CHAMBERS)
    expect(d.endsWith('Z')).toBe(true)
  })

  test('칸마다 탄피 바닥 하나', () => {
    expect(cylinderSvg().match(/class="round"/g)).toHaveLength(CHAMBERS)
  })
})
