import { describe, expect, test } from 'vitest'
import revolverData from './assets/revolver-rig.json'
import {
  drawGun,
  faceNormal,
  gunClips,
  GUN_POS,
  lift,
  paintOrder,
  RAISE_MS,
  RECOIL_MS,
  RELOAD_AT,
  RELOAD_END,
  RELOAD_MS,
  RELOAD_SEATED,
  RELOAD_SHUT,
  reloadSoundAt,
  revolverMesh,
  shade,
  transform,
  type GunPose,
} from './gun.ts'
import { sample, skin, type Mesh, type RGB, type Rig } from './rig.ts'
import { SCALE_MAX, SWAY_PITCH } from './sway.ts'

const STILL: GunPose = { yaw: 0, pitch: 0, kick: 0, lower: 0 }
const GREY: RGB = [100, 100, 100]
const revolver = revolverData as Rig

// 모델 좌표(m)의 막대. 총열처럼 +x로 길고 원점이 가운데. 0번이 손잡이 쪽, 1번이 총구 쪽
const stick: Mesh = {
  vertices: [
    [-0.15, 0, 0],
    [0.15, 0, 0],
    [0, 0.03, 0],
  ],
  faces: [{ v: [0, 1, 2], color: GREY }],
}

// 원점에 놓인 한 변 4cm 정육면체. 오른손 좌표에서 바깥쪽에서 볼 때 반시계로 감음 (Blender 기본 정육면체와 같은 순서)
const cube: Mesh = {
  vertices: [
    [0.02, 0.02, -0.02],
    [0.02, -0.02, -0.02],
    [0.02, 0.02, 0.02],
    [0.02, -0.02, 0.02],
    [-0.02, 0.02, -0.02],
    [-0.02, -0.02, -0.02],
    [-0.02, 0.02, 0.02],
    [-0.02, -0.02, 0.02],
  ],
  faces: [
    [0, 4, 6, 2], // +y 위
    [3, 2, 6, 7], // +z
    [7, 6, 4, 5], // -x 손잡이 쪽, 눈에 가장 가까움
    [5, 1, 3, 7], // -y 아래
    [1, 0, 2, 3], // +x 총구 쪽
    [5, 4, 0, 1], // -z
  ].map((v) => ({ v, color: GREY })),
}

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
  test('흔들림과 반동이 없으면 모델 원점이 GUN_POS에 놓임', () => {
    const [origin] = transform({ vertices: [[0, 0, 0]], faces: [] }, STILL)
    origin.forEach((x, k) => expect(x).toBeCloseTo(GUN_POS[k]))
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
    const verts = transform(revolverMesh(revolver, [], 6), { ...STILL, pitch: SWAY_PITCH * SCALE_MAX, lower: 1 })
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

  test('왼손이면 왼쪽 아래에 그리고 뒤집힌 정육면체도 보이는 세 면만 칠함', () => {
    const { ctx, filled } = fakeContext()
    const muzzle = drawGun(ctx, cube, STILL, 480, 270, 370, -1)
    expect(filled).toHaveLength(3)
    expect(muzzle.x).toBeLessThan(240)
    expect(muzzle.y).toBeGreaterThan(135)
  })
})

describe('transform 왼손', () => {
  test('흔들림이 없으면 오른손 자리를 좌우로 뒤집은 자리', () => {
    const right = transform(stick, STILL)
    const left = transform(stick, STILL, -1)
    left.forEach(([x, y, z], i) => {
      expect(x).toBeCloseTo(-right[i][0])
      expect(y).toBeCloseTo(right[i][1])
      expect(z).toBeCloseTo(right[i][2])
    })
  })

  test('조준점처럼 오른쪽 흔들림(yaw > 0)에 총구가 오른쪽으로 감', () => {
    const still = transform(stick, STILL, -1)[1]
    expect(transform(stick, { ...STILL, yaw: 0.1 }, -1)[1][0]).toBeGreaterThan(still[0])
  })
})

describe('lift', () => {
  test('"시작!" 전과 판 사이에는 총을 다 내림', () => {
    expect(lift({}, 5000, false)).toEqual({ lower: 1, kick: 0 })
    expect(lift({ countdown: 0, walk: 1000, duel: 5000 }, 4999, true)).toEqual({ lower: 1, kick: 0 })
  })

  test('"시작!"부터 RAISE_MS 동안 처음에 빨리 들어 올림', () => {
    const s = { duel: 1000 }
    expect(lift(s, 1000, false).lower).toBe(1)
    const half = lift(s, 1000 + RAISE_MS / 2, false).lower
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(0.5)
    expect(lift(s, 1000 + RAISE_MS, false).lower).toBe(0)
  })

  test('다 든 순간 쏠 때보다 작게 튀고 RECOIL_MS 뒤에는 든 채로 멈춤', () => {
    const s = { duel: 1000 }
    expect(lift(s, 1000 + RAISE_MS - 1, false).kick).toBe(0)
    const jolt = lift(s, 1000 + RAISE_MS, false).kick
    expect(jolt).toBeGreaterThan(0)
    expect(jolt).toBeLessThan(1)
    expect(lift(s, 1000 + RAISE_MS + RECOIL_MS, false)).toEqual({ lower: 0, kick: 0 })
    expect(lift(s, 60000, false)).toEqual({ lower: 0, kick: 0 })
  })

  test('장전하는 카운트다운에는 RAISE_MS 동안 겨눌 때보다 높이 들고, 장전 클립이 끝나면 내림', () => {
    const s = { countdown: 1000, walk: 5000 }
    const reloaded = 1000 + RELOAD_AT + RELOAD_MS
    expect(lift(s, 1000, true).lower).toBe(1)
    const high = lift(s, 1000 + RAISE_MS, true).lower
    expect(high).toBeLessThan(0)
    expect(lift(s, reloaded, true).lower).toBe(high)
    expect(lift(s, reloaded + 100, true).lower).toBeGreaterThan(high)
    // 권총집에 넣어 걷기 전에 다 내림
    expect(lift(s, 1000 + RELOAD_END, true).lower).toBe(1)
  })

  test('장전하지 않는(재대결에 끼지 못한) 카운트다운에는 내린 채', () => {
    expect(lift({ countdown: 1000, walk: 4000 }, 2000, false)).toEqual({ lower: 1, kick: 0 })
  })
})

describe('gunClips', () => {
  test('판 밖과 걷는 동안에는 쉰 자세', () => {
    expect(gunClips({}, 5000, true, -Infinity)).toEqual([])
    expect(gunClips({ countdown: 0, walk: 3000 }, 4000, false, -Infinity)).toEqual([])
  })

  test('장전하는 카운트다운에는 RELOAD_AT부터 Reload 클립을 RELOAD_MS(2.5초)에 걸쳐 느리게 한 번 (사용자 결정 2026-11-10, SHEEP-121)', () => {
    expect(RELOAD_MS).toBe(2500)
    const s = { countdown: 1000, walk: 5000 }
    const start = 1000 + RELOAD_AT
    const length = revolver.clips.Reload.duration
    expect(gunClips(s, start - 1, true, -Infinity)).toEqual([])
    const [half] = gunClips(s, start + RELOAD_MS / 2, true, -Infinity)
    expect(half.clip).toBe('Reload')
    expect(half.t).toBeCloseTo(length / 2, 6)
    expect(gunClips(s, start + RELOAD_MS + 1, true, -Infinity)).toEqual([])
    expect(gunClips(s, start + 500, false, -Infinity)).toEqual([])
  })

  test('장전 소리 시각은 느린 클립에서 총알이 들어가고 실린더가 닫히는 때이고, 권총집에 넣기까지 카운트다운 4초 안에 끝남', () => {
    const length = revolver.clips.Reload.duration
    expect(reloadSoundAt(RELOAD_SEATED)).toBeCloseTo(RELOAD_AT + (RELOAD_SEATED / length) * RELOAD_MS, 6)
    expect(reloadSoundAt(RELOAD_SHUT)).toBeLessThan(RELOAD_AT + RELOAD_MS)
    expect(RELOAD_END).toBeGreaterThan(RELOAD_AT + RELOAD_MS)
    expect(RELOAD_END).toBeLessThanOrEqual(4000)
  })

  test('RELOAD_SEATED에 총알이 칸에 다 들어가고 RELOAD_SHUT에 실린더가 다 닫힘', () => {
    const { channels } = revolver.clips.Reload
    const bullet = revolver.joints.findIndex((j) => j.chamber === 0)
    const slide = channels.find((c) => c.joint === bullet && c.path === 'translation')!
    const hinge = channels.find((c) => revolver.joints[c.joint].name === 'DEF_ReloadingHinge')!
    const seated = (t: number) => sample(slide, t).every((x, k) => Math.abs(x - revolver.joints[bullet].t[k]) < 1e-3)
    const shut = (t: number) => Math.abs(sample(hinge, t)[3]) > 0.9999
    expect(seated(RELOAD_SEATED)).toBe(true)
    expect(seated(RELOAD_SEATED - 0.03)).toBe(false)
    expect(shut(RELOAD_SHUT)).toBe(true)
    expect(shut(RELOAD_SHUT - 0.03)).toBe(false)
  })

  test('"시작!"부터 총을 다 드는 RAISE_MS 동안 공이치기를 끝까지 당김', () => {
    const s = { countdown: 0, walk: 1000, duel: 5000 }
    expect(gunClips(s, 5000, false, -Infinity)).toEqual([{ clip: 'Cock', t: 0 }])
    const [cocked] = gunClips(s, 5000 + RAISE_MS, false, -Infinity)
    expect(cocked.t).toBeCloseTo(revolver.clips.Cock.duration)
  })

  test('이번 결투에서 쏘면 쏜 때부터 Fire 클립을 덮음. 앞 판에 쏜 것은 셈하지 않음', () => {
    const s = { countdown: 0, walk: 1000, duel: 5000 }
    expect(gunClips(s, 6100, false, 6000)[1]).toEqual({ clip: 'Fire', t: 0.1 })
    expect(gunClips(s, 6100, false, 4000)).toHaveLength(1)
  })
})

describe('revolverMesh', () => {
  // 면 셋: 몸통, 0번 칸 총알, 1번 칸 총알
  const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const joint = (chamber?: number) => ({ name: '', parent: -1, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], ibm: I4, chamber })
  const rig: Rig = {
    joints: [joint(), joint(0), joint(1)],
    vertices: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    weights: [[0, 1], [1, 1], [2, 1]],
    faces: [
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2],
    ],
    colors: [GREY, GREY, GREY],
    clips: { Reload: { duration: 1, channels: [] } },
  }
  const reload = [{ clip: 'Reload', t: 0 }]

  test('장전하는 동안 남은 총알 수만큼 앞 칸의 총알만 그림', () => {
    expect(revolverMesh(rig, reload, 2).faces).toHaveLength(3)
    expect(revolverMesh(rig, reload, 1).faces.map((f) => f.v[0])).toEqual([0, 1])
    expect(revolverMesh(rig, reload, 0).faces.map((f) => f.v[0])).toEqual([0])
  })

  test('실린더가 닫혀 있으면 총알을 그리지 않음', () => {
    expect(revolverMesh(rig, [], 2).faces.map((f) => f.v[0])).toEqual([0])
  })

  test('꼭짓점은 클립을 덮은 자리', () => {
    expect(revolverMesh(revolver, [{ clip: 'Reload', t: 0.5 }], 1).vertices).toEqual(skin(revolver, [{ clip: 'Reload', t: 0.5 }]))
  })
})
