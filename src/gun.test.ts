import { describe, expect, test } from 'vitest'
import mtlText from './assets/revolver.mtl?raw'
import objText from './assets/revolver.obj?raw'
import { drawGun, faceNormal, GUN_POS, lift, paintOrder, RAISE_MS, RECOIL_MS, shade, transform, type GunPose } from './gun.ts'
import { parseMtl, parseObj, type Mesh, type RGB } from './obj.ts'
import { SCALE_MAX, SWAY_PITCH } from './sway.ts'

const STILL: GunPose = { yaw: 0, pitch: 0, kick: 0, lower: 0 }
const GREY: RGB = [100, 100, 100]

// 모델 좌표의 막대. 총열처럼 +x로 길고, 0번이 손잡이 쪽, 1번이 총구 쪽
const stick: Mesh = {
  vertices: [
    [0, 0, 0],
    [2, 0, 0],
    [1, 0.2, 0],
  ],
  faces: [{ v: [0, 1, 2], color: GREY }],
}

// Blender가 내보내는 기본 정육면체를 작게 줄인 것. 오른손 좌표에서 바깥쪽에서 볼 때 반시계로 감음
const cube = parseObj(
  [
    'v 0.1 0.1 -0.1',
    'v 0.1 -0.1 -0.1',
    'v 0.1 0.1 0.1',
    'v 0.1 -0.1 0.1',
    'v -0.1 0.1 -0.1',
    'v -0.1 -0.1 -0.1',
    'v -0.1 0.1 0.1',
    'v -0.1 -0.1 0.1',
    'f 1 5 7 3', // +y 위
    'f 4 3 7 8', // +z
    'f 8 7 5 6', // -x 손잡이 쪽, 눈에 가장 가까움
    'f 6 2 4 8', // -y 아래
    'f 2 1 3 4', // +x 총구 쪽
    'f 6 5 1 2', // -z
  ].join('\n'),
  new Map(),
)

function fakeContext() {
  const filled: string[] = []
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: '',
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {
      filled.push(ctx.fillStyle)
    },
    stroke() {},
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, filled }
}

describe('transform', () => {
  test('흔들림과 반동이 없으면 꼭짓점 평균이 GUN_POS에 놓임', () => {
    const verts = transform(stick, STILL)
    for (let k = 0; k < 3; k++) {
      const mean = verts.reduce((s, v) => s + v[k], 0) / verts.length
      expect(Math.abs(mean - GUN_POS[k])).toBeLessThan(0.05)
    }
  })

  test('총열(모델 +x)이 앞(+z)을, 모델 위(+y)가 위를 향함', () => {
    const [grip, muzzle, top] = transform(stick, STILL)
    expect(muzzle[2]).toBeGreaterThan(grip[2])
    expect(top[1]).toBeGreaterThan(grip[1])
  })

  test('반동이 있으면 총구가 들림', () => {
    const still = transform(stick, STILL)[1]
    const kicked = transform(stick, { ...STILL, kick: 1 })[1]
    expect(kicked[1]).toBeGreaterThan(still[1])
  })

  test('다 내리면 흔들림이 가장 커도 리볼버 전체가 화면 아래로 숨음', () => {
    const revolver = parseObj(objText, parseMtl(mtlText))
    const verts = transform(revolver, { ...STILL, pitch: SWAY_PITCH * SCALE_MAX, lower: 1 })
    for (const [, y, z] of verts) expect(135 - (370 * y) / z).toBeGreaterThan(270)
  })

  test('흔들림 yaw가 +면 총구가 오른쪽, pitch가 +면 위로 감', () => {
    const still = transform(stick, STILL)[1]
    expect(transform(stick, { ...STILL, yaw: 0.1 })[1][0]).toBeGreaterThan(still[0])
    expect(transform(stick, { ...STILL, pitch: 0.1 })[1][1]).toBeGreaterThan(still[1])
  })
})

describe('faceNormal', () => {
  test('눈 좌표로 옮긴 뒤에도 법선이 바깥을 향함', () => {
    const verts = transform(cube, STILL)
    expect(faceNormal(verts, cube.faces[2].v)[2]).toBeCloseTo(-1)
    expect(faceNormal(verts, cube.faces[0].v)[1]).toBeCloseTo(1)
  })
})

describe('paintOrder', () => {
  test('평균 z가 큰(먼) 면부터', () => {
    const verts: [number, number, number][] = [
      [0, 0, 1],
      [0, 0, 3],
      [0, 0, 2],
    ]
    const faces = [0, 1, 2].map((i) => ({ v: [i], color: GREY }))
    expect(paintOrder(verts, faces)).toEqual([1, 2, 0])
  })
})

describe('shade', () => {
  test('빛을 마주 보는 면이 등진 면보다 밝음', () => {
    const lit = shade(GREY, [0, 1, 0])
    const dark = shade(GREY, [0, -1, 0])
    expect(lit[0]).toBeGreaterThan(dark[0])
    expect(dark[0]).toBeGreaterThan(0)
  })
})

describe('drawGun', () => {
  test('오른쪽 아래의 정육면체는 보이는 세 면(앞, 왼쪽, 위)만 칠함', () => {
    const { ctx, filled } = fakeContext()
    drawGun(ctx, cube, STILL, 480, 270, 370)
    expect(filled).toHaveLength(3)
  })

  test('총구 자리를 화면 오른쪽 아래 어딘가로 돌려줌', () => {
    const { ctx } = fakeContext()
    const muzzle = drawGun(ctx, stick, STILL, 480, 270, 370)
    expect(muzzle.x).toBeGreaterThan(240)
    expect(muzzle.y).toBeGreaterThan(135)
  })
})

describe('lift', () => {
  test('"시작!" 전과 판 사이에는 총을 다 내림', () => {
    expect(lift({}, 5000)).toEqual({ lower: 1, kick: 0 })
    expect(lift({ countdown: 0, walk: 1000, duel: 5000 }, 4999)).toEqual({ lower: 1, kick: 0 })
  })

  test('"시작!"부터 RAISE_MS 동안 처음에 빨리 들어 올림', () => {
    const s = { duel: 1000 }
    expect(lift(s, 1000).lower).toBe(1)
    const half = lift(s, 1000 + RAISE_MS / 2).lower
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(0.5)
    expect(lift(s, 1000 + RAISE_MS).lower).toBe(0)
  })

  test('다 든 순간 쏠 때보다 작게 튀고 RECOIL_MS 뒤에는 든 채로 멈춤', () => {
    const s = { duel: 1000 }
    expect(lift(s, 1000 + RAISE_MS - 1).kick).toBe(0)
    const jolt = lift(s, 1000 + RAISE_MS).kick
    expect(jolt).toBeGreaterThan(0)
    expect(jolt).toBeLessThan(1)
    expect(lift(s, 1000 + RAISE_MS + RECOIL_MS)).toEqual({ lower: 0, kick: 0 })
    expect(lift(s, 60000)).toEqual({ lower: 0, kick: 0 })
  })
})
