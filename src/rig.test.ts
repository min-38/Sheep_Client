import { describe, expect, test } from 'vitest'
import revolverData from './assets/revolver-rig.json'
import { sample, skin, slerp, type Channel, type Rig } from './rig.ts'

const revolver = revolverData as Rig
// z축으로 90° 돈 사원수
const Z90 = [0, 0, Math.SQRT1_2, Math.SQRT1_2]
const ID = [0, 0, 0, 1]
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

describe('slerp', () => {
  test('끝점은 그대로이고 가운데는 반만 돎', () => {
    expect(slerp(ID, Z90, 0)).toEqual(ID)
    slerp(ID, Z90, 1).forEach((x, k) => expect(x).toBeCloseTo(Z90[k]))
    const half = slerp(ID, Z90, 0.5)
    // z축 45°
    expect(half[2]).toBeCloseTo(Math.sin(Math.PI / 8))
    expect(half[3]).toBeCloseTo(Math.cos(Math.PI / 8))
  })

  test('부호가 반대인 같은 회전(-q)으로는 짧은 쪽으로 돎', () => {
    const half = slerp(ID, Z90.map((x) => -x), 0.5)
    expect(Math.abs(half[2])).toBeCloseTo(Math.sin(Math.PI / 8))
    expect(Math.abs(half[3])).toBeCloseTo(Math.cos(Math.PI / 8))
  })
})

describe('sample', () => {
  const move: Channel = { joint: 0, path: 'translation', interpolation: 'LINEAR', times: [1, 2], values: [[0, 0, 0], [2, 4, 0]] }

  test('키 사이는 선형, 첫 키 전과 끝 키 뒤는 끝값', () => {
    expect(sample(move, 1.5)).toEqual([1, 2, 0])
    expect(sample(move, 0)).toEqual([0, 0, 0])
    expect(sample(move, 9)).toEqual([2, 4, 0])
  })

  test('STEP은 다음 키까지 앞 키 값', () => {
    expect(sample({ ...move, interpolation: 'STEP' }, 1.9)).toEqual([0, 0, 0])
  })

  test('회전은 slerp', () => {
    const turn: Channel = { joint: 0, path: 'rotation', interpolation: 'LINEAR', times: [0, 1], values: [ID, Z90] }
    expect(sample(turn, 0.5)).toEqual(slerp(ID, Z90, 0.5))
  })
})

describe('skin', () => {
  // 뼈 둘: 0번은 원점, 1번은 0번에서 x로 1 떨어진 자리. 꼭짓점 하나가 두 뼈에 3:1로 묶임
  const rig: Rig = {
    joints: [
      { name: 'a', parent: -1, t: [0, 0, 0], r: ID, s: [1, 1, 1], ibm: I4 },
      { name: 'b', parent: 0, t: [1, 0, 0], r: ID, s: [1, 1, 1], ibm: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 1] },
    ],
    vertices: [[1, 1, 0]],
    weights: [[0, 0.75, 1, 0.25]],
    faces: [],
    colors: [],
    clips: {
      // 1번 뼈를 제자리에서 z축으로 90° 돌림
      bend: { duration: 1, channels: [{ joint: 1, path: 'rotation', interpolation: 'LINEAR', times: [0, 1], values: [ID, Z90] }] },
      // 뿌리를 y로 2 올림. 자식 뼈도 같이 올라감
      lift: { duration: 1, channels: [{ joint: 0, path: 'translation', interpolation: 'LINEAR', times: [0], values: [[0, 2, 0]] }] },
    },
  }

  test('쉰 자세면 묶은 자리 그대로', () => {
    skin(rig, []).forEach((v, i) => v.forEach((x, k) => expect(x).toBeCloseTo(rig.vertices[i][k])))
  })

  test('두 뼈의 행렬을 무게대로 섞음', () => {
    // 1번 뼈만 따르면 (1, 1, 0)이 뼈 (1, 0, 0)을 축으로 돌아 (0, 0, 0). 0번은 그대로이니 3:1로 섞으면 (0.75, 0.75, 0)
    const [v] = skin(rig, [{ clip: 'bend', t: 1 }])
    expect(v[0]).toBeCloseTo(0.75)
    expect(v[1]).toBeCloseTo(0.75)
    expect(v[2]).toBeCloseTo(0)
  })

  test('뒤의 클립이 덮고, 부모 뼈가 움직이면 자식도 따라감', () => {
    const [v] = skin(rig, [{ clip: 'bend', t: 1 }, { clip: 'lift', t: 0 }])
    expect(v[0]).toBeCloseTo(0.75)
    expect(v[1]).toBeCloseTo(2.75)
  })
})

describe('revolver-rig.json', () => {
  test('면은 셋씩 있는 꼭짓점을 가리키고 색은 0..255', () => {
    expect(revolver.faces).toHaveLength(revolver.colors.length)
    for (const f of revolver.faces) {
      expect(f).toHaveLength(3)
      for (const i of f) expect(revolver.vertices[i]).toBeDefined()
    }
    for (const c of revolver.colors) for (const x of c) expect(x >= 0 && x <= 255).toBe(true)
  })

  test('쉰 자세는 모델 가운데가 원점이고 총열이 +x', () => {
    const verts = skin(revolver, [])
    const min = [0, 1, 2].map((k) => Math.min(...verts.map((v) => v[k])))
    const max = [0, 1, 2].map((k) => Math.max(...verts.map((v) => v[k])))
    for (let k = 0; k < 3; k++) expect(Math.abs(min[k] + max[k])).toBeLessThan(0.001)
    expect(max[0] - min[0]).toBeGreaterThan(max[1] - min[1])
  })

  test('장전을 마치면 쉰 자세로 돌아옴', () => {
    const rest = skin(revolver, [])
    const done = skin(revolver, [{ clip: 'Reload', t: revolver.clips.Reload.duration }])
    done.forEach((v, i) => v.forEach((x, k) => expect(x).toBeCloseTo(rest[i][k], 3)))
  })
})
