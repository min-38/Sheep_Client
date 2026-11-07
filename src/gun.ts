import type { Mesh, RGB, Vec3 } from './obj.ts'

// 1인칭 리볼버를 Canvas 2D 경로로 직접 그림. 먼 면부터 칠하는 화가 알고리즘 (기술 설계서 렌더링 무기)

// yaw·pitch는 팔 흔들림(sway.ts, 라디안). kick은 반동이고 쏜 순간 1에서 RECOIL_MS 동안 0으로 줄어듦
export type GunPose = { yaw: number; pitch: number; kick: number }

// ms. ponytail: 임시 값. 플레이해 보며 정함
export const RECOIL_MS = 150
// 눈 좌표(x 오른쪽, y 위, z 앞)에서 총 가운데가 놓일 자리. ponytail: 임시 값. 화면을 보며 맞춤
export const GUN_POS: Vec3 = [0.3, -0.24, 0.75]
// 모델 한 단위의 눈 좌표 길이. 리볼버 모델은 길이가 약 2임
const SCALE = 0.25
// 반동 때 총구를 드는 각도(라디안)와 뒤로 빼는 거리
const KICK_PITCH = 0.4
const KICK_BACK = 0.08
// 빛이 오는 쪽(왼쪽 위 앞)과 등진 면에도 남는 밝기
const LIGHT = unit([-0.4, 1, -0.5])
const AMBIENT = 0.45
// 모델 색(MTL) 그대로는 밝은 하늘 앞에서 거의 검게 보여 전체를 밝힘. ponytail: 임시 값. 화면을 보며 맞춤
const EXPOSURE = 1.8
// 눈에 이보다 가까운 면은 투영이 터져서 그리지 않음
const NEAR = 0.05
// 모델 +x 끝에서 이 안의 꼭짓점을 총구로 봄
const TIP = 0.02

function unit([x, y, z]: Vec3): Vec3 {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const mean = (vs: Vec3[]): Vec3 => [0, 1, 2].map((k) => vs.reduce((s, v) => s + v[k], 0) / vs.length) as Vec3

// 모델 → 눈 좌표. 꼭짓점 평균을 중심으로 돌린 뒤 GUN_POS로 옮김
export function transform(mesh: Mesh, pose: GunPose): Vec3[] {
  const [cx, cy, cz] = mean(mesh.vertices)
  const up = pose.pitch + pose.kick * KICK_PITCH
  const cosUp = Math.cos(up)
  const sinUp = Math.sin(up)
  const cosYaw = Math.cos(pose.yaw)
  const sinYaw = Math.sin(pose.yaw)
  return mesh.vertices.map(([mx, my, mz]) => {
    // 모델은 총열이 +x, 위가 +y인 오른손 좌표. 눈 좌표는 왼손이라 x와 z를 맞바꾸면 모양이 거울에 비친 듯 뒤집히지 않음
    const x = (mz - cz) * SCALE
    const y = (my - cy) * SCALE
    const z = (mx - cx) * SCALE
    // 총구를 위로 든 뒤(x축) 오른쪽으로 돌림(y축)
    const y1 = y * cosUp + z * sinUp
    const z1 = z * cosUp - y * sinUp
    return [
      x * cosYaw + z1 * sinYaw + GUN_POS[0],
      y1 + GUN_POS[1],
      z1 * cosYaw - x * sinYaw + GUN_POS[2] - pose.kick * KICK_BACK,
    ]
  })
}

// 면의 바깥쪽 단위 법선(Newell 방법, n각형도 됨). 모델의 반시계 감김이 x·z를 맞바꾼 눈 좌표에서는 시계 방향이라 부호를 뒤집음
export function faceNormal(verts: Vec3[], v: number[]): Vec3 {
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < v.length; i++) {
    const [x1, y1, z1] = verts[v[i]]
    const [x2, y2, z2] = verts[v[(i + 1) % v.length]]
    nx += (y1 - y2) * (z1 + z2)
    ny += (z1 - z2) * (x1 + x2)
    nz += (x1 - x2) * (y1 + y2)
  }
  return unit([-nx, -ny, -nz])
}

// 면 번호를 평균 z가 큰(먼) 것부터
export function paintOrder(verts: Vec3[], faces: Mesh['faces']): number[] {
  const depth = faces.map((f) => f.v.reduce((s, i) => s + verts[i][2], 0) / f.v.length)
  return faces.map((_, i) => i).sort((a, b) => depth[b] - depth[a])
}

// 고정된 빛의 램버트 명암 + 주변광
export function shade(color: RGB, normal: Vec3): RGB {
  const light = EXPOSURE * (AMBIENT + (1 - AMBIENT) * Math.max(0, dot(normal, LIGHT)))
  const c = (k: number) => Math.min(255, Math.round(color[k] * light))
  return [c(0), c(1), c(2)]
}

// putImageData 뒤에 부름. 발사 불꽃을 옮길 총구의 화면 자리(내부 해상도 px)를 돌려줌
export function drawGun(ctx: CanvasRenderingContext2D, mesh: Mesh, pose: GunPose, w: number, h: number, proj: number): { x: number; y: number } {
  const verts = transform(mesh, pose)
  const toScreen = ([x, y, z]: Vec3) => ({ x: w / 2 + (proj * x) / z, y: h / 2 - (proj * y) / z })
  const screen = verts.map(toScreen)
  ctx.lineWidth = 1
  ctx.lineJoin = 'round'
  for (const i of paintOrder(verts, mesh.faces)) {
    const f = mesh.faces[i]
    if (f.v.some((k) => verts[k][2] < NEAR)) continue
    // 눈을 등진 면은 앞면에 가려지므로 칠하지 않음. 칠할 면이 반으로 줄고 화가 알고리즘이 틀릴 일도 줄어듦
    const normal = faceNormal(verts, f.v)
    if (dot(normal, verts[f.v[0]]) >= 0) continue
    const [r, g, b] = shade(f.color, normal)
    ctx.fillStyle = ctx.strokeStyle = `rgb(${r} ${g} ${b})`
    ctx.beginPath()
    for (const k of f.v) ctx.lineTo(screen[k].x, screen[k].y)
    ctx.closePath()
    ctx.fill()
    // 같은 색 테두리로 이웃한 면 사이에 바탕이 비치는 틈을 메움
    ctx.stroke()
  }
  const maxX = Math.max(...mesh.vertices.map((v) => v[0]))
  const tip = verts.filter((_, i) => mesh.vertices[i][0] > maxX - TIP)
  return toScreen(mean(tip))
}
