import { describe, expect, test } from 'vitest'
import mtlText from './assets/revolver.mtl?raw'
import objText from './assets/revolver.obj?raw'
import { parseMtl, parseObj } from './obj.ts'

describe('parseMtl', () => {
  test('선형 Kd를 화면 색(0..255)으로 바꿈', () => {
    expect(parseMtl('newmtl Wood\nKd 0.5 0.5 0.5\n').get('Wood')).toEqual([186, 186, 186])
  })

  test('재질마다 따로 읽음', () => {
    const m = parseMtl('newmtl A\nNs 96\nKd 1 0 0\n\nnewmtl B\nKd 0 0 1\n')
    expect(m.get('A')).toEqual([255, 0, 0])
    expect(m.get('B')).toEqual([0, 0, 255])
  })
})

describe('parseObj', () => {
  const wood = [10, 20, 30] as const
  const text = [
    '# 주석',
    'mtllib x.mtl',
    'v 0 0 0',
    'v 1 0 0',
    'vt 0.5 0.5',
    'v 1 1 0',
    'v 0 1 0',
    'vn 0 0 1',
    'usemtl Wood',
    's off',
    'f 1/1/1 2/2/1 3/3/1 4/4/1',
  ].join('\n')

  test('v, usemtl, f만 읽고 f는 첫 번호를 0부터로 바꿈', () => {
    const mesh = parseObj(text, new Map([['Wood', wood]]))
    expect(mesh.vertices).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ])
    expect(mesh.faces).toEqual([{ v: [0, 1, 2, 3], color: wood }])
  })

  test('실제 리볼버 파일: 모든 면이 MTL의 색을 받고 꼭짓점을 가리킴', () => {
    const materials = parseMtl(mtlText)
    const mesh = parseObj(objText, materials)
    const colors = new Set(materials.values())
    expect(mesh.faces.length).toBeGreaterThan(100)
    for (const f of mesh.faces) {
      expect(colors.has(f.color)).toBe(true)
      expect(f.v.length).toBeGreaterThanOrEqual(3)
      for (const i of f.v) expect(mesh.vertices[i]).toBeDefined()
    }
  })
})
