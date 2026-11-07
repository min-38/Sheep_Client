// Wavefront OBJ·MTL 중 단색 로우폴리 모델에 쓰는 줄만 읽음. 텍스처 좌표와 법선은 버리고 법선은 그릴 때 면에서 구함

export type RGB = readonly [number, number, number]
export type Vec3 = [number, number, number]
export type Mesh = { vertices: Vec3[]; faces: { v: number[]; color: RGB }[] }

// 재질 이름 → 화면 색. Kd는 선형 0..1이라 감마를 씌워 0..255로 바꿈
export function parseMtl(text: string): Map<string, RGB> {
  const materials = new Map<string, RGB>()
  let name = ''
  for (const line of text.split('\n')) {
    const [key, ...rest] = line.trim().split(/\s+/)
    if (key === 'newmtl') name = rest[0]
    else if (key === 'Kd') {
      const [r, g, b] = rest.map((c) => Math.round(255 * Number(c) ** (1 / 2.2)))
      materials.set(name, [r, g, b])
    }
  }
  return materials
}

// v, usemtl, f만 읽음. f의 `a/b/c`에서 첫 번호(1부터)만 써서 0부터로 바꿈. n각형은 그대로 둠
export function parseObj(text: string, materials: Map<string, RGB>): Mesh {
  const vertices: Vec3[] = []
  const faces: Mesh['faces'] = []
  // ponytail: MTL에 없는 재질은 회색. 모델을 바꿀 때 obj.test.ts의 실제 파일 테스트가 잡아 줌
  let color: RGB = [128, 128, 128]
  for (const line of text.split('\n')) {
    const [key, ...rest] = line.trim().split(/\s+/)
    if (key === 'v') {
      const [x, y, z] = rest.map(Number)
      vertices.push([x, y, z])
    } else if (key === 'usemtl') color = materials.get(rest[0]) ?? [128, 128, 128]
    else if (key === 'f') faces.push({ v: rest.map((r) => Number(r.split('/')[0]) - 1), color })
  }
  return { vertices, faces }
}
