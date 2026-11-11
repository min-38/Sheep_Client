import { dueling, type Schedule } from './round.ts'
import { skin, type Mesh, type Play, type RGB, type Rig, type Vec3 } from './rig.ts'

// 1인칭 리볼버를 Canvas 2D 경로로 직접 그림. 먼 면부터 칠하는 화가 알고리즘 (기술 설계서 렌더링 무기)

// yaw·pitch는 팔 흔들림(sway.ts, 라디안). kick은 반동이고 쏜 순간 1에서 RECOIL_MS 동안 0으로 줄어듦.
// lower는 총을 내린 정도(0 듦 ~ 1 화면 아래로 다 내림). 음수면 겨누는 자리보다 높이 듦.
// shift는 GUN_POS에서 더 옮긴 자리(눈 좌표, x는 총 든 손 쪽이 +). 자살할 때 총을 옆머리로 가져감 (SHEEP-190)
export type GunPose = { yaw: number; pitch: number; kick: number; lower: number; shift?: Vec3 }

// ms. ponytail: 임시 값. 플레이해 보며 정함
export const RECOIL_MS = 150
// ms. 장전하려고 카운트다운에 총을 다 들어 올리기까지. ponytail: 임시 값. 플레이해 보며 정함
export const RAISE_MS = 200
// ms. D 키로 총을 뽑아 다 들기까지. 다 들면 공이치기를 당기고 그때부터 쏠 수 있음. 서버 Revolver.DrawDuration과 같아야 함 (사용자 결정 2026-11-10, SHEEP-123)
export const DRAW_MS = 350
// 조준점은 총을 다 뽑아 쏠 수 있을 때부터 보임 (사용자 결정 2026-11-11, SHEEP-165). drawnAt은 뽑기 시작한 시각이고 now와 같은 시계
export const aimed = (drawnAt: number | null, now: number) => drawnAt !== null && now >= drawnAt + DRAW_MS
// 공이치기를 당길 때 튀는 크기(쏠 때 반동을 1로). ponytail: 임시 값. 화면을 보며 맞춤
const COCK_KICK = 0.25
// ms. 카운트다운부터 장전 클립을 시작하기까지. 그 사이에 총을 들어 올림. ponytail: 임시 값. 플레이해 보며 정함
export const RELOAD_AT = 300
// 초. Reload 클립에서 총알이 칸에 다 들어간 때와 실린더가 다 닫힌 때. 장전 소리와 실린더 닫는 소리의 딸깍을 여기에 맞춤
export const RELOAD_SEATED = 0.833
export const RELOAD_SHUT = 1.042
// 초. Reload·Cock 클립 길이(revolver-rig.json). 클립을 다시 뽑으면 gun.test.ts가 어긋남을 잡음
const RELOAD_LENGTH = 1.167
const COCK_LENGTH = 0.125
// ms. 장전하는 시간. Reload 클립(약 1.2초)을 이 시간에 걸쳐 느리게 틀어 한 발 넣는 모습이 보임 (사용자 결정 2026-11-10, SHEEP-121)
export const RELOAD_MS = 2500
// ms. 장전을 마치고 총을 내려 권총집에 넣기까지. ponytail: 임시 값. 플레이해 보며 정함
export const HOLSTER_MS = 500
// ms. 카운트다운부터 장전하고 권총집에 다 넣기까지. 카운트다운(4초) 안에 끝나야 함
export const RELOAD_END = RELOAD_AT + RELOAD_MS + HOLSTER_MS
// 라디안. 장전하는 동안 총을 보려고 고개를 숙이는 각도와, 카운트다운부터 다 숙이기까지(ms). 다 넣으면 권총집에 넣는 동안(HOLSTER_MS) 다시 듦.
// 서두르지 않게 장전 클립 시작(RELOAD_AT)보다 늦게 다 숙임 (사용자 결정 2026-11-11, SHEEP-177). ponytail: 임시 값. 화면을 보며 맞춤
const NOD = 0.32
const NOD_IN_MS = 900
// 라디안. 1인칭 시선은 약 7°만 숙임. 화면은 위아래 시선을 그림을 밀어 보여 줘(y-shearing) 18°면 화면이 30% 밀려 떨어지듯 보임.
// 총은 장전할 때 높이 들어 화면에 보여, 실제 총잡이처럼 눈을 조금만 내리면 됨 (사용자 결정 2026-11-11, SHEEP-191 (가))
export const VIEW_NOD = 0.12

// 카운트다운부터 since(ms) 지난 때 고개를 숙인 각도(라디안, 아래가 +). depth는 다 숙인 각도로 남이 보는 머리는 NOD,
// 1인칭 시선은 VIEW_NOD. 서버는 카운트다운 동안 시선을 정면으로 두므로 그림에서만 숙임
export function reloadNod(since: number, depth = NOD): number {
  if (since <= 0 || since >= RELOAD_END) return 0
  const smooth = (k: number) => {
    const u = Math.min(1, Math.max(0, k))
    return u * u * (3 - 2 * u)
  }
  return depth * smooth(since / NOD_IN_MS) * (1 - smooth((since - RELOAD_AT - RELOAD_MS) / HOLSTER_MS))
}

// 카운트다운부터 since(ms) 지난 때의 Reload 클립 시각(초). 장전 중이 아니면 null
export const reloadTime = (since: number): number | null => {
  const t = ((since - RELOAD_AT) / RELOAD_MS) * RELOAD_LENGTH
  return t >= 0 && t <= RELOAD_LENGTH ? t : null
}

// Reload 클립 시각 clip(초)이 오는 때. 카운트다운부터 지난 ms. 장전 소리를 이때 예약함
export const reloadSoundAt = (clip: number) => RELOAD_AT + (clip / RELOAD_LENGTH) * RELOAD_MS
// 장전하는 동안 겨누는 자리보다 높이 드는 정도(LOWER_BY 배). 실린더가 왼쪽 아래로 열리고 총구도 숙여 그대로면 화면 밖으로 나감.
// ponytail: 임시 값. 화면을 보며 맞춤
const RELOAD_LIFT = 0.3
// 다 내린 총을 GUN_POS에서 내리는 거리(눈 좌표). 지금 모델은 흔들림이 가장 커도 약 0.24면 화면 아래로 다 숨어 여유를 둠
const LOWER_BY = 0.35
// 눈 좌표(x 오른쪽, y 위, z 앞)에서 모델 원점(총 가운데)이 놓일 자리. 오른쪽 아래 구석([0.275, -0.245, 0.75])은 몰입이 덜해
// 화면 가운데 쪽으로 옮김 (사용자 플레이테스트 2026-11-11, SHEEP-161). ponytail: 임시 값. 화면을 보며 맞춤
export const GUN_POS: Vec3 = [0.17, -0.2, 0.75]
// 모델 1m의 눈 좌표 길이. 리볼버 모델은 길이가 약 0.35m임
const SCALE = 1.3
// 반동 때 총구를 드는 각도(라디안)와 뒤로 빼는 거리
const KICK_PITCH = 0.4
const KICK_BACK = 0.08
// 빛이 오는 쪽(왼쪽 위 앞)과 등진 면에도 남는 밝기
const LIGHT = unit([-0.4, 1, -0.5])
const AMBIENT = 0.45
// 눈에 이보다 가까운 면은 투영이 터져서 그리지 않음
const NEAR = 0.05
// 모델 +x 끝에서 이 안(m)의 꼭짓점을 총구로 봄
const TIP = 0.003

function unit([x, y, z]: Vec3): Vec3 {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const mean = (vs: Vec3[]): Vec3 => [0, 1, 2].map((k) => vs.reduce((s, v) => s + v[k], 0) / vs.length) as Vec3

// 총을 든 손. 1은 오른손, -1은 왼손이고 모델과 GUN_POS를 좌우로 뒤집음 (컨셉 기획서 화면 1인칭 총)
export type Side = 1 | -1

// 모델 → 눈 좌표. 모델 원점을 중심으로 돌린 뒤 GUN_POS로 옮김. 꼭짓점 평균은 부품이 움직이면 같이 움직여 기준으로 쓰지 않음.
// 왼손은 돌리기 전에 뒤집어, 흔들림은 오른손처럼 조준점과 같은 쪽으로 돎
export function transform(mesh: Mesh, pose: GunPose, side: Side = 1): Vec3[] {
  const up = pose.pitch + pose.kick * KICK_PITCH
  const cosUp = Math.cos(up)
  const sinUp = Math.sin(up)
  const cosYaw = Math.cos(pose.yaw)
  const sinYaw = Math.sin(pose.yaw)
  return mesh.vertices.map(([mx, my, mz]) => {
    // 모델은 총열이 +x, 위가 +y인 오른손 좌표. 눈 좌표는 왼손이라 x와 z를 맞바꾸면 모양이 거울에 비친 듯 뒤집히지 않음
    const x = side * mz * SCALE
    const y = my * SCALE
    const z = mx * SCALE
    // 총구를 위로 든 뒤(x축) 오른쪽으로 돌림(y축)
    const y1 = y * cosUp + z * sinUp
    const z1 = z * cosUp - y * sinUp
    const [sx, sy, sz] = pose.shift ?? [0, 0, 0]
    return [
      x * cosYaw + z1 * sinYaw + side * (GUN_POS[0] + sx),
      y1 + GUN_POS[1] + sy - pose.lower * LOWER_BY,
      z1 * cosYaw - x * sinYaw + GUN_POS[2] + sz - pose.kick * KICK_BACK,
    ]
  })
}

// now(서버 시계)에 총을 내린 정도와 공이치기 반동. "시작!" 전과 판 사이에는 내려 두어 결투가 시작됐음을 화면으로도 알림.
// "시작!" 뒤 D 키로 뽑은 때(drawnAt, 서버 시계)부터 DRAW_MS 동안 처음에 빨리 들고(ease-out), 다 든 순간 공이치기 소리와 함께 작게 튐. 뽑기 전에는 내린 채 (SHEEP-123). 판 결과가 끝나 schedule을 비우면 다시 내림.
// reloading(이번 카운트다운에 내가 장전함)이면 카운트다운에도 같이 들되 RELOAD_LIFT만큼 더 높이 들어 장전하고, 장전 클립이 끝나면 HOLSTER_MS 동안 내려 권총집에 넣음(ease-in).
// held(재대결 카운트다운을 알려 온 때 총을 뽑아 들고 있었음)면 재대결 결과 동안 내리지 않고 든 채 두고, 장전도 겨누던 자리에서 더 높이 듦 (SHEEP-175)
export function lift(s: Schedule, now: number, reloading: boolean, drawnAt: number | null = null, held = false): { lower: number; kick: number } {
  if (dueling(s, now)) {
    // 뽑기 전에는 권총집에 넣은 채라 다 내림 (SHEEP-123)
    if (drawnAt === null || now < drawnAt) return { lower: 1, kick: 0 }
    const since = now - drawnAt
    if (since < DRAW_MS) return { lower: Math.max(0, 1 - since / DRAW_MS) ** 3, kick: 0 }
    return { lower: 0, kick: COCK_KICK * Math.max(0, 1 - (since - DRAW_MS) / RECOIL_MS) }
  }
  if (s.countdown === undefined || now < s.countdown) return { lower: held ? 0 : 1, kick: 0 }
  if (!reloading) return { lower: 1, kick: 0 }
  const since = now - s.countdown
  const after = since - RELOAD_AT - RELOAD_MS
  // 든 채면 lower 0(겨누던 자리)에서 시작하는 몫
  const from = held ? RELOAD_LIFT / (1 + RELOAD_LIFT) : 1
  const down = after < 0 ? raised(since) * from : Math.min(1, after / HOLSTER_MS) ** 3
  return { lower: down * (1 + RELOAD_LIFT) - RELOAD_LIFT, kick: 0 }
}

const raised = (since: number) => Math.max(0, 1 - since / RAISE_MS) ** 3

// 시간 초과로 자살할 때 1인칭 총 (SHEEP-190). 총구를 내 머리 쪽으로 돌리며(TEMPLE_YAW, 오른손이면 왼쪽으로) 조금 들고,
// 총을 총 든 손 쪽 옆머리 가까이(TEMPLE_SHIFT)로 가져가 화면 가장자리에 걸림. since는 자살 모습을 보이기 시작하고 지난 시간(ms)이고
// aim(character.ts SUICIDE_AIM) 동안 다 가져간 뒤 쏨. 뽑지 않았으면 앞 절반 동안 권총집에서 꺼내 올림. ponytail: 임시 값. 화면을 보며 맞춤
export const TEMPLE_YAW = -1.45
export const TEMPLE_PITCH = 0.25
export const TEMPLE_SHIFT: Vec3 = [0.12, 0.17, -0.25]
export function templeAim(since: number, aim: number, drawn: boolean): { yaw: number; pitch: number; lower: number; shift: Vec3 } {
  const k = Math.min(1, Math.max(0, since / aim))
  const u = k * k * (3 - 2 * k)
  return {
    yaw: TEMPLE_YAW * u,
    pitch: TEMPLE_PITCH * u,
    lower: drawn ? 0 : Math.max(0, 1 - 2 * k) ** 2,
    shift: [TEMPLE_SHIFT[0] * u, TEMPLE_SHIFT[1] * u, TEMPLE_SHIFT[2] * u],
  }
}

// now(서버 시계)에 총에 덮을 클립. 소리처럼 서버가 알린 단계 시각에서 재어 소리와 움직임이 맞음.
// 카운트다운에는 Reload(실린더를 열어 총알을 넣고 닫음), 뽑은 때(drawnAt)부터 DRAW_MS 동안 Cock(공이치기를 당김),
// 이번 결투에서 쏘면 Fire(공이치기가 떨어지고 실린더가 한 칸 돎). shotAt은 내가 마지막으로 쏜 시각(서버 시계, 안 쐈으면 -Infinity)
export function gunClips(s: Schedule, now: number, reloading: boolean, shotAt: number, drawnAt: number | null = null): Play[] {
  if (dueling(s, now)) {
    if (drawnAt === null || now < drawnAt) return []
    const cock = { clip: 'Cock', t: Math.min(1, (now - drawnAt) / DRAW_MS) * COCK_LENGTH }
    return shotAt >= s.duel! ? [cock, { clip: 'Fire', t: (now - shotAt) / 1000 }] : [cock]
  }
  const t = s.countdown === undefined ? null : reloadTime(now - s.countdown)
  // 클립 밖은 쉰 자세와 같아 덮지 않음. 그래야 닫힌 실린더 안의 총알도 그리지 않음 (revolverMesh)
  return reloading && t !== null ? [{ clip: 'Reload', t }] : []
}

// 클립을 덮은 지금 모양. 총알은 실린더를 여는 Reload 동안만, 남은 총알 수(rounds)만큼 쏘는 차례가 앞인 칸에 그림.
// 닫힌 실린더 안의 총알은 보이지 않아야 하는데 면 평균 깊이로 칠하면 몸통 위에 비침
export function revolverMesh(rig: Rig, plays: Play[], rounds: number): Mesh {
  const loading = plays.some((p) => p.clip === 'Reload')
  const faces: Mesh['faces'] = []
  rig.faces.forEach((v, i) => {
    const chamber = rig.joints[rig.weights[v[0]][0]].chamber
    if (chamber === undefined || (loading && chamber < rounds)) faces.push({ v, color: rig.colors[i] as RGB })
  })
  return { vertices: skin(rig, plays), faces }
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
  const light = AMBIENT + (1 - AMBIENT) * Math.max(0, dot(normal, LIGHT))
  const c = (k: number) => Math.min(255, Math.round(color[k] * light))
  return [c(0), c(1), c(2)]
}

// putImageData 뒤에 부름. 발사 불꽃을 옮길 총구의 화면 자리(내부 해상도 px)를 돌려줌
export function drawGun(ctx: CanvasRenderingContext2D, mesh: Mesh, pose: GunPose, w: number, h: number, proj: number, side: Side = 1): { x: number; y: number } {
  const verts = transform(mesh, pose, side)
  const toScreen = ([x, y, z]: Vec3) => ({ x: w / 2 + (proj * x) / z, y: h / 2 - (proj * y) / z })
  const screen = verts.map(toScreen)
  ctx.lineWidth = 1
  ctx.lineJoin = 'round'
  for (const i of paintOrder(verts, mesh.faces)) {
    const f = mesh.faces[i]
    if (f.v.some((k) => verts[k][2] < NEAR)) continue
    // 눈을 등진 면은 앞면에 가려지므로 칠하지 않음. 칠할 면이 반으로 줄고 화가 알고리즘이 틀릴 일도 줄어듦
    // 뒤집은 왼손 총은 감김도 뒤집혀 법선이 안쪽을 향하므로 되돌림
    const normal = faceNormal(verts, f.v).map((n) => side * n) as Vec3
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
