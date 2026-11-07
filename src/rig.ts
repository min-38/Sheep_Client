// 뼈대(skin)가 있는 모델을 클립 시각에 맞춰 움직임. glTF에서 쓰는 것만 뽑은 JSON(src/assets/revolver-rig.json)을 읽음.
// 렌더링 라이브러리 없이 직접 씀 (기술 설계서 기술 스택)

export type Vec3 = [number, number, number]
export type RGB = [number, number, number]
export type Mesh = { vertices: Vec3[]; faces: { v: number[]; color: RGB }[] }

// glTF 애니메이션 채널 하나. 회전 값은 사원수(x, y, z, w)
export type Channel = {
  joint: number
  path: 'translation' | 'rotation' | 'scale'
  interpolation: 'LINEAR' | 'STEP'
  times: number[]
  values: number[][]
}
export type Clip = { duration: number; channels: Channel[] }
// t·r·s는 쉰 자세에서 부모 기준 이동·회전·크기, ibm은 묶을 때 자세의 역행렬(열 우선 4×4). 부모가 늘 자식보다 앞에 옴.
// chamber는 총알 뼈가 든 실린더 칸(쏘는 차례, 0부터)
export type Joint = { name: string; parent: number; t: number[]; r: number[]; s: number[]; ibm: number[]; chamber?: number }
// vertices는 묶을 때 자리, weights는 꼭짓점마다 [뼈, 무게, 뼈, 무게 …], faces는 꼭짓점 번호 셋, colors는 면마다 텍스처에서 구운 RGB.
// JSON을 그대로 받게 튜플이 아닌 배열로 둠
export type Rig = { joints: Joint[]; vertices: number[][]; weights: number[][]; faces: number[][]; colors: number[][]; clips: Record<string, Clip> }
// 덮을 클립과 그 안의 시각(초)
export type Play = { clip: string; t: number }

// 사원수 a에서 b로 u(0~1)만큼. -b도 같은 회전이라 짧은 쪽으로 돌고, 거의 같으면 선형으로 섞어 0으로 나누지 않음
export function slerp(a: number[], b: number[], u: number): number[] {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  const sign = d < 0 ? -1 : 1
  const cos = d * sign
  if (cos > 0.9995) {
    const q = a.map((x, k) => x + (sign * b[k] - x) * u)
    const l = Math.hypot(...q)
    return q.map((x) => x / l)
  }
  const angle = Math.acos(cos)
  const wa = Math.sin((1 - u) * angle) / Math.sin(angle)
  const wb = (sign * Math.sin(u * angle)) / Math.sin(angle)
  return a.map((x, k) => wa * x + wb * b[k])
}

// t(초)의 채널 값. 첫 키 전과 끝 키 뒤는 끝값 그대로 (glTF 규칙)
export function sample(ch: Channel, t: number): number[] {
  const next = ch.times.findIndex((x) => x > t)
  if (next === 0) return ch.values[0]
  if (next < 0) return ch.values[ch.values.length - 1]
  const a = ch.values[next - 1]
  const b = ch.values[next]
  if (ch.interpolation === 'STEP') return a
  const u = (t - ch.times[next - 1]) / (ch.times[next] - ch.times[next - 1])
  return ch.path === 'rotation' ? slerp(a, b, u) : a.map((x, k) => x + (b[k] - x) * u)
}

// 쉰 자세에 plays를 차례로 덮은 꼭짓점 자리. 뒤의 클립이 같은 채널을 덮음
export function skin(rig: Rig, plays: Play[]): Vec3[] {
  const trs = rig.joints.map((j) => ({ translation: j.t, rotation: j.r, scale: j.s }))
  for (const p of plays) for (const ch of rig.clips[p.clip].channels) trs[ch.joint][ch.path] = sample(ch, p.t)
  // 뼈마다 부모까지 쌓은 행렬 × 묶을 때 역행렬. 묶을 때 자리의 꼭짓점을 지금 뼈 자리로 옮김
  const world: number[][] = []
  const bones = rig.joints.map((j, i) => {
    const local = compose(trs[i].translation, trs[i].rotation, trs[i].scale)
    world[i] = j.parent < 0 ? local : multiply(world[j.parent], local)
    return multiply(world[i], j.ibm)
  })
  return rig.vertices.map(([x, y, z], i) => {
    const out: Vec3 = [0, 0, 0]
    const w = rig.weights[i]
    for (let k = 0; k < w.length; k += 2) {
      const m = bones[w[k]]
      for (let c = 0; c < 3; c++) out[c] += w[k + 1] * (m[c] * x + m[4 + c] * y + m[8 + c] * z + m[12 + c])
    }
    return out
  })
}

// 이동 × 회전 × 크기 (열 우선)
function compose([tx, ty, tz]: number[], [x, y, z, w]: number[], [sx, sy, sz]: number[]): number[] {
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ]
}

// 열 우선 4×4 a × b
function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return out
}
