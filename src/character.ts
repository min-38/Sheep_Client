import belle from './assets/characters/belle.json'
import charles from './assets/characters/charles.json'
import clayton from './assets/characters/clayton.json'
import diego from './assets/characters/diego.json'
import jesse from './assets/characters/jesse.json'
import kate from './assets/characters/kate.json'
import rosa from './assets/characters/rosa.json'
import silas from './assets/characters/silas.json'
import motionData from './assets/motions.json'
import revolverData from './assets/revolver-rig.json'
import { DRAW_MS, HOLSTER_MS, RELOAD_AT, RELOAD_END, RELOAD_MS, reloadTime, revolverMesh } from './gun.ts'
import { HEAD } from './hitcard.ts'
import { horizonY, pack, tint, type Camera } from './render.ts'
import { slerp, type Mesh, type Rig } from './rig.ts'
import { ROUNDS } from './revolver.ts'
import { BANDANA } from './roomlist.ts'
import { STEP_MS, TURN_MS } from './round.ts'
import type { Hand } from './settings.ts'

// 블록 캐릭터 (컨셉 기획서 아트 캐릭터 그림). 캐릭터마다 상자 목록 JSON(src/assets/characters/) 하나를 읽고, 관절을 돌려 동작을 만들어
// 매 프레임 그 자리와 각도에서 3D로 그림. 모든 캐릭터가 같은 7.5등신 틀을 씀 (시스템 기획서 캐릭터).
// 모델 좌표는 블록 단위이고 x는 그 사람의 오른쪽, y는 위, z는 앞. 원점은 두 발 사이 바닥

type V = readonly [number, number, number]
type RGB = readonly [number, number, number]
// 상자 하나. c는 가운데, axes는 세 변의 방향(단위 벡터), half는 그 방향의 반 길이
export type Box = { c: V; axes: readonly [V, V, V]; half: V; rgb: RGB }
// 동작 하나의 모습. gun은 리볼버 모델(revolver-rig.json) 꼭짓점을 모델 좌표로 옮긴 것이고, 면은 모델 그대로 (기술 설계서 렌더링 캐릭터).
// muzzle은 겨누거나 쏠 때의 총구 자리(모델 좌표). 연기가 여기서 나옴 (SHEEP-124)
// faces는 총의 면. 없으면 쉰 자세의 면이고, 장전하는 동안은 실린더 칸의 총알까지 든 면 (SHEEP-121)
export type Pose = { boxes: Box[]; gun: readonly V[]; muzzle?: V; faces?: Mesh['faces'] }

// 동작별 모습. rest는 틀 그대로 선 모습. stand, walk, fall은 사람 동작 데이터(motions.json)로 그 동작을 시작하고 지난 시간(ms)의 모습을
// 그때그때 만듦(stand는 되풀이라 아무 시각이나 됨). aim과 fire는 위아래 시선(라디안, 위가 +)으로 만들고, suicide는 [총을 머리에 댐, 불꽃] 두 단계
export type Body = {
  rest: Pose
  stand: (ms: number) => Pose
  walk: (ms: number) => Pose
  // 카운트다운부터 ms 지난 모습 (SHEEP-121). 권총집에서 총을 꺼내 배 앞에 들고 다른 손으로 한 발 넣은 뒤 권총집에 다시 넣음. RELOAD_END부터는 rest와 같음
  reload: (ms: number) => Pose
  // 걷기 시각에 제자리에서 뒤도는 동안(round.ts TURN_MS) 발을 번갈아 조금 떼었다 놓는 모습. 몸 방향은 서버 각도대로 돌고 이건 팔다리만 (SHEEP-120)
  turn: (ms: number) => Pose
  aim: (pitch: number) => Pose
  // D 키로 뽑기 시작하고 ms 지난 모습 (SHEEP-123). 권총집 옆으로 내린 팔에서 DRAW_MS 동안 겨눈 모습으로 듦. 그 뒤로는 aim과 같음
  draw: (ms: number, pitch: number) => Pose
  fire: (pitch: number) => Pose
  suicide: Pose[]
  // drop이면 바닥에 닿을 때 총을 놓쳐 손 옆 모래 위에 눕힘(맞아 쓰러짐). 아니면 누운 뒤에도 쥠(자살) (사용자 결정 2026-11-10, SHEEP-119)
  fall: (ms: number, drop?: boolean) => Pose
  // 술집 바 의자에 앉은 모습. 엉덩이가 서 있을 때 높이(16블록) 그대로이고, 허벅지는 앞으로 눕고 아래팔은 카운터 위에 얹음 (SHEEP-115)
  sit: Pose
}

// 캐릭터 JSON. part는 head, body, rightArm, leftArm, rightLeg, leftLeg 중 하나. 색은 상자마다 단색 하나이고 명암은 그릴 때 넣음.
// key는 핵심 파츠(사람이 색을 고를 수 있는 곳, SHEEP-118)의 상자에만 true로 둠 (시스템 기획서 캐릭터 핵심 파츠)
export type CharacterData = { name: string; boxes: { part: string; from: number[]; to: number[]; color: string; key?: boolean }[] }
// 캐릭터 번호(메시지의 character) 순서 (시스템 기획서 캐릭터 목록)
export const CHARACTERS: readonly CharacterData[] = [charles, rosa, silas, belle, clayton, jesse, kate, diego]
// 브라우저에 기억한 번호. 없거나 0 이상 count 미만 정수가 아니면 null
function savedIndex(raw: string | null, count: number): number | null {
  const n = Number(raw)
  return raw !== null && raw !== '' && Number.isInteger(n) && n >= 0 && n < count ? n : null
}

// 브라우저에 기억한 캐릭터 번호. 없거나 지금 캐릭터 번호가 아니면 처음 캐릭터 0 (시스템 기획서 캐릭터 고르기)
export const savedCharacter = (raw: string | null): number => savedIndex(raw, CHARACTERS.length) ?? 0

// 브라우저에 기억한 사람 색 번호. 없거나 틀리면 null이고, 그때는 보내지 않아 서버가 들어온 순서로 줌 (기술 설계서 메시지 joinRoom color)
export const savedColor = (raw: string | null): number | null => savedIndex(raw, BANDANA.length)

// 사람 색 번호 1(하늘)을 몸통 핵심 파츠에 칠할 때 대신 쓰는 짙은 파랑. 몸통이 하늘과 비슷하면 덜 보여 불리함 (시스템 기획서 캐릭터 색, SHEEP-118)
const SKY = 1
const SKY_ON_BODY = '#2a6ab8'

// 핵심 파츠가 몸통(셔츠, 조끼, 코트, 판초)인지. 목수건(높이 23.6 위)과 모자는 아님
const torsoKey = (data: CharacterData) => data.boxes.some((b) => b.key && b.part === 'body' && b.from[1] < 20)

// 사람 색 번호 color를 그 캐릭터의 핵심 파츠에 칠할 색 (시스템 기획서 캐릭터 핵심 파츠)
export const keyColor = (character: number, color: number) => (color === SKY && torsoKey(CHARACTERS[character]) ? SKY_ON_BODY : BANDANA[color])

// 블록. 머리 상자 가운데 이 높이부터 위는 모자임 (7.5등신 틀의 머리 위 30블록 바로 아래)
const HAT_FROM = 29.3

// 1인칭 화면 위에 보이는 내 모자 챙 (SHEEP-159). 모자 상자 가운데 얼굴(머리 앞면)보다 가장 멀리 앞으로 나온 것의 색과 나온 길이(블록).
// 챙이 앞으로 많이 나올수록 눈 위로 크게 보임. 핵심 파츠면 사람 색으로 칠함. 모자가 없거나 얼굴보다 거의 나오지 않으면 null
export function brimOf(character: number, color?: number): { color: string; overhang: number } | null {
  const head = CHARACTERS[character].boxes.filter((b) => b.part === 'head')
  const face = Math.max(...head.filter((b) => b.from[1] <= NECK[1]).map((b) => b.to[2]))
  const hat = head.filter((b) => b.from[1] >= HAT_FROM)
  if (hat.length === 0) return null
  const front = hat.reduce((a, b) => (b.to[2] > a.to[2] ? b : a))
  const overhang = front.to[2] - face
  if (overhang < 0.2) return null
  return { color: front.key && color !== undefined ? keyColor(character, color) : front.color, overhang }
}

// ms. 시간 초과로 쓰러진 사람이 총을 머리에 대고 있는 시간과 그 뒤 불꽃 시간. 그다음엔 쓰러진 그림.
// ponytail: 임시 값(시스템 기획서 판 흐름 시간). 플레이해 보며 정함
export const SUICIDE_AIM = 600
export const SUICIDE_FLASH = 100

// 시간 초과로 쓰러진 뒤 지난 시간(ms)으로 고른 자살 단계. 0은 총을 댐, 1은 불꽃, null은 다 끝나 쓰러진 그림
export const suicideStage = (elapsed: number): 0 | 1 | null => (elapsed < SUICIDE_AIM ? 0 : elapsed < SUICIDE_AIM + SUICIDE_FLASH ? 1 : null)

const FLASH: RGB = [255, 232, 128]

// 키(블록, 모자를 뺀 머리 위까지). 키가 판정 머리 위(HEAD.top)와 같아 1블록이 0.03칸 (시스템 기획서 캐릭터 틀)
const TALL = 30
export const CELL = HEAD.top / TALL
// 이보다 가까운 면은 그리지 않음 (sprite.ts의 NEAR와 같음)
const NEAR = 0.05
// 관절 높이(블록, 시스템 기획서 캐릭터 틀). 팔은 팔꿈치, 다리는 무릎 높이에서 상자가 나뉨
const SHOULDER = 24
const ELBOW = 18
const HIP = 16
const KNEE = 8
// 주먹 가운데 높이. 총 손잡이를 여기에 쥠
const FIST = 12.75
// 머리 밑. 위아래를 볼 때 머리가 여기를 축으로 돎
const NECK: V = [0, 26, 0]
// 라디안. 쏠 때 반동으로 팔이 들리는 각도. ponytail: 임시 값. 플레이해 보며 정함
const RECOIL = 0.5
// 리볼버 모델 1m의 길이(블록). 키 1.8m 사람이면 약 16.7인데, 총 두께(0.05m)가 권총집(0.75블록)에 들게 조금 줄임
const GUN_SCALE = 14
// 모델 좌표(m)의 손잡이 가운데와 총구. 손잡이 뼈(DEF_RevolverHandle) 언저리와 총열 끝 꼭짓점의 평균
const GRIP: V = [-0.13, -0.035, 0]
const MUZZLE: V = [0.1723, 0.0664, 0]
// 권총집에 꽂힌 총의 손잡이 자리. 총구가 아래, 총 위가 앞을 보고 총열이 허벅지 권총집(x 2.75~3.5, y 8.5~12) 안에 듦.
// 손잡이는 뒤 위로 나와 내린 손 바로 뒤에 옴. ponytail: 화면을 보며 맞춘 값
const HOLSTER_GRIP: V = [3.125, 13.1, -1.1]
// 자살할 때 총구를 대는 오른쪽 관자놀이. 머리 오른쪽 면(x 1.5)의 눈 위 앞쪽
const TEMPLE: V = [1.55, 28.6, 0.8]
// 오른 허벅지 바깥의 권총집 상자. 모든 캐릭터가 같은 자리에 하나씩 둠
const isHolster = (b: CharacterData['boxes'][number]) => b.part === 'rightLeg' && `${b.from}` === '2.75,8.5,-1' && `${b.to}` === '3.5,12,1'
// 왼손잡이(총을 든 손이 왼손)의 캐릭터. 권총집 상자만 왼 허벅지로 거울처럼 옮기고 옷 장식은 그대로 둠 (SHEEP-133)
const leftHolstered = (data: CharacterData): CharacterData => ({
  ...data,
  boxes: data.boxes.map((b) => (isHolster(b) ? { ...b, part: 'leftLeg', from: [-b.to[0], b.from[1], b.from[2]], to: [-b.from[0], b.to[1], b.to[2]] } : b)),
})

const X: V = [1, 0, 0]
const Y: V = [0, 1, 0]
const Z: V = [0, 0, 1]
const DOWN: V = [0, -1, 0]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const sub = (a: V, b: V) => add(a, b, -1)
const unit = (a: V): V => add([0, 0, 0], a, 1 / Math.hypot(...a))
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
// a에서 d에 나란한 부분을 뺀 방향
const across = (a: V, d: V) => unit(add(a, d, -dot(a, d)))

// 앞을 보다 위(+)아래로 a만큼 든 방향
const ahead = (a: number): V => [0, Math.sin(a), Math.cos(a)]

type Turn = (v: V) => V
// 아래(-y)를 d로 돌리는 가장 작은 회전. 팔다리를 그쪽으로 뻗음
function toward(d: V): Turn {
  const axis = cross(DOWN, d)
  const sin = Math.hypot(...axis)
  const cos = dot(DOWN, d)
  if (sin < 1e-9) return cos > 0 ? (v) => v : (v) => [v[0], -v[1], -v[2]]
  const k = add([0, 0, 0], axis, 1 / sin)
  return (v) => add(add(add([0, 0, 0], v, cos), cross(k, v), sin), k, dot(k, v) * (1 - cos))
}
// x축으로 위(+)아래로 a만큼 끄덕임. 앞(z)이 위(y)로 들림
const nod =
  (a: number): Turn =>
  (v) => [v[0], v[1] * Math.cos(a) + v[2] * Math.sin(a), v[2] * Math.cos(a) - v[1] * Math.sin(a)]

// 몸의 한 덩어리를 옮기는 법. 쉴 때 자리 from을 축으로 turn만큼 돌려 to에 둠
type Move = { from: V; to: V; turn: Turn }
const still: Move = { from: [0, 0, 0], to: [0, 0, 0], turn: (v) => v }
const moveBox = (b: Box, m: Move): Box => ({ ...b, c: add(m.to, m.turn(sub(b.c, m.from))), axes: [m.turn(b.axes[0]), m.turn(b.axes[1]), m.turn(b.axes[2])] })
const movePoint = (p: V, m: Move): V => add(m.to, m.turn(sub(p, m.from)))

// 팔이나 다리 하나. root(어깨, 엉덩이)에서 dirs[0]으로 뻗은 위쪽과, mid 높이 관절(팔꿈치, 무릎)에서 dirs[1]로 뻗은 아래쪽
function limb(root: V, mid: number, dirs: readonly [V, V]): [Move, Move] {
  const joint: V = [root[0], mid, root[2]]
  return [
    { from: root, to: root, turn: toward(dirs[0]) },
    { from: joint, to: add(root, dirs[0], root[1] - mid), turn: toward(dirs[1]) },
  ]
}

// 관절마다 뻗은 방향. [위팔·허벅지, 아래팔·정강이]. look은 머리를 드는 각도
type Joints = { look: number; rightArm: readonly [V, V]; leftArm: readonly [V, V]; rightLeg: readonly [V, V]; leftLeg: readonly [V, V] }
const hanging: readonly [V, V] = [DOWN, DOWN]
const rest: Joints = { look: 0, rightArm: hanging, leftArm: hanging, rightLeg: hanging, leftLeg: hanging }
// 앉은 자세. 허벅지는 앞으로, 정강이는 아래로. 위팔은 아래에서 앞으로 0.5라디안, 아래팔은 거의 수평으로 앞을 봄.
// ponytail: 화면을 보며 정한 값. 사람 동작 데이터에 앉기를 구우면 그것으로 바꿈
const seatedLeg: readonly [V, V] = [Z, DOWN]
const seatedArm: readonly [V, V] = [ahead(0.5 - Math.PI / 2), ahead(1.5 - Math.PI / 2)]
const seated: Joints = { look: 0, rightArm: seatedArm, leftArm: seatedArm, rightLeg: seatedLeg, leftLeg: seatedLeg }

// 덩어리 이름. 팔다리는 관절 높이 위아래로 나눔
type Seg = 'head' | 'body' | 'rightArm0' | 'rightArm1' | 'leftArm0' | 'leftArm1' | 'rightLeg0' | 'rightLeg1' | 'leftLeg0' | 'leftLeg1'

function moves(j: Joints): Record<Seg, Move> {
  const [rightArm0, rightArm1] = limb([4, SHOULDER, 0], ELBOW, j.rightArm)
  const [leftArm0, leftArm1] = limb([-4, SHOULDER, 0], ELBOW, j.leftArm)
  const [rightLeg0, rightLeg1] = limb([1.5, HIP, 0], KNEE, j.rightLeg)
  const [leftLeg0, leftLeg1] = limb([-1.5, HIP, 0], KNEE, j.leftLeg)
  return { head: { from: NECK, to: NECK, turn: nod(j.look) }, body: still, rightArm0, rightArm1, leftArm0, leftArm1, rightLeg0, rightLeg1, leftLeg0, leftLeg1 }
}

// 사람 동작 데이터. blend/motions.py가 Quaternius Universal Animation Library(CC0)의 동작을 이 틀의 관절에 옮겨 구움 (SHEEP-100).
// 동작마다 프레임별 엉덩이 이동(블록)과, segments 순서로 이어 붙인 덩어리 회전 사원수(x, y, z, w). loop가 아니면 끝 프레임에 멈춤
type Motion = { loop: boolean; hip: number[][]; rot: number[][] }
const MOTIONS = motionData as { fps: number; segments: string[]; clips: Record<'stand' | 'walk' | 'fall', Motion> }

// 사원수 (x, y, z, w)만큼 돌림
function rotation([x, y, z, w]: readonly number[]): Turn {
  const q: V = [x, y, z]
  return (v) => {
    const t = add([0, 0, 0], cross(q, v), 2)
    return add(add(v, t, w), cross(q, t))
  }
}

// 덩어리 → [축 관절의 쉬는 자리, 그 관절이 붙은 덩어리]. 부모가 늘 앞에 옴. 몸은 엉덩이 가운데가 축이고 팔다리와 머리가 몸에 붙음 (blend/motions.py와 같은 식)
const CHAIN: readonly [Seg, V, Seg | null][] = [
  ['body', [0, HIP, 0], null],
  ['head', NECK, 'body'],
  ['rightArm0', [4, SHOULDER, 0], 'body'],
  ['rightArm1', [4, ELBOW, 0], 'rightArm0'],
  ['leftArm0', [-4, SHOULDER, 0], 'body'],
  ['leftArm1', [-4, ELBOW, 0], 'leftArm0'],
  ['rightLeg0', [1.5, HIP, 0], 'body'],
  ['rightLeg1', [1.5, KNEE, 0], 'rightLeg0'],
  ['leftLeg0', [-1.5, HIP, 0], 'body'],
  ['leftLeg1', [-1.5, KNEE, 0], 'leftLeg0'],
]
const slot = (seg: Seg) => MOTIONS.segments.indexOf(seg) * 4

// 동작 한 프레임. 엉덩이 이동과 덩어리 회전 사원수 (Motion의 한 줄)
type Frame = { hip: number[]; rot: number[] }

// 두 프레임을 u만큼 섞음. 엉덩이는 곧게, 덩어리 회전은 사원수 구면 보간
const mixFrames = (a: Frame, b: Frame, u: number): Frame => ({
  hip: a.hip.map((h, k) => h + (b.hip[k] - h) * u),
  rot: MOTIONS.segments.flatMap((_, s) => slerp(a.rot.slice(4 * s, 4 * s + 4), b.rot.slice(4 * s, 4 * s + 4), u)),
})

// 동작 m의 f번째 프레임. 소수면 앞뒤 프레임 사이를 보간하고, 되풀이 동작은 끝에서 처음으로 이어짐
function frameAt(m: Motion, f: number): Frame {
  const n = m.rot.length
  const at = m.loop ? ((f % n) + n) % n : Math.min(Math.max(f, 0), n - 1)
  const i = Math.floor(at)
  const j = m.loop ? (i + 1) % n : Math.min(i + 1, n - 1)
  return mixFrames({ hip: m.hip[i], rot: m.rot[i] }, { hip: m.hip[j], rot: m.rot[j] }, at - i)
}

// 한 프레임의 덩어리별 움직임
function frameMoves({ hip, rot }: Frame): Record<Seg, Move> {
  const out = {} as Record<Seg, Move>
  for (const [seg, joint, parent] of CHAIN) {
    const s = slot(seg)
    out[seg] = { from: joint, to: parent === null ? add(joint, [hip[0], hip[1], hip[2]]) : movePoint(joint, out[parent]), turn: rotation(rot.slice(s, s + 4)) }
  }
  return out
}

// 동작 m의 f번째 프레임(소수면 앞뒤 프레임 사이를 보간) 모습
const motionMoves = (m: Motion, f: number) => frameMoves(frameAt(m, f))

// 뒤돌 때 쓰는 걷기 한 바퀴를 WALK_START에서 이만큼(바퀴 몫) 뒤에서 시작함. 왼발과 오른발이 가장 높이 뜨는 때가 도는 시간의 1/4, 3/4쯤에 와 두 발을 다 뗌.
// ponytail: 임시 값. 화면을 보며 맞춤
const TURN_PHASE = 0.25
// 덩어리가 모두 돌지 않은 프레임. 팔다리를 곧게 내린 틀 그대로(rest) 모습이고 좌우가 같음
const STILL: Frame = { hip: [0, 0, 0], rot: MOTIONS.segments.flatMap(() => [0, 0, 0, 1]) }

// 걷기에서 오른 허벅지가 가장 앞으로 나온 프레임. 걷기 시각에 여기서 시작해 걸음(발소리)마다 한쪽 다리가 가장 앞에 옴
const WALK_START = (() => {
  const thigh = (r: number[]) => rotation(r.slice(slot('rightLeg0'), slot('rightLeg0') + 4))(DOWN)[2]
  const rot = MOTIONS.clips.walk.rot
  return rot.reduce((best, r, i) => (thigh(r) > thigh(rot[best]) ? i : best), 0)
})()

// ms. 쓰러지는 동작에서 몸이 바닥에 닿는 때. 엉덩이가 가장 낮은 높이에서 1블록 안에 처음 들어온 프레임 (쓰러지는 소리를 이때 냄)
const FALL_HIP = MOTIONS.clips.fall.hip.map((h) => h[1])
export const FALL_LAND_MS = (FALL_HIP.findIndex((y) => y <= Math.min(...FALL_HIP) + 1) * 1000) / MOTIONS.fps

const rgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

// JSON 상자를 쉴 때의 Box와 덩어리로. 팔은 팔꿈치, 다리는 무릎 높이 아래가 아래쪽 덩어리. key가 있으면 핵심 파츠 상자를 그 색으로 칠함
function parts(data: CharacterData, key?: string): { box: Box; seg: Seg }[] {
  return data.boxes.map(({ part, from, to, color, key: isKey }) => {
    const c: V = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]
    const cut = part.endsWith('Arm') ? ELBOW : KNEE
    const seg = (part === 'head' || part === 'body' ? part : `${part}${c[1] < cut ? 1 : 0}`) as Seg
    return { box: { c, axes: [X, Y, Z], half: [(to[0] - from[0]) / 2, (to[1] - from[1]) / 2, (to[2] - from[2]) / 2], rgb: rgb(isKey && key ? key : color) }, seg }
  })
}

// 리볼버 모델의 쉰 자세. 총알은 닫힌 실린더 안이라 빠짐 (gun.ts revolverMesh)
const REVOLVER = revolverMesh(revolverData as Rig, [], 0)
// 총의 면. 꼭짓점 번호 셋과 텍스처에서 구운 색
const GUN_FACES = REVOLVER.faces

// 총 손잡이(GRIP)를 grip에 두고 총열은 barrel, 총 위는 top 쪽으로 놓은 총의 꼭짓점과 총구. vertices는 클립을 덮은 모델 꼭짓점
function holdGun(grip: V, barrel: V, top: V, vertices: readonly V[] = REVOLVER.vertices): { gun: V[]; muzzle: V } {
  const side = cross(barrel, top)
  const place = (m: V): V => {
    const [x, y, z] = sub(m, GRIP)
    return add(add(add(grip, barrel, x * GUN_SCALE), top, y * GUN_SCALE), side, z * GUN_SCALE)
  }
  return { gun: vertices.map(place), muzzle: place(MUZZLE) }
}

// 팔다리처럼 p에서 d쪽으로 뻗은 막대의 [from, to] 구간. 단면은 size×size
function rod(p: V, d: V, from: number, to: number, size: number, color: RGB): Box {
  const side = across(Math.abs(d[0]) < 0.9 ? X : Z, d)
  return { c: add(p, d, (from + to) / 2), axes: [side, d, cross(d, side)], half: [size / 2, (to - from) / 2, size / 2], rgb: color }
}

// 어깨 s에서 주먹 h에 닿게 굽힌 팔꿈치. 위팔 a, 팔꿈치에서 주먹까지 b. 팔꿈치는 out 쪽으로 나옴
function elbowFor(s: V, h: V, a: number, b: number, out: V): V {
  const d = Math.hypot(...sub(h, s))
  const u = unit(sub(h, s))
  const along = (a * a - b * b + d * d) / (2 * d)
  return add(add(s, u, along), across(out, u), Math.sqrt(Math.max(0, a * a - along * along)))
}

// 가장 낮은 곳의 높이(블록)
const lowest = (points: readonly V[]) => Math.min(...points.map((q) => q[1]))

// 가장 낮은 곳이 바닥에 닿게 올림
function ground(p: Pose): Pose {
  const bottom = lowest([...p.boxes.flatMap(corners), ...p.gun])
  const lift: Move = { from: [0, bottom, 0], to: [0, 0, 0], turn: (v) => v }
  return { ...p, boxes: p.boxes.map((b) => moveBox(b, lift)), gun: p.gun.map((q) => movePoint(q, lift)) }
}

// hand는 총을 든 손. 왼손이면 권총집과 총 쥔 팔을 왼쪽으로 옮김. 서기, 걷기, 쓰러짐 동작 데이터는 좌우를 바꾸지 않음 (SHEEP-133)
function build(data: CharacterData, key: string | undefined, hand: Hand): Body {
  const left = hand === 'left'
  // 총을 든 쪽의 x 부호와 그쪽 위팔(관절 이름), 아래팔, 허벅지. 아래 주석의 오른쪽은 왼손잡이면 왼쪽임
  const side = left ? -1 : 1
  const gunArm = left ? 'leftArm' : 'rightArm'
  const forearm = left ? 'leftArm1' : 'rightArm1'
  const mirrored = (v: V): V => [v[0] * side, v[1], v[2]]
  const shape = parts(left ? leftHolstered(data) : data, key)
  const posed = (m: Record<Seg, Move>) => ({
    boxes: shape.map(({ box, seg }) => moveBox(box, m[seg])),
    fist: movePoint([4 * side, FIST, 0], m[forearm]),
    thigh: m[left ? 'leftLeg0' : 'rightLeg0'],
  })
  // 총을 권총집에 꽂은 채. 총은 오른쪽 허벅지를 따라 움직임
  const holster = holdGun(mirrored(HOLSTER_GRIP), DOWN, Z).gun
  const holstered = (m: Record<Seg, Move>): Pose => {
    const p = posed(m)
    return { boxes: p.boxes, gun: holster.map((q) => movePoint(q, p.thigh)) }
  }
  // 총을 오른손에 쥔 채. 팔을 내린 자세에서 총열은 팔을 따라 아래, 총 위는 앞이라 앞으로 뻗으면 겨눈 모습과 같음.
  // 총은 오른 아래팔을 따라 움직임 (SHEEP-119)
  const inHand = holdGun([4 * side, FIST, 0], DOWN, Z).gun
  const held = (m: Record<Seg, Move>): Pose => ({ boxes: posed(m).boxes, gun: inHand.map((q) => movePoint(q, m[forearm])) })
  // 동작 데이터 m의 f번째 프레임. 가장 낮은 곳이 바닥에 닿게 둠
  const play = (m: Motion, f: number, pose = holstered) => ground(pose(motionMoves(m, f)))
  const frames = (ms: number) => (ms * MOTIONS.fps) / 1000
  // 위아래 시선(pitch)만큼 머리를 들고 오른팔과 총을 d쪽으로 뻗음. flash면 총구 앞에 불꽃
  const aimed = (pitch: number, d: V, flash: boolean): Pose => {
    const p = posed(moves({ ...rest, look: pitch, [gunArm]: [d, d] }))
    const { gun, muzzle } = holdGun(p.fist, d, across(Y, d))
    return { boxes: flash ? [...p.boxes, rod(muzzle, d, 0, 5, 4, FLASH)] : p.boxes, gun, muzzle }
  }
  // 오른손을 들어 총구를 관자놀이에 댐. 총열은 머리 쪽(-x), 팔꿈치는 옆으로 굽힘
  const temple = (flash: boolean): Pose => {
    const grip = sub(mirrored(TEMPLE), holdGun([0, 0, 0], [-side, 0, 0], Y).muzzle)
    const shoulder: V = [4 * side, SHOULDER, 0]
    const elbow = elbowFor(shoulder, grip, SHOULDER - ELBOW, ELBOW - FIST, [side, -0.3, 0.3])
    const p = posed(moves({ ...rest, [gunArm]: [unit(sub(elbow, shoulder)), unit(sub(grip, elbow))] }))
    const { gun, muzzle } = holdGun(p.fist, [-side, 0, 0], Y)
    return { boxes: flash ? [...p.boxes, rod(muzzle, mirrored(X), -0.5, 4, 4, FLASH)] : p.boxes, gun }
  }
  // 장전하는 팔과 총 (SHEEP-121). 총 쥔 팔은 팔꿈치를 굽혀 주먹을 배 앞에 두고, 다른 팔은 총 쪽으로 뻗어 실린더에 손을 댐.
  // 총구는 앞 아래로 숙임. 꺼낼 때와 넣을 때는 팔을 내린 모습(주먹이 권총집 옆)과 이 모습 사이를 부드럽게 오감. ponytail: 임시 자세. 화면을 보며 맞춤
  const otherArm = left ? 'rightArm' : 'leftArm'
  const loadingGunArm: readonly [V, V] = [unit([0, -1, 0.35]), unit([-0.35 * side, 0.15, 1])]
  const loadingOtherArm: readonly [V, V] = [unit([0.1 * side, -1, 0.5]), unit([0.55 * side, 0.2, 1])]
  const loadingBarrel = unit([-0.3 * side, -0.4, 1])
  const loading = (ms: number): Pose => {
    if (ms < 0 || ms >= RELOAD_END) return holstered(moves(rest))
    const end = RELOAD_AT + RELOAD_MS
    const k = ms < RELOAD_AT ? ms / RELOAD_AT : ms < end ? 1 : 1 - (ms - end) / HOLSTER_MS
    const u = k * k * (3 - 2 * k)
    const toward = (from: V, to: V) => unit(add(from, sub(to, from), u))
    const p = posed(moves({ ...rest, [gunArm]: [toward(DOWN, loadingGunArm[0]), toward(DOWN, loadingGunArm[1])], [otherArm]: [toward(DOWN, loadingOtherArm[0]), toward(DOWN, loadingOtherArm[1])] }))
    const t = reloadTime(ms)
    const mesh = revolverMesh(revolverData as Rig, t === null ? [] : [{ clip: 'Reload', t }], ROUNDS)
    // 권총집에 꽂힌 총처럼 총열이 아래, 총 위가 앞인 데서 장전하는 방향으로 돎
    const barrel = toward(DOWN, loadingBarrel)
    const { gun } = holdGun(p.fist, barrel, across(toward(Z, across(Y, loadingBarrel)), barrel), mesh.vertices)
    return ground({ boxes: p.boxes, gun, faces: mesh.faces })
  }
  const { stand, walk, fall } = MOTIONS.clips
  // 맞아 쓰러져 바닥에 닿을 때 놓친 총. 그때 주먹 아래 모래 위에, 총열은 아래팔을 바닥에 눕힌 쪽으로 두고 옆으로 눕힘.
  // 그 뒤로 몸이 조금 더 움직여도 총은 그 자리에 있음
  const dropped = (() => {
    const m = motionMoves(fall, frames(FALL_LAND_MS))
    const fist = movePoint([4 * side, FIST, 0], m[forearm])
    const arm = m[forearm].turn(DOWN)
    const barrel: V = Math.hypot(arm[0], arm[2]) > 0.2 ? unit([arm[0], 0, arm[2]]) : Z
    const gun = holdGun([fist[0], 0, fist[2]], barrel, cross(Y, barrel)).gun
    const bottom = lowest(gun)
    return gun.map((q): V => [q[0], q[1] - bottom, q[2]])
  })()
  return {
    rest: holstered(moves(rest)),
    stand: (ms) => play(stand, frames(ms)),
    // 걸음 두 번(발소리 두 번)에 한 바퀴
    walk: (ms) => play(walk, WALK_START + (ms / (2 * STEP_MS)) * walk.rot.length),
    reload: loading,
    // 곧게 선 틀 모습과 걷기 한 바퀴(두 걸음)를 섞음. 섞는 몫이 처음과 끝은 0, 가운데는 1이라 선 채로 시작해 발을 번갈아 떼었다 놓고 선 채로 끝남.
    // 좌우가 같은 틀 모습과 섞어 두 발을 비슷하게 뗌 (서기 동작은 한쪽 발에 기대 섞으면 한 발만 뜸)
    turn: (ms) => {
      const p = Math.min(Math.max(ms / TURN_MS, 0), 1)
      return ground(holstered(frameMoves(mixFrames(STILL, frameAt(walk, WALK_START + (p + TURN_PHASE) * walk.rot.length), Math.sin(Math.PI * p)))))
    },
    // 쏠 때는 반동으로 팔만 더 들림
    aim: (pitch) => aimed(pitch, ahead(pitch), false),
    draw: (ms, pitch) => {
      if (ms >= DRAW_MS) return aimed(pitch, ahead(pitch), false)
      const k = Math.max(0, ms) / DRAW_MS
      const u = k * k * (3 - 2 * k)
      const d = ahead(pitch)
      const toward = (from: V, to: V) => unit(add(from, sub(to, from), u))
      const p = posed(moves({ ...rest, look: pitch * u, [gunArm]: [toward(DOWN, d), toward(DOWN, d)] }))
      // 권총집에 꽂힌 총처럼 총열이 아래, 총 위가 앞인 데서 겨눈 방향으로 돎
      const barrel = toward(DOWN, d)
      return { boxes: p.boxes, gun: holdGun(p.fist, barrel, across(toward(Z, across(Y, d)), barrel)).gun }
    },
    fire: (pitch) => aimed(pitch, ahead(pitch + RECOIL), true),
    suicide: [temple(false), temple(true)],
    // 맞거나 쏜 뒤라 총을 손에 쥔 채 넘어짐. 맞았으면 바닥에 닿을 때 놓침
    fall: (ms, drop = false) =>
      drop && ms >= FALL_LAND_MS ? { ...ground({ boxes: posed(motionMoves(fall, frames(ms))).boxes, gun: [] }), gun: dropped } : play(fall, frames(ms), held),
    sit: holstered(moves(seated)),
  }
}

const cache = new Map<string, Body>()

// 캐릭터 번호(CHARACTERS 순서)의 모든 동작. color는 그 사람의 사람 색 번호이고 핵심 파츠를 그 색으로 칠함. 없으면 JSON 색 그대로(첫 화면 배경).
// hand는 그 사람이 총을 든 손(state hand). 캐릭터, 색, 손마다 처음 부를 때 한 번 만듦
export function characterBody(character: number, color?: number, hand: Hand = 'right'): Body {
  const id = `${character}/${color}/${hand}`
  let body = cache.get(id)
  if (!body) cache.set(id, (body = build(CHARACTERS[character], color === undefined ? undefined : keyColor(character, color), hand)))
  return body
}

// WANTED 포스터 초상화 (시스템 기획서 캐릭터 초상화). 상자 목록을 정면에서 15° 돌려 모자 꼭대기부터 가슴 위까지 64×64로 그림.
// 목수건과 핵심 파츠만 제 색이고 나머지는 갈색 인쇄 톤. 테두리 한 칸을 짙은 갈색으로 두름. SHEEP-117의 PNG를 만든 그리기와 같음
export const PORTRAIT_SIZE = 64
// 1블록의 px, 그림 맨 위 높이(블록, 모자 꼭대기 32 조금 위), 돌린 각도
const PORTRAIT_SCALE = 6.8
const PORTRAIT_TOP = 32.3
const PORTRAIT_YAW = (15 * Math.PI) / 180
// 보는 쪽에서 왼쪽 위 앞에서 오는 빛
const PORTRAIT_LIGHT = unit([-0.45, 0.6, 0.66])
// 갈색 인쇄 톤의 가장 어두운 색과 밝은 색, 테두리 색
const INK: RGB = [52, 30, 18]
const PRINT: RGB = [240, 214, 168]
const OUTLINE: RGB = [42, 26, 16]

// 목수건 상자. 몸통의 높이 23.6~25.7 사이 상자 중 목(x -1~1)이 아닌 것
const isKerchief = (b: CharacterData['boxes'][number]) => b.part === 'body' && b.from[1] >= 23.6 && b.to[1] <= 25.7 && !(b.from[0] === -1 && b.to[0] === 1)

// 초상화의 RGBA 픽셀(64×64×4). color가 없으면 JSON 색 그대로. 픽셀마다 화면 뒤에서 앞으로 광선을 쏴 처음 닿는 상자 면을 칠함
export function portraitPixels(character: number, color?: number): Uint8ClampedArray<ArrayBuffer> {
  const n = PORTRAIT_SIZE
  const c = Math.cos(PORTRAIT_YAW)
  const s = Math.sin(PORTRAIT_YAW)
  const key = color === undefined ? undefined : rgb(keyColor(character, color))
  const boxes = CHARACTERS[character].boxes.map((b) => ({ from: b.from, to: b.to, own: b.key || isKerchief(b), rgb: b.key && key ? key : rgb(b.color) }))
  const px = new Uint8ClampedArray(n * n * 4)
  const d: V = [s, 0, -c]
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5 - n / 2) / PORTRAIT_SCALE
      const y = PORTRAIT_TOP - (j + 0.5) / PORTRAIT_SCALE
      const o: V = [x * c - 100 * s, y, x * s + 100 * c]
      let best = Infinity
      let hit: (typeof boxes)[number] | null = null
      let normal = [0, 0, 0]
      for (const b of boxes) {
        let t0 = -Infinity
        let t1 = Infinity
        let axis = -1
        for (let k = 0; k < 3; k++) {
          if (Math.abs(d[k]) < 1e-12) {
            if (o[k] < b.from[k] || o[k] > b.to[k]) {
              t0 = Infinity
              break
            }
            continue
          }
          const a = (b.from[k] - o[k]) / d[k]
          const z = (b.to[k] - o[k]) / d[k]
          if (Math.min(a, z) > t0) {
            t0 = Math.min(a, z)
            axis = k
          }
          t1 = Math.min(t1, Math.max(a, z))
        }
        if (t0 <= t1 && t0 < best && axis >= 0) {
          best = t0
          hit = b
          normal = [0, 0, 0]
          normal[axis] = -Math.sign(d[axis])
        }
      }
      if (!hit) continue
      // 모델의 면 방향을 보는 쪽 기준으로 돌려 빛을 잼
      const seen: V = [normal[0] * c + normal[2] * s, normal[1], -normal[0] * s + normal[2] * c]
      const k = 0.55 + 0.5 * Math.max(0, dot(seen, PORTRAIT_LIGHT))
      let col = hit.rgb.map((v) => v * k)
      if (!hit.own) {
        const light = (0.3 * col[0] + 0.59 * col[1] + 0.11 * col[2]) / 255
        col = col.map((v, q) => v * 0.35 + (INK[q] + (PRINT[q] - INK[q]) * Math.min(1, light * 1.15)) * 0.65)
      }
      px.set([col[0], col[1], col[2], 255], (j * n + i) * 4)
    }
  }
  const filled = (i: number, j: number) => i >= 0 && j >= 0 && i < n && j < n && px[(j * n + i) * 4 + 3] === 255
  const edge: number[] = []
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (!filled(i, j) && (filled(i - 1, j) || filled(i + 1, j) || filled(i, j - 1) || filled(i, j + 1))) edge.push((j * n + i) * 4)
  for (const p of edge) px.set([...OUTLINE, 255], p)
  return px
}

const portraits = new Map<string, string>()

// 초상화를 <img>에 넣을 주소(PNG data URL)로. 캐릭터와 색마다 처음 부를 때 한 번 그림. 캔버스가 있는 브라우저에서만 부름
export function portraitUrl(character: number, color?: number): string {
  const id = `${character}/${color}`
  let url = portraits.get(id)
  if (url === undefined) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = PORTRAIT_SIZE
    canvas.getContext('2d')!.putImageData(new ImageData(portraitPixels(character, color), PORTRAIT_SIZE), 0, 0)
    portraits.set(id, (url = canvas.toDataURL()))
  }
  return url
}

// 상자의 꼭짓점 8개
export const corners = (b: Box): V[] =>
  Array.from({ length: 8 }, (_, i) => b.axes.reduce((p, axis, j) => add(p, axis, (i >> j) & 1 ? b.half[j] : -b.half[j]), b.c))

// 결투장에 선 사람 하나. facing은 바라보는 각도(라디안, 0 = +x)
export type Figure = { x: number; y: number; facing: number } & Pose

// 격자 좌표 (wx, wy)와 높이 h(칸)를 x, y에 facing으로 선 사람의 모델 좌표(블록)로. inWorld를 되돌림
export function toModel(x: number, y: number, facing: number, wx: number, wy: number, h: number): V {
  const cos = Math.cos(facing)
  const sin = Math.sin(facing)
  const gx = wx - x
  const gy = wy - y
  return [(-sin * gx + cos * gy) / CELL, h / CELL, (cos * gx + sin * gy) / CELL]
}

// 몸에 남은 상처 하나 (SHEEP-126). box는 붙은 상자 번호(동작마다 상자 순서가 같음), local은 그 상자 축 기준 자리(블록).
// 상자를 따라 옮겨 그려 쓰러지거나 팔을 들어도 같은 자리에 남음
export type Wound = { box: number; local: V }
// 상처 색과 반 길이(블록). 반쯤 몸에 묻혀 겉면에 붉은 네모로 보임
const WOUND: RGB = [110, 8, 8]
const WOUND_HALF: V = [0.55, 0.55, 0.55]

// 모델 좌표 p를 가장 가까운 상자 겉면에 붙인 상처. 판정 원기둥이 상자보다 굵어 맞은 자리는 대개 상자 밖이고, 상자 안의 점은 가장 얕은 면으로 밀어냄
export function pinWound(boxes: readonly Box[], p: V): Wound {
  let best: Wound = { box: 0, local: [0, 0, 0] }
  let bestGap = Infinity
  boxes.forEach((b, i) => {
    const l = b.axes.map((a) => dot(sub(p, b.c), a))
    const gap = Math.hypot(...l.map((v, k) => Math.max(0, Math.abs(v) - b.half[k])))
    if (gap >= bestGap) return
    const local = l.map((v, k) => Math.max(-b.half[k], Math.min(b.half[k], v)))
    if (gap === 0) {
      const k = [0, 1, 2].reduce((m, j) => (b.half[j] - Math.abs(l[j]) < b.half[m] - Math.abs(l[m]) ? j : m), 0)
      local[k] = (l[k] < 0 ? -1 : 1) * b.half[k]
    }
    best = { box: i, local: [local[0], local[1], local[2]] }
    bestGap = gap
  })
  return best
}

// 이 동작의 상자들에서 상처 w를 그릴 작은 상자
export function woundBox(boxes: readonly Box[], w: Wound): Box {
  const b = boxes[w.box]
  return { c: add(add(add(b.c, b.axes[0], w.local[0]), b.axes[1], w.local[1]), b.axes[2], w.local[2]), axes: b.axes, half: WOUND_HALF, rgb: WOUND }
}

// x, y에 facing으로 선 사람의 모델 좌표 p(블록)가 놓이는 [격자 x, 격자 y, 높이(칸)]. drawFigure와 같은 식
export function inWorld(x: number, y: number, facing: number, p: V): [number, number, number] {
  const cos = Math.cos(facing)
  const sin = Math.sin(facing)
  return [x + (-sin * p[0] + cos * p[2]) * CELL, y + (cos * p[0] + sin * p[2]) * CELL, p[1] * CELL]
}

// 사람 하나를 그리는 동안 픽셀마다 가장 가까운 면까지의 깊이(칸). 상자와 총의 삼각형이 서로 가림. 화면 크기가 바뀌면 다시 만듦
let depth = new Float64Array(0)

// 사람을 그 자리와 각도에서 본 대로 그림. 픽셀마다 눈에서 쏜 광선이 처음 닿는 상자 면을 칠하고, 그 면이 벽(zbuf)보다 멀면 건너뜀.
// 광선의 t는 카메라에서 앞으로 간 수직 거리라 벽까지의 거리(zbuf)와 바로 견줌. 그다음 총의 삼각형을 칠하며 픽셀마다 깊이를 견줌.
// light는 그 시간대의 빛 색조
export function drawFigure(pixels: Uint32Array, w: number, h: number, zbuf: Float64Array, cam: Camera, fig: Figure, light: RGB) {
  if (depth.length !== w * h) depth = new Float64Array(w * h)
  const proj = w / (2 * Math.hypot(cam.planeX, cam.planeY))
  const horizon = horizonY(h, proj, cam.pitch)
  const invDet = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY)
  const eyeZ = cam.z ?? 0.5
  const cos = Math.cos(fig.facing)
  const sin = Math.sin(fig.facing)
  // 격자 방향과 높이(칸)를 그 사람의 모델 좌표(블록)로 바꿈. 격자 y가 아래로 늘어 앞에서 시계 방향으로 90°가 오른쪽
  const toModel = (gx: number, gy: number, up: number): V => [(-sin * gx + cos * gy) / CELL, up / CELL, (cos * gx + sin * gy) / CELL]
  // 모델 좌표의 점이 화면에 놓이는 [x, y, 깊이]. 카메라 앞 NEAR보다 가까우면 null
  const project = (p: V): V | null => {
    const rx = fig.x + (-sin * p[0] + cos * p[2]) * CELL - cam.x
    const ry = fig.y + (cos * p[0] + sin * p[2]) * CELL - cam.y
    const z = invDet * (cam.planeX * ry - cam.planeY * rx)
    if (z < NEAR) return null
    return [(w / 2) * (1 + (invDet * (cam.dirY * rx - cam.dirX * ry)) / z), horizon + (proj * (eyeZ - p[1] * CELL)) / z, z]
  }
  // 눈은 벽 높이의 절반. 술집 카메라는 따로 정함
  const eye = toModel(cam.x - fig.x, cam.y - fig.y, eyeZ)
  // 빛은 내 쪽 왼쪽 위에서 옴. 어느 쪽에서 봐도 같은 쪽이 밝음
  const screenX = unit(toModel(cam.planeX, cam.planeY, 0))
  const lit = unit(add(add(Y, screenX, -1), unit([eye[0], 0, eye[2]]), 1.4))
  const shaded = (color: RGB, k: number) => tint(pack(Math.round(color[0] * k), Math.round(color[1] * k), Math.round(color[2] * k)), light)
  const local = fig.boxes.map((b) => {
    // 꼭짓점을 화면에 비춘 범위만 검사함. 일부가 카메라 뒤면 화면 전체, 모두 뒤면 비움
    const seen = corners(b).map(project)
    const on = seen.filter((s) => s !== null)
    const xs = on.map((s) => s[0])
    const ys = on.map((s) => s[1])
    const all = on.length < 8
    return {
      half: b.half,
      axes: b.axes,
      o: b.axes.map((a) => dot(add(eye, b.c, -1), a)),
      x0: on.length === 0 ? w : all ? 0 : Math.max(0, Math.floor(Math.min(...xs))),
      x1: on.length === 0 ? 0 : all ? w : Math.min(w, Math.ceil(Math.max(...xs))),
      y0: all ? 0 : Math.max(0, Math.floor(Math.min(...ys))),
      y1: all ? h : Math.min(h, Math.ceil(Math.max(...ys))),
      // 이 세로줄 광선 방향의 축별 가로 몫. 세로줄마다 다시 셈
      across: new Float64Array(3),
      // 축마다 광선이 들어가는 두 면(-쪽, +쪽)의 색. 불꽃은 스스로 빛나 면 밝기를 곱하지 않음
      face: b.axes.flatMap((a) => [-1, 1].map((side) => shaded(b.rgb, b.rgb === FLASH ? 1 : 0.55 + 0.45 * Math.max(0, side * dot(a, lit))))),
    }
  })
  const gun = fig.gun.map(project)
  const gunOn = gun.filter((s) => s !== null)
  // 상자와 총을 모두 덮는 화면 범위. 그 안의 깊이를 벽까지의 거리로 채우고 시작함
  const x0 = Math.max(0, Math.min(...local.map((b) => b.x0), ...gunOn.map((s) => Math.floor(s[0]))))
  const x1 = Math.min(w, Math.max(...local.map((b) => b.x1), ...gunOn.map((s) => Math.ceil(s[0]) + 1)))
  const y0 = Math.max(0, Math.min(...local.map((b) => (b.x0 < b.x1 ? b.y0 : h)), ...gunOn.map((s) => Math.floor(s[1]))))
  const y1 = Math.min(h, Math.max(...local.map((b) => (b.x0 < b.x1 ? b.y1 : 0)), ...gunOn.map((s) => Math.ceil(s[1]) + 1)))
  // 화면 밖 옆에 선 사람은 범위가 빔. 상자 범위는 화면 폭으로 자르지 않아 x0가 w를 넘을 수 있고, 그대로 두면 깊이 버퍼 밖에 씀 (SHEEP-134)
  if (x0 >= x1 || y0 >= y1) return
  for (let py = y0; py < y1; py++) depth.set(zbuf.subarray(x0, x1), py * w + x0)

  for (let px = x0; px < x1; px++) {
    const camX = (2 * (px + 0.5)) / w - 1
    const ray = toModel(cam.dirX + cam.planeX * camX, cam.dirY + cam.planeY * camX, 0)
    const column = local.filter((b) => px >= b.x0 && px < b.x1)
    if (column.length === 0) continue
    for (const b of column) for (let i = 0; i < 3; i++) b.across[i] = dot(ray, b.axes[i])
    const cy0 = Math.min(...column.map((b) => b.y0))
    const cy1 = Math.max(...column.map((b) => b.y1))
    for (let py = cy0; py < cy1; py++) {
      // 광선의 위아래 몫. 지평선보다 아래 줄이면 내려감
      const rise = -(py + 0.5 - horizon) / proj / CELL
      let nearest = depth[py * w + px]
      for (const b of column) {
        if (py < b.y0 || py >= b.y1) continue
        let enter = -Infinity
        let exit = Infinity
        let face = 0
        for (let i = 0; i < 3; i++) {
          const d = b.across[i] + rise * b.axes[i][1]
          const o = b.o[i]
          const half = b.half[i]
          if (Math.abs(d) < 1e-12) {
            if (Math.abs(o) > half) exit = -Infinity
            continue
          }
          const t0 = (-half - o) / d
          const t1 = (half - o) / d
          if (Math.min(t0, t1) > enter) {
            enter = Math.min(t0, t1)
            // 광선이 축 방향으로 가면 -쪽 면으로 들어옴
            face = 2 * i + (d > 0 ? 0 : 1)
          }
          exit = Math.min(exit, Math.max(t0, t1))
        }
        if (enter <= exit && enter > NEAR && enter < nearest) {
          nearest = enter
          pixels[py * w + px] = b.face[face]
        }
      }
      depth[py * w + px] = nearest
    }
  }

  // 총의 삼각형. 픽셀 가운데가 든 삼각형만 칠하고, 깊이는 화면에서 1/깊이를 섞어 구함
  for (const f of fig.faces ?? GUN_FACES) {
    const [i0, i1, i2] = f.v
    const a = gun[i0]
    const b = gun[i1]
    const c = gun[i2]
    if (!a || !b || !c) continue
    // 눈을 등진 면은 앞면에 가려지므로 칠하지 않음
    const n = cross(sub(fig.gun[i1], fig.gun[i0]), sub(fig.gun[i2], fig.gun[i0]))
    if (dot(n, sub(eye, fig.gun[i0])) <= 0) continue
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if (area === 0) continue
    const color = shaded(f.color, 0.55 + 0.45 * Math.max(0, dot(unit(n), lit)))
    const tx0 = Math.max(0, Math.ceil(Math.min(a[0], b[0], c[0]) - 0.5))
    const tx1 = Math.min(w - 1, Math.floor(Math.max(a[0], b[0], c[0]) - 0.5))
    const ty0 = Math.max(0, Math.ceil(Math.min(a[1], b[1], c[1]) - 0.5))
    const ty1 = Math.min(h - 1, Math.floor(Math.max(a[1], b[1], c[1]) - 0.5))
    for (let py = ty0; py <= ty1; py++) {
      const y = py + 0.5
      for (let px = tx0; px <= tx1; px++) {
        const x = px + 0.5
        const wa = ((b[0] - x) * (c[1] - y) - (b[1] - y) * (c[0] - x)) / area
        const wb = ((c[0] - x) * (a[1] - y) - (c[1] - y) * (a[0] - x)) / area
        const wc = 1 - wa - wb
        if (wa < 0 || wb < 0 || wc < 0) continue
        const z = 1 / (wa / a[2] + wb / b[2] + wc / c[2])
        const i = py * w + px
        if (z < depth[i]) {
          depth[i] = z
          pixels[i] = color
        }
      }
    }
  }
}
