import { describe, expect, test } from 'vitest'
import {
  balanceAt,
  BLEED,
  boardTimes,
  coinTimes,
  DIM_MS,
  dimAt,
  END_FADE_MS,
  endingAt,
  FALL_MS,
  fallSlow,
  FINISH_FOV,
  FINISH_SLOW,
  finishLanded,
  finishLook,
  finishMotion,
  finishSpin,
  finishZoom,
  HITSTOP_MS,
  lastFallMotion,
  lastFallView,
  onScreen,
  PULL_MS,
  pullView,
  SLOW,
  SPIN_END,
  SPIN_HOLD,
  SPIN_MS,
  SPIN_PAUSE,
  spinDelay,
  spinGun,
  toCamera,
  TURN_AT,
  TURN_FOR,
  turnFacing,
  walkerAt,
  walkoffCamera,
  walkoffView,
  WALK_MS,
  ZOOM_HOLD,
  ZOOM_IN_MS,
  ZOOM_OUT_MS,
  zoomFov,
} from './ceremony.ts'
import { FALL_LAND_MS } from './character.ts'
import { POOL_MS } from './blood.ts'
import { fallDelay } from './sound.ts'
import { SUN_AZ } from './desert.ts'
import { makeCamera } from './render.ts'

const end = 100000
const SUN = (SUN_AZ * Math.PI) / 180
// 서버 RoundFlow.WinResultDuration
const WIN_RESULT_MS = 18500
// 결과를 받은 때부터 pull까지(마지막 쓰러짐 보기). 결과는 INTERP_DELAY(0.1초) 뒤에 보이고 서버 결과 시각과 받은 때 사이도 있어 0.3초를 뺌
const FALL_STAGE = WIN_RESULT_MS - PULL_MS - WALK_MS - 300

describe('endingAt (SHEEP-187 시안 A)', () => {
  test('끝 시각에서 거꾸로 걷기, 카메라 빠지기, 그 앞은 마지막 쓰러짐 보기', () => {
    const walk = end - WALK_MS
    const pull = walk - PULL_MS
    expect(endingAt(end, pull - 1)).toEqual({ stage: 'fall', elapsed: -1 })
    expect(endingAt(end, pull)).toEqual({ stage: 'pull', elapsed: 0 })
    expect(endingAt(end, walk + 100)).toEqual({ stage: 'walk', elapsed: 100 })
    expect(endingAt(end, end - 1).stage).toBe('walk')
  })

  test('마지막 쓰러짐 보기는 5.5초 남음 (SHEEP-194에서 1.5초 늘림)', () => {
    expect(WIN_RESULT_MS - PULL_MS - WALK_MS).toBe(FALL_MS)
    expect(FALL_MS).toBe(5500)
  })
})

describe('lastFallMotion (사용자 요청 2026-11-11: 쓰러져 피 흘리는 데까지 느리게)', () => {
  test('바닥에 닿을 때까지는 SLOW배로 느리게, 닿은 뒤로는 피 웅덩이가 번지게 BLEED배로', () => {
    const land = FALL_LAND_MS / SLOW
    expect(lastFallMotion(1000, FALL_LAND_MS, SLOW)).toBeCloseTo(1000 * SLOW)
    expect(lastFallMotion(land, FALL_LAND_MS, SLOW)).toBeCloseTo(FALL_LAND_MS)
    expect(lastFallMotion(land + 500, FALL_LAND_MS, SLOW)).toBeCloseTo(FALL_LAND_MS + 500 * BLEED)
  })

  test('진 사람이 위에서 보는 동안 바닥에 닿고 웅덩이가 다 자란 크기의 80%까지 번짐. 시간 초과(자살)는 더 빨리 틂', () => {
    // 웅덩이 반지름은 1 - (1 - 지난 시간 / POOL_MS)² 몫 (blood.ts pool)
    const spread = POOL_MS * (1 - Math.sqrt(0.2))
    expect(fallDelay('shot') / fallSlow('shot') + spread / BLEED).toBeLessThanOrEqual(FALL_STAGE)
    expect(fallDelay('timeout') / fallSlow('timeout') + spread / BLEED).toBeLessThanOrEqual(FALL_STAGE)
    expect(fallSlow('shot')).toBe(SLOW)
    // 판 도중 나가기도 자살 모습이라 시간 초과와 같이 틂 (SHEEP-200)
    expect(fallSlow('left')).toBe(fallSlow('timeout'))
  })
})

describe('spinGun (이긴 사람 1인칭)', () => {
  test('처음 빨리 SPIN_TURNS 바퀴 돌고, 멈춘 뒤 권총집에 넣음', () => {
    expect(spinGun(0)).toEqual({ spin: 0, lower: 0 })
    const early = spinGun(SPIN_MS * 0.25).spin
    const late = spinGun(SPIN_MS * 0.75).spin - spinGun(SPIN_MS * 0.5).spin
    expect(early).toBeGreaterThan(late)
    expect(spinGun(SPIN_MS - 1).spin).toBeGreaterThan(3.9 * Math.PI)
    // 다 돌면 총구가 앞을 봄
    expect(spinGun(SPIN_MS + SPIN_HOLD / 2)).toEqual({ spin: 0, lower: 0 })
    expect(spinGun(SPIN_END).lower).toBe(1)
  })

  test('쓰러진 몸이 바닥에 닿고 뜸을 들여 돌려 넣기를 마친 뒤에 카메라가 빠짐. 시간 초과(자살)도', () => {
    for (const reason of ['shot', 'timeout'] as const) {
      expect(spinDelay(fallDelay(reason))).toBeGreaterThanOrEqual(fallDelay(reason))
      expect(spinDelay(fallDelay(reason)) + SPIN_END).toBeLessThanOrEqual(FALL_STAGE)
    }
    // 맞아 쓰러지면 뜸을 다 들임
    expect(spinDelay(fallDelay('shot'))).toBe(fallDelay('shot') + SPIN_PAUSE)
  })
})

describe('결정타 줌 (SHEEP-194 시안 A)', () => {
  const land = fallDelay('shot')

  test('히트스톱 동안 멈춘 몸이 그 자리에서 이어 FINISH_SLOW배로 쓰러지고, 바닥에 닿은 뒤로는 제 빠르기', () => {
    expect(finishMotion(-50, land)).toBe(-50)
    expect(finishMotion(HITSTOP_MS / 2, land)).toBe(0)
    expect(finishMotion(HITSTOP_MS + 1000, land)).toBeCloseTo(1000 * FINISH_SLOW)
    expect(finishMotion(finishLanded(land), land)).toBeCloseTo(land)
    expect(finishMotion(finishLanded(land) + 500, land)).toBeCloseTo(land + 500)
    expect(finishLanded(land)).toBeCloseTo(HITSTOP_MS + land / FINISH_SLOW)
  })

  test('히트스톱이 끝나면 확 당기고, 바닥에 닿고 뜸을 들인 뒤 천천히 되돌림', () => {
    expect(finishZoom(0, land)).toBe(0)
    expect(finishZoom(HITSTOP_MS, land)).toBe(0)
    expect(finishZoom(HITSTOP_MS + ZOOM_IN_MS / 2, land)).toBeGreaterThan(0.8)
    expect(finishZoom(HITSTOP_MS + ZOOM_IN_MS, land)).toBe(1)
    expect(finishZoom(finishLanded(land) + ZOOM_HOLD, land)).toBe(1)
    expect(finishZoom(finishLanded(land) + ZOOM_HOLD + ZOOM_OUT_MS / 2, land)).toBeCloseTo(0.5)
    expect(finishZoom(finishLanded(land) + ZOOM_HOLD + ZOOM_OUT_MS, land)).toBe(0)
  })

  test('줌 정도에 따라 시야가 기본 시야에서 FINISH_FOV까지 좁아짐', () => {
    expect(zoomFov(90, 0)).toBeCloseTo(90)
    expect(zoomFov(90, 1)).toBeCloseTo(FINISH_FOV)
    expect(zoomFov(90, 0.5)).toBeLessThan(90)
    expect(zoomFov(90, 0.5)).toBeGreaterThan(FINISH_FOV)
  })

  test('되돌린 뒤 총을 돌려 넣고, 다 넣은 뒤에 카메라가 빠짐', () => {
    expect(finishSpin(land)).toBeGreaterThan(finishLanded(land) + ZOOM_HOLD + ZOOM_OUT_MS)
    expect(finishSpin(land) + SPIN_END).toBeLessThanOrEqual(FALL_STAGE)
  })

  test('줌하는 동안 시선이 쓰러지는 몸으로 감. 서 있으면 가슴, 누우면 등 뒤로 누운 몸 가운데를 봄', () => {
    const eye = { x: 0, y: 0, z: 0.84 }
    const standing = finishLook(eye, 8, 0, Math.PI, 0, land)
    expect(standing.angle).toBeCloseTo(0)
    expect(standing.pitch).toBeCloseTo(-Math.atan((0.84 - 0.55) / 8))
    // 이긴 사람 쪽(facing π)을 보던 사람은 뒤(+x)로 넘어짐
    const lying = finishLook(eye, 8, 0, Math.PI, land, land)
    expect(lying.pitch).toBeLessThan(standing.pitch)
    expect(lying.pitch).toBeCloseTo(-Math.atan((0.84 - 0.12) / 8.45))
    expect(finishLook(eye, 0, 8, Math.PI, 0, land).angle).toBeCloseTo(Math.PI / 2)
  })
})

describe('dimAt (걷기 시작 뒤 어두워짐, SHEEP-197)', () => {
  test('걷기 전에는 밝고, 걷기 시작부터 DIM_MS 동안 점점 짙어진 뒤 그대로', () => {
    expect(dimAt(-500)).toBe(0)
    expect(dimAt(0)).toBe(0)
    expect(dimAt(DIM_MS / 2)).toBeCloseTo(0.5)
    expect(dimAt(DIM_MS)).toBe(1)
    expect(dimAt(DIM_MS * 3)).toBe(1)
  })
})

describe('boardTimes (결과 보드)', () => {
  test('이긴 사람은 포스터, 도장, 문구, 잔고, +$100, 세어 올리기, 킬 수 차례로 뜨고, 다 뜬 뒤 1초 넘게 보이고 닫힘', () => {
    const t = boardTimes(true)
    const order = [t.poster, t.stamp, t.phrase, t.money, t.plus, t.count, t.counted, t.kills] as number[]
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(t.kills! + 1000).toBeLessThanOrEqual(WALK_MS - END_FADE_MS)
  })

  test('진 사람은 지금 잔고만 보이고(+$100과 세어 올리기 없음) 킬 수를 당김', () => {
    const t = boardTimes(false)
    expect(t.money).toBe(boardTimes(true).money)
    expect([t.plus, t.count, t.counted]).toEqual([null, null, null])
    expect(t.kills).toBeGreaterThan(t.money!)
    expect(t.kills).toBeLessThan(boardTimes(true).kills!)
  })
})

describe('balanceAt · coinTimes (잔고 세어 올리기)', () => {
  const t = boardTimes(true)
  test('세기 전에는 전 잔고, 다 세면 새 잔고, 그사이는 $10씩 오르기만 함', () => {
    expect(balanceAt(t.money!, 200, 300)).toBe(200)
    expect(balanceAt(t.counted!, 200, 300)).toBe(300)
    let last = 200
    for (let e = t.count!; e <= t.counted!; e += 20) {
      const b = balanceAt(e, 200, 300)
      expect(b % 10).toBe(0)
      expect(b).toBeGreaterThanOrEqual(last)
      last = b
    }
  })

  test('$10 오를 때마다 동전 소리 하나. 소리 나는 때는 잔고가 바뀌는 때', () => {
    const times = coinTimes(200, 300)
    expect(times).toHaveLength(10)
    for (const [i, at] of times.entries()) {
      expect(at).toBeGreaterThanOrEqual(t.count!)
      expect(at).toBeLessThanOrEqual(t.counted!)
      expect(balanceAt(at - 1, 200, 300)).toBe(200 + i * 10)
      expect(balanceAt(at + 1, 200, 300)).toBe(200 + (i + 1) * 10)
    }
    expect(coinTimes(300, 300)).toEqual([])
  })
})

describe('walkerAt', () => {
  test('해 쪽을 보고 해 쪽으로 걸어감', () => {
    const at0 = walkerAt(10, 10, 0)
    const later = walkerAt(10, 10, 2000)
    expect(at0).toEqual({ x: 10, y: 10, facing: SUN })
    const moved = Math.hypot(later.x - 10, later.y - 10)
    expect(moved).toBeGreaterThan(0.5)
    expect(Math.atan2(later.y - 10, later.x - 10)).toBeCloseTo(Math.atan2(Math.sin(SUN), Math.cos(SUN)))
  })
})

describe('walkoffCamera', () => {
  test('이긴 사람 뒤에서 해 쪽을 봄', () => {
    const cam = walkoffCamera(10, 10, 66)
    expect(Math.atan2(cam.dirY, cam.dirX)).toBeCloseTo(Math.atan2(Math.sin(SUN), Math.cos(SUN)))
    // 이긴 사람이 카메라 앞에 있음
    expect((10 - cam.x) * cam.dirX + (10 - cam.y) * cam.dirY).toBeGreaterThan(1)
  })
})

describe('pullView · turnFacing (카메라가 빠지며 돌아섬)', () => {
  const eye = { x: 10, y: 10, angle: 0.3, pitch: 0.05, z: 0.84 }
  const back = walkoffView(10, 10)
  test('이긴 사람 눈에서 시작해 뒷모습 자리에서 끝남', () => {
    expect(pullView(eye, back, 0)).toEqual(eye)
    const done = pullView(eye, back, PULL_MS)
    expect(done.x).toBeCloseTo(back.x)
    expect(done.y).toBeCloseTo(back.y)
    expect(done.z).toBeCloseTo(back.z)
    expect(Math.cos(done.angle - back.angle)).toBeCloseTo(1)
  })

  test('보는 쪽은 짧은 쪽으로 돌고, 보는 쪽과 높이는 자리보다 먼저 맞춤', () => {
    const from = { ...eye, angle: back.angle + 3 }
    for (const elapsed of [PULL_MS / 4, PULL_MS / 2, PULL_MS]) expect(Math.abs(pullView(from, back, elapsed).angle - from.angle)).toBeLessThanOrEqual(Math.PI)
    const half = pullView(eye, back, PULL_MS / 2)
    expect(half.pitch).toBeCloseTo(back.pitch)
    expect(half.z).toBeCloseTo(back.z)
    expect(half.x).not.toBeCloseTo(back.x)
  })

  test('카메라가 빠지는 동안 돌기 시작해 걷기 전에 해 쪽을 다 봄', () => {
    expect(turnFacing(1, TURN_AT)).toBeCloseTo(1)
    expect(Math.cos(turnFacing(1, TURN_AT + TURN_FOR) - SUN)).toBeCloseTo(1)
    expect(TURN_AT + TURN_FOR).toBeLessThanOrEqual(PULL_MS)
  })
})

describe('onScreen (머리 위 닉네임)', () => {
  const cam = { ...makeCamera(0, 0, 0, 66), z: 0.75 }
  test('눈높이 정면은 화면 가운데, 더 높으면 위쪽, 오른쪽이면 오른쪽', () => {
    expect(onScreen(cam, 5, 0, 0.75, 480, 270)).toEqual({ x: 240, y: 135 })
    expect(onScreen(cam, 5, 0, 1.1, 480, 270)!.y).toBeLessThan(135)
    // 보는 쪽(+x)의 오른쪽은 +y (makeCamera plane)
    expect(onScreen(cam, 5, 1, 0.75, 480, 270)!.x).toBeGreaterThan(240)
  })

  test('카메라 뒤면 null', () => {
    expect(onScreen(cam, -1, 0, 0.75, 480, 270)).toBeNull()
  })
})

describe('lastFallView', () => {
  test('쓰러지는 사람이 보던 쪽 앞 위에서 그 사람을 내려다보고, 천천히 물러나며 올라감', () => {
    for (const facing of [0, 1, 4]) {
      const first = toCamera(lastFallView(10, 10, facing, 0), 66)
      const later = toCamera(lastFallView(10, 10, facing, 3000), 66)
      for (const cam of [first, later]) {
        // 카메라는 바라보던 쪽 앞에 있고, 그 사람을 향해 내려다봄
        expect(Math.cos(facing) * (cam.x - 10) + Math.sin(facing) * (cam.y - 10)).toBeGreaterThan(1)
        expect(cam.dirX * Math.cos(facing) + cam.dirY * Math.sin(facing)).toBeCloseTo(-1)
        expect(cam.pitch).toBeLessThan(0)
      }
      expect(Math.hypot(later.x - 10, later.y - 10)).toBeGreaterThan(Math.hypot(first.x - 10, first.y - 10))
      expect(later.z!).toBeGreaterThan(first.z!)
    }
  })
})
