import { describe, expect, test } from 'vitest'
import { bartenderBody, brimOf, CELL, CHARACTERS, characterBody, corners, drawFigure, FALL_LAND_MS, inWorld, pinWound, toModel, woundBox, keyColor, PORTRAIT_SIZE, portraitPixels, savedCharacter, savedColor, SUICIDE_AIM, SUICIDE_FLASH, suicideStage, type Box, type Pose } from './character.ts'
import revolverData from './assets/revolver-rig.json'
import { DRAW_MS, RELOAD_AT, RELOAD_END, RELOAD_MS, revolverMesh } from './gun.ts'
import { makeCamera, type RGB } from './render.ts'
import type { Rig } from './rig.ts'
import { STEP_MS, TURN_MS } from './round.ts'

type V = readonly [number, number, number]
type Range = readonly [V, V]

// 시스템 기획서 캐릭터 틀(블록). 몸통은 목(25~26)까지 넣음
const FRAME: Record<string, Range> = {
  head: [[-1.5, 26, -1.75], [1.5, 30, 1.75]],
  body: [[-3, 16, -1.5], [3, 26, 1.5]],
  rightArm: [[3, 12, -1], [5, 25, 1]],
  leftArm: [[-5, 12, -1], [-3, 25, 1]],
  rightLeg: [[0.25, 0, -1.25], [2.75, 16, 1.25]],
  leftLeg: [[-2.75, 0, -1.25], [-0.25, 16, 1.25]],
}

// 상자들이 덮는 i축 범위(칸)
function span(boxes: readonly Box[], i: number): [number, number] {
  const values = boxes.flatMap((b) => corners(b).map((p) => p[i] * CELL))
  return [Math.min(...values), Math.max(...values)]
}
// p(블록)를 품은 상자들
const holding = (boxes: readonly Box[], p: V) =>
  boxes.filter((b) => b.axes.every((a, i) => Math.abs(a.reduce((s, ai, j) => s + ai * (p[j] - b.c[j]), 0)) <= b.half[i]))
// 칸 단위 길이가 1px(키 64px) 안에서 맞는지
const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(0.015)

describe('CHARACTERS 틀 검사 (시스템 기획서 캐릭터)', () => {
  for (const [n, ch] of CHARACTERS.entries()) {
    const boxes = ch.boxes
    const inside = (b: (typeof boxes)[number], lo: V, hi: V) => [0, 1, 2].every((i) => b.from[i] >= lo[i] - 1e-9 && b.to[i] <= hi[i] + 1e-9)

    test(`${n} ${ch.name}: 상자는 40개 이하이고 부위 이름과 색이 맞음`, () => {
      expect(boxes.length).toBeLessThanOrEqual(40)
      for (const b of boxes) {
        expect(Object.keys(FRAME)).toContain(b.part)
        expect(b.color).toMatch(/^#[0-9a-f]{6}$/)
        for (let i = 0; i < 3; i++) expect(b.from[i]).toBeLessThan(b.to[i])
      }
    })

    test(`${n} ${ch.name}: 머리와 목, 몸통은 틀 그대로이고 머리 꼭대기가 30`, () => {
      const has = (part: string, from: V, to: V) =>
        boxes.some((b) => b.part === part && `${b.from}` === `${from}` && `${b.to}` === `${to}`)
      expect(has('head', [-1.5, 26, -1.75], [1.5, 30, 1.75])).toBe(true)
      expect(has('body', [-1, 25, -1], [1, 26, 1])).toBe(true)
      expect(has('body', [-3, 16, -1.5], [3, 25, 1.5])).toBe(true)
    })

    test(`${n} ${ch.name}: 위팔, 아래팔, 허벅지, 정강이가 틀의 굵기`, () => {
      const limbs: [string, number][] = [['rightArm', 21], ['rightArm', 16], ['leftArm', 21], ['leftArm', 16], ['rightLeg', 12], ['rightLeg', 5], ['leftLeg', 12], ['leftLeg', 5]]
      for (const [part, y] of limbs) {
        const [lo, hi] = FRAME[part]
        const covers = boxes.some((b) => b.part === part && b.from[1] <= y && b.to[1] >= y && b.from[0] === lo[0] && b.to[0] === hi[0] && b.from[2] === lo[2] && b.to[2] === hi[2])
        expect(covers, `${part} y=${y}`).toBe(true)
      }
    })

    test(`${n} ${ch.name}: 팔은 팔꿈치(18), 다리는 무릎(8)에서 상자를 나눔`, () => {
      for (const b of boxes) {
        const cut = b.part.endsWith('Arm') ? 18 : b.part.endsWith('Leg') ? 8 : null
        if (cut !== null) expect(b.from[1] < cut && b.to[1] > cut, `${b.part} ${b.from}`).toBe(false)
      }
    })

    test(`${n} ${ch.name}: 장식은 틀 밖으로 1블록까지, 모자는 챙 ±3과 높이 32까지, 몸 장식은 높이 15 위`, () => {
      for (const b of boxes) {
        const [lo, hi] = FRAME[b.part]
        if (b.part === 'head') expect(inside(b, [-3, lo[1] - 1, -3], [3, 32, 3]), `${b.part} ${b.from}`).toBe(true)
        else expect(inside(b, [lo[0] - 1, lo[1] - 1, lo[2] - 1], [hi[0] + 1, hi[1] + 1, hi[2] + 1]), `${b.part} ${b.from}`).toBe(true)
        if (b.part === 'body') expect(b.from[1]).toBeGreaterThanOrEqual(15)
      }
    })

    test(`${n} ${ch.name}: 핵심 파츠(key) 상자가 있고 모두 한 색 (SHEEP-118에서 이 색만 바꿈)`, () => {
      const keys = boxes.filter((b) => b.key)
      expect(keys.length).toBeGreaterThan(0)
      expect(new Set(keys.map((b) => b.color)).size).toBe(1)
    })

    test(`${n} ${ch.name}: 색이 다른 상자가 같은 면에서 겹치지 않음 (겹치면 얼룩져 보임)`, () => {
      const overlap = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], i: number) => Math.min(b[i], d[i]) - Math.max(a[i], c[i]) > 1e-9
      for (const [i, a] of boxes.entries())
        for (const b of boxes.slice(i + 1)) {
          if (a.color === b.color) continue
          for (let k = 0; k < 3; k++) {
            const [p, q] = [0, 1, 2].filter((j) => j !== k)
            const shared = a.from[k] === b.from[k] || a.to[k] === b.to[k]
            expect(shared && overlap(a.from, a.to, b.from, b.to, p) && overlap(a.from, a.to, b.from, b.to, q), `${a.from} ${b.from} axis ${k}`).toBe(false)
          }
        }
    })
  }
})

// 사일러스(2번)는 셔츠, 찰스(0번)는 목수건, 로사(1번)는 솜브레로가 핵심 파츠 (시스템 기획서 캐릭터 핵심 파츠)
const SILAS = 2
const RED = 0
const SKY = 1
const GREEN = 2
const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

describe('bartenderBody (SHEEP-139)', () => {
  test('술집 주인은 손님과 같은 틀의 블록 사람이고 모자가 없음', () => {
    const body = bartenderBody()
    const top = Math.max(...body.rest.boxes.flatMap(corners).map((c) => c[1]))
    // 머리 위 30블록에 기름 바른 머리(0.25블록)만 얹음
    expect(top).toBeGreaterThan(30)
    expect(top).toBeLessThan(30.5)
  })

  test('잔 닦기: 왼손에 잔, 오른손에 행주를 들어 가슴 앞에 모으고 총은 없음', () => {
    const body = bartenderBody()
    const wipe = body.wipe(0)
    expect(wipe.gun).toEqual([])
    expect(wipe.boxes.length).toBe(body.rest.boxes.length + 2)
    const [glass, rag] = wipe.boxes.slice(-2)
    for (const b of [glass, rag]) {
      expect(b.c[1]).toBeGreaterThan(14)
      expect(b.c[1]).toBeLessThan(24)
      // 몸 앞(+z)
      expect(b.c[2]).toBeGreaterThan(1.5)
    }
  })

  test('잔 닦기에서 행주는 원을 그리며 움직이고 잔은 그대로', () => {
    const body = bartenderBody()
    const [glass0, rag0] = body.wipe(0).boxes.slice(-2)
    const [glass1, rag1] = body.wipe(225).boxes.slice(-2)
    expect(glass1.c).toEqual(glass0.c)
    expect(Math.hypot(rag1.c[0] - rag0.c[0], rag1.c[1] - rag0.c[1], rag1.c[2] - rag0.c[2])).toBeGreaterThan(0.2)
  })
})

describe('brimOf (SHEEP-159)', () => {
  test('모자 상자 가운데 얼굴보다 가장 앞으로 나온 것의 색과 나온 길이(블록)', () => {
    // 찰스(0번)의 챙은 얼굴(머리 앞면 1.75)보다 1.25블록 앞으로 나온 갈색
    expect(brimOf(0)).toEqual({ color: '#8b5a2b', overhang: 1.25 })
    // 벨(3번)의 챙은 0.35블록만 나옴
    expect(brimOf(3)?.overhang).toBeCloseTo(0.35)
  })

  test('모자가 핵심 파츠면 사람 색, 사람 색을 모르면 모자 색', () => {
    // 케이트(6번)의 모자는 핵심 파츠
    expect(brimOf(6, 2)?.color).toBe(keyColor(6, 2))
    expect(brimOf(6)?.color).toBe('#efe6d2')
  })

  test('캐릭터 8명 모두 모자 챙이 있음', () => {
    for (let i = 0; i < CHARACTERS.length; i++) expect(brimOf(i)).not.toBeNull()
  })
})

describe('keyColor', () => {
  test('핵심 파츠는 사람 색으로 칠하고, 하늘은 몸통일 때만 짙은 파랑 (SHEEP-118)', () => {
    expect(keyColor(SILAS, RED)).toBe('#d83a3a')
    expect(keyColor(SILAS, SKY)).toBe('#2a6ab8')
    expect(keyColor(0, SKY)).toBe('#4fb3e8')
    expect(keyColor(1, SKY)).toBe('#4fb3e8')
  })
})

describe('portraitPixels', () => {
  test('64×64 RGBA이고 바깥은 투명', () => {
    const px = portraitPixels(SILAS)
    expect(px).toHaveLength(PORTRAIT_SIZE * PORTRAIT_SIZE * 4)
    expect(px[3]).toBe(0)
  })

  test('색을 바꾸면 핵심 파츠 자리만 다시 칠하고 나머지는 그대로 (SHEEP-118)', () => {
    const red = portraitPixels(SILAS, RED)
    const green = portraitPixels(SILAS, GREEN)
    let changed = 0
    for (let p = 0; p < red.length; p += 4) {
      if (red[p] === green[p] && red[p + 1] === green[p + 1] && red[p + 2] === green[p + 2]) continue
      changed++
      // 바뀐 칸은 빨강과 초록의 명암이라 그 색이 가장 셈
      expect(red[p]).toBeGreaterThan(Math.max(red[p + 1], red[p + 2]))
      expect(green[p + 1]).toBeGreaterThan(Math.max(green[p], green[p + 2]))
    }
    // 셔츠가 가슴 아래를 채움. 목수건(하늘)은 바뀌지 않음
    expect(changed).toBeGreaterThan(100)
  })

  test('색을 주지 않으면 캐릭터 JSON의 핵심 파츠 색 그대로', () => {
    expect(portraitPixels(SILAS)).toEqual(portraitPixels(SILAS, undefined))
    expect(portraitPixels(SILAS)).not.toEqual(portraitPixels(SILAS, RED))
  })
})

describe('characterBody 핵심 파츠 색', () => {
  test('key 상자만 사람 색으로 칠하고, 색을 주지 않으면 JSON 색 그대로 (SHEEP-118)', () => {
    const keys = CHARACTERS[SILAS].boxes.filter((b) => b.key).length
    const red = hexRgb('#d83a3a')
    const isRed = (b: { rgb: readonly number[] }) => b.rgb.every((v, i) => v === red[i])
    expect(characterBody(SILAS, RED).rest.boxes.filter(isRed)).toHaveLength(keys)
    expect(characterBody(SILAS).rest.boxes.filter(isRed)).toHaveLength(0)
    expect(characterBody(SILAS, RED)).toBe(characterBody(SILAS, RED))
  })
})

describe('savedCharacter', () => {
  test('기억한 번호가 캐릭터 번호면 그 번호, 없거나 틀리면 처음 캐릭터 0 (시스템 기획서 캐릭터 고르기)', () => {
    expect(savedCharacter(String(CHARACTERS.length - 1))).toBe(CHARACTERS.length - 1)
    expect(savedCharacter(null)).toBe(0)
    expect(savedCharacter('')).toBe(0)
    expect(savedCharacter('-1')).toBe(0)
    expect(savedCharacter('0.5')).toBe(0)
    expect(savedCharacter('찰스')).toBe(0)
    expect(savedCharacter(String(CHARACTERS.length))).toBe(0)
  })
})

describe('savedColor', () => {
  test('기억한 번호가 사람 색 번호면 그 번호, 없거나 틀리면 null이라 보내지 않음 (SHEEP-118)', () => {
    expect(savedColor('7')).toBe(7)
    expect(savedColor('0')).toBe(0)
    expect(savedColor(null)).toBeNull()
    expect(savedColor('')).toBeNull()
    expect(savedColor('8')).toBeNull()
    expect(savedColor('-1')).toBeNull()
    expect(savedColor('1.5')).toBeNull()
  })
})

describe('characterBody', () => {
  const body = characterBody(0)
  const rest = body.rest
  // 총 꼭짓점들의 i축 범위(블록)
  const gunSpan = (pose: Pose, i: number) => [Math.min(...pose.gun.map((p) => p[i])), Math.max(...pose.gun.map((p) => p[i]))]
  // 찰스 상자 중 part이고 가운데가 높이 below(블록) 아래인 것. 동작마다 상자 순서는 JSON 그대로
  const pick = (pose: Pose, part: string, below: number) =>
    pose.boxes.filter((_, i) => {
      const b = CHARACTERS[0].boxes[i]
      return b.part === part && (b.from[1] + b.to[1]) / 2 < below
    })
  // 상자들의 가장 앞(z, 블록)
  const front = (boxes: readonly Box[]) => Math.max(...boxes.flatMap((b) => corners(b).map((p) => p[2])))
  // 두 모습의 상자 가운데가 같은지
  const same = (a: Pose, b: Pose) => a.boxes.forEach((box, i) => box.c.forEach((v, j) => expect(v).toBeCloseTo(b.boxes[i].c[j], 6)))

  test('틀 그대로 서면 발이 바닥, 모자를 뺀 머리 꼭대기가 0.9칸이고 머리 폭이 틀 그대로', () => {
    near(span(rest.boxes, 1)[0], 0)
    const head = holding(rest.boxes, [0, 28, 0])
    expect(head).toHaveLength(1)
    const [bottom, top] = span(head, 1)
    near(bottom, 26 * CELL)
    near(top, 0.9)
    near(span(head, 0)[1], 1.5 * CELL)
  })

  test('몸과 팔을 합친 폭이 틀의 팔 바깥(±5블록)', () => {
    const [left, right] = span(rest.boxes.filter((b) => b.c[1] > 12 && b.c[1] < 25), 0)
    near(left, -5 * CELL)
    near(right, 5 * CELL)
  })

  test('앉으면 엉덩이 높이 그대로 허벅지가 앞으로 눕고, 정강이는 무릎에서 내려와 발이 엉덩이 높이 아래 8블록 (SHEEP-115)', () => {
    const sit = body.sit
    const thighs = pick(sit, 'rightLeg', 16).filter((b) => b.half[1] === 4)
    expect(thighs).toHaveLength(1)
    // 허벅지 아래는 바 의자 방석 높이(14.75블록), 앞으로 무릎까지 8블록
    near(span(thighs, 1)[0], 14.75 * CELL)
    near(span(thighs, 2)[1], 8 * CELL)
    near(span(pick(sit, 'leftLeg', 16), 1)[0], 8 * CELL)
    // 몸통과 머리는 서 있을 때와 같은 자리
    expect(holding(sit.boxes, [0, 28, 0])).toHaveLength(1)
    // 아래팔은 앞으로 뻗어 카운터 높이(19블록) 언저리
    const hands = pick(sit, 'rightArm', 13.5)
    near(span(hands, 1)[1], 19 * CELL)
    expect(front(hands)).toBeGreaterThan(8)
  })

  test('같은 캐릭터는 한 번만 만듦', () => {
    expect(characterBody(0)).toBe(body)
  })

  test('틀 그대로 서면 총이 오른쪽 허벅지 권총집에 꽂히고 손잡이가 위로 나옴', () => {
    const [x0, x1] = gunSpan(rest, 0)
    expect(x0).toBeGreaterThan(2.5)
    expect(x1).toBeLessThan(3.75)
    const [y0, y1] = gunSpan(rest, 1)
    expect(y0).toBeGreaterThan(8.5)
    expect(y1).toBeGreaterThan(12)
  })

  test('서 있으면 숨 쉬듯 조금씩 움직이지만 발은 바닥, 머리는 틀 언저리, 총은 권총집 (시스템 기획서 캐릭터 동작)', () => {
    expect(body.stand(1000).boxes).not.toEqual(body.stand(0).boxes)
    for (let t = 0; t < 3000; t += 250) {
      const stand = body.stand(t)
      near(span(stand.boxes, 1)[0], 0)
      expect(Math.abs(span(stand.boxes, 1)[1] - span(rest.boxes, 1)[1])).toBeLessThan(1.5 * CELL)
      expect(Math.abs(gunSpan(stand, 0)[0] - gunSpan(rest, 0)[0])).toBeLessThan(1)
    }
  })

  test('걸으면 걸음(발소리)마다 다리가 번갈아 가장 앞에 오고, 두 걸음마다 되풀이함 (시스템 기획서 캐릭터 동작)', () => {
    expect(front(pick(body.walk(0), 'rightLeg', 3))).toBeGreaterThan(front(pick(body.walk(0), 'leftLeg', 3)) + 2)
    expect(front(pick(body.walk(STEP_MS), 'leftLeg', 3))).toBeGreaterThan(front(pick(body.walk(STEP_MS), 'rightLeg', 3)) + 2)
    same(body.walk(2 * STEP_MS), body.walk(0))
    same(body.walk(5 * STEP_MS + 120), body.walk(STEP_MS + 120))
  })

  test('D로 뽑으면 권총집 옆 손에서 DRAW_MS 동안 겨눈 모습으로 들고, 그 뒤로는 겨눈 모습 (SHEEP-123)', () => {
    same(body.draw(DRAW_MS, 0.2), body.aim(0.2))
    expect(body.draw(DRAW_MS + 500, 0.2).gun).toEqual(body.aim(0.2).gun)
    // 처음에는 총이 권총집 높이에 있고(총구가 아래), 뽑는 동안 올라와 앞으로 나옴
    const low = gunSpan(body.draw(0, 0), 1)[1]
    expect(low).toBeLessThan(gunSpan(body.aim(0), 1)[0])
    expect(gunSpan(body.draw(DRAW_MS / 2, 0), 2)[1]).toBeGreaterThan(gunSpan(body.draw(0, 0), 2)[1])
    expect(gunSpan(body.draw(DRAW_MS / 2, 0), 2)[1]).toBeLessThan(gunSpan(body.aim(0), 2)[1])
  })

  test('카운트다운에 권총집에서 총을 꺼내 배 앞에서 한 발 넣고 다시 권총집에 넣음 (SHEEP-121)', () => {
    const middle = body.reload(RELOAD_AT + RELOAD_MS / 2)
    // 장전하는 동안 총은 몸 앞으로 나오고, 실린더 칸의 총알까지 그림
    expect(gunSpan(middle, 2)[1]).toBeGreaterThan(gunSpan(rest, 2)[1] + 4)
    expect(middle.faces!.length).toBeGreaterThan(revolverMesh(revolverData as Rig, [], 0).faces.length)
    // 꺼내기 전과 다 넣은 뒤는 쉰 자세 그대로
    same(body.reload(-1), rest)
    same(body.reload(RELOAD_END), rest)
    expect(body.reload(RELOAD_END).gun).toEqual(rest.gun)
    // 꺼내고 넣는 동안 총이 몸 앞으로 나왔다 들어감
    expect(gunSpan(body.reload(RELOAD_AT / 2), 2)[1]).toBeGreaterThan(gunSpan(rest, 2)[1])
    expect(gunSpan(body.reload(RELOAD_END - 1), 2)[1]).toBeLessThan(gunSpan(middle, 2)[1])
    for (let t = 0; t < RELOAD_END; t += 250) near(span(body.reload(t).boxes, 1)[0], 0)
  })

  test('뒤도는 동안 제자리에서 두 발을 번갈아 떼었다 놓고, 처음과 끝은 곧게 섬 (SHEEP-120)', () => {
    const lowest = (boxes: readonly Box[]) => Math.min(...boxes.flatMap((b) => corners(b).map((p) => p[1])))
    const lifted = (t: number) => [lowest(pick(body.turn(t), 'rightLeg', 3)), lowest(pick(body.turn(t), 'leftLeg', 3))]
    for (const t of [0, TURN_MS]) same(body.turn(t), body.turn(0))
    for (const t of [0, TURN_MS]) for (const y of lifted(t)) near(y * CELL, 0)
    // 왼발은 앞 절반, 오른발은 뒤 절반에 1블록 넘게 뜸
    const times = Array.from({ length: 17 }, (_, i) => (i * TURN_MS) / 16)
    expect(Math.max(...times.filter((t) => t < TURN_MS / 2).map((t) => lifted(t)[1]))).toBeGreaterThan(1)
    expect(Math.max(...times.filter((t) => t >= TURN_MS / 2).map((t) => lifted(t)[0]))).toBeGreaterThan(1)
    for (const t of times) near(span(body.turn(t).boxes, 1)[0], 0)
  })

  test('걸으면 발이 바닥에 닿고 권총집의 총이 허벅지를 따라 움직임', () => {
    for (let t = 0; t < 2 * STEP_MS; t += STEP_MS / 8) near(span(body.walk(t).boxes, 1)[0], 0)
    expect(body.walk(0).gun).not.toEqual(body.walk(STEP_MS).gun)
  })

  test('쓰러지면 뒤로 넘어져 바닥에 눕고 끝 자세에 멈춤, 총도 같이 누움 (시스템 기획서 캐릭터 동작)', () => {
    expect(span(body.fall(0).boxes, 1)[1]).toBeGreaterThan(25 * CELL)
    for (let t = 0; t < 3000; t += 100) near(span(body.fall(t).boxes, 1)[0], 0)
    const lying = body.fall(5000)
    same(body.fall(9000), lying)
    expect(span(lying.boxes, 1)[1]).toBeLessThan(10 * CELL)
    expect(span(pick(lying, 'head', 31), 2)[1]).toBeLessThan(-10 * CELL)
    expect(Math.max(...lying.gun.map((p) => p[1]))).toBeLessThan(10)
  })

  test('쓰러지는 동안 총은 오른손에 쥔 채 같이 넘어감: 손잡이가 오른 주먹에 붙어 있음 (SHEEP-119)', () => {
    for (const t of [0, 300, 600, FALL_LAND_MS, 2000, 5000]) {
      const pose = body.fall(t)
      // 오른팔에서 팔꿈치 아래 끝(손)
      const [fist] = pick(pose, 'rightArm', 13.6)
      const gap = Math.min(...pose.gun.map((p) => Math.hypot(p[0] - fist.c[0], p[1] - fist.c[1], p[2] - fist.c[2])))
      expect(gap, `t=${t}`).toBeLessThan(0.8)
    }
  })

  test('맞아 쓰러지면 바닥에 닿을 때 총을 놓쳐 모래 위에 눕힘. 시간 초과(자살)는 끝까지 쥠 (사용자 결정 2026-11-10, SHEEP-119)', () => {
    const gap = (pose: Pose) => {
      const [fist] = pick(pose, 'rightArm', 13.6)
      return Math.min(...pose.gun.map((p) => Math.hypot(p[0] - fist.c[0], p[1] - fist.c[1], p[2] - fist.c[2])))
    }
    // 닿기 전에는 쥐고 있음
    for (const t of [0, FALL_LAND_MS / 2, FALL_LAND_MS - 50]) expect(gap(body.fall(t, true)), `t=${t}`).toBeLessThan(0.8)
    // 닿은 뒤에는 바닥에 옆으로 누운 총. 가장 낮은 곳이 바닥이고 두께만큼만 솟음
    for (const t of [FALL_LAND_MS + 50, 2000, 5000]) {
      const ys = body.fall(t, true).gun.map((p) => p[1])
      near(Math.min(...ys) * CELL, 0)
      expect(Math.max(...ys), `t=${t}`).toBeLessThan(1.2)
    }
    // 자살은 누운 뒤에도 손에 쥐고 있음
    expect(gap(body.fall(5000, false))).toBeLessThan(0.8)
  })

  test('넘어지다 바닥에 닿는 때(FALL_LAND_MS)는 0.5~1.5초 뒤이고, 그 앞은 몸통이 아직 높고 그때는 몸통이 낮음', () => {
    expect(FALL_LAND_MS).toBeGreaterThan(500)
    expect(FALL_LAND_MS).toBeLessThan(1500)
    const torsoTop = (ms: number) => span(pick(body.fall(ms), 'body', 99), 1)[1]
    expect(torsoTop(FALL_LAND_MS - 300)).toBeGreaterThan(18 * CELL)
    expect(torsoTop(FALL_LAND_MS)).toBeLessThan(12 * CELL)
  })

  // 가장 앞으로 나온 총 꼭짓점(총구)의 높이(블록)
  const muzzle = (pose: Pose) => pose.gun.reduce((a, b) => (b[2] > a[2] ? b : a))

  test('겨누면 총이 앞으로 나오고, 위를 보면 총구가 높고 아래를 보면 낮음 (시스템 기획서 조작 다른 사람의 위아래 시선)', () => {
    expect(muzzle(body.aim(0))[2]).toBeGreaterThan(14)
    const height = (pitch: number) => muzzle(body.aim(pitch))[1]
    expect(height(0.5)).toBeGreaterThan(height(0) + 3)
    expect(height(-0.5)).toBeLessThan(height(0) - 3)
  })

  test('쏘면 팔이 들리고 총구 앞에 불꽃 상자가 더해짐', () => {
    for (const pitch of [-0.5, 0, 0.5]) {
      const fire = body.fire(pitch)
      const aim = body.aim(pitch)
      expect(fire.boxes.length).toBe(aim.boxes.length + 1)
      expect(fire.boxes.slice(0, -1)).not.toEqual(aim.boxes)
      expect(muzzle(fire)[1]).toBeGreaterThan(muzzle(aim)[1])
    }
  })

  test('정면을 보면 머리가 틀 그대로 섰을 때와 같은 자리', () => {
    expect(holding(body.aim(0).boxes, [0, 28, 0])).toEqual(holding(rest.boxes, [0, 28, 0]))
  })

  test('위를 보면 머리가 들려 모자 꼭대기가 뒤로, 아래를 보면 앞으로 감', () => {
    // 가장 높은 상자(모자 꼭대기)의 앞뒤 자리(블록)
    const crown = (pitch: number) => body.aim(pitch).boxes.reduce((a, b) => (b.c[1] > a.c[1] ? b : a)).c[2]
    expect(crown(0)).toBeCloseTo(0)
    expect(crown(0.5)).toBeLessThan(-2)
    expect(crown(-0.5)).toBeGreaterThan(2)
  })

  test('자살 모습은 총구를 오른쪽 관자놀이에 대고, 다음 단계에 불꽃이 더해짐', () => {
    const [aim, flash] = body.suicide
    // 머리 오른쪽 면(x 1.5) 가까이, 눈 높이 언저리에 총구가 닿음
    const tip = aim.gun.reduce((a, b) => (b[0] < a[0] ? b : a))
    expect(tip[0]).toBeGreaterThan(1.3)
    expect(tip[0]).toBeLessThan(2)
    expect(tip[1]).toBeGreaterThan(27)
    expect(tip[1]).toBeLessThan(30)
    expect(flash.boxes.length).toBe(aim.boxes.length + 1)
  })

})

describe('characterBody 왼손 (SHEEP-133)', () => {
  const right = characterBody(0)
  const left = characterBody(0, undefined, 'left')
  const mirror = (p: V): V => [-p[0], p[1], p[2]]
  // 총 꼭짓점의 가운데(블록)
  const middle = (pose: Pose): V => {
    const sum = (i: number) => pose.gun.reduce((s, p) => s + p[i], 0) / pose.gun.length
    return [sum(0), sum(1), sum(2)]
  }
  const close = (got: V, want: V, tolerance: number) => got.forEach((v, i) => expect(Math.abs(v - want[i]), `축 ${i}`).toBeLessThan(tolerance))
  // 오른 허벅지 바깥의 권총집 상자 (x 2.75~3.5, y 8.5~12)
  const isHolster = (b: (typeof CHARACTERS)[number]['boxes'][number]) => b.part === 'rightLeg' && `${b.from}` === '2.75,8.5,-1' && `${b.to}` === '3.5,12,1'
  const holster = CHARACTERS[0].boxes.findIndex(isHolster)
  // 찰스 상자 중 part인 것. 동작마다 상자 순서는 JSON 그대로이고, 불꽃 상자는 맨 뒤에 더해짐
  const part = (pose: Pose, name: string) => pose.boxes.filter((_, i) => CHARACTERS[0].boxes[i]?.part === name)

  test('모든 캐릭터에 권총집 상자가 오른 허벅지에 하나씩 있음', () => {
    for (const ch of CHARACTERS) expect(ch.boxes.filter(isHolster).length, ch.name).toBe(1)
  })

  test('캐릭터, 색, 손마다 한 번만 만듦', () => {
    expect(characterBody(0, undefined, 'left')).toBe(left)
    expect(left).not.toBe(right)
    expect(characterBody(0, undefined, 'right')).toBe(right)
  })

  test('서거나 앉으면 권총집 상자와 꽂힌 총이 왼쪽 허벅지로 거울처럼 옮겨지고, 다른 상자는 그대로', () => {
    for (const [r, l] of [[right.rest, left.rest], [right.sit, left.sit]]) {
      close(l.boxes[holster].c, mirror(r.boxes[holster].c), 1e-9)
      l.boxes.forEach((b, i) => i === holster || expect(b.c).toEqual(r.boxes[i].c))
      close(middle(l), mirror(middle(r)), 0.3)
    }
  })

  test('겨누기, 쏘기, 자살은 왼팔로 해 총과 왼팔이 오른손 몸의 좌우 거울 자리', () => {
    const pairs: [Pose, Pose][] = [[right.aim(0.3), left.aim(0.3)], [right.fire(-0.2), left.fire(-0.2)], [right.suicide[0], left.suicide[0]], [right.suicide[1], left.suicide[1]]]
    for (const [r, l] of pairs) {
      close(middle(l), mirror(middle(r)), 0.3)
      part(l, 'leftArm').forEach((b, i) => close(b.c, mirror(part(r, 'rightArm')[i].c), 1e-9))
      // 총을 들지 않은 팔은 내린 그대로
      expect(part(l, 'rightArm').map((b) => b.c)).toEqual(part(left.rest, 'rightArm').map((b) => b.c))
    }
    // 불꽃 상자도 거울 자리
    for (const [r, l] of [[right.fire(0), left.fire(0)], [right.suicide[1], left.suicide[1]]]) close(l.boxes.at(-1)!.c, mirror(r.boxes.at(-1)!.c), 1e-9)
  })

  test('자살 모습은 총구를 왼쪽 관자놀이에 댐', () => {
    const tip = left.suicide[0].gun.reduce((a, b) => (b[0] > a[0] ? b : a))
    expect(tip[0]).toBeLessThan(-1.3)
    expect(tip[0]).toBeGreaterThan(-2)
  })

  test('쓰러지는 동안 총은 왼손에 쥠. 맞으면 바닥에 닿을 때 왼손 옆에 놓침', () => {
    const gap = (pose: Pose, p: V) => Math.min(...pose.gun.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])))
    // 왼팔에서 팔꿈치 아래 끝(손)
    const fist = (pose: Pose) => part(pose, 'leftArm').find((b) => b.half[1] === 0.75)!.c
    for (const t of [0, 300, 600, FALL_LAND_MS, 2000, 5000]) expect(gap(left.fall(t), fist(left.fall(t))), `t=${t}`).toBeLessThan(0.8)
    // 놓친 총은 바닥에 닿기 직전 왼 주먹 아래 모래 위에 있음
    const before = fist(left.fall(FALL_LAND_MS - 1, true))
    expect(gap(left.fall(FALL_LAND_MS + 50, true), [before[0], 0, before[2]])).toBeLessThan(1.5)
  })
})

describe('총구와 inWorld (SHEEP-124)', () => {
  test('겨누거나 쏘면 총구 자리를 알려 주고, 그 자리는 가장 앞으로 나온 총 꼭짓점 언저리', () => {
    const body = characterBody(0)
    for (const pose of [body.aim(0), body.fire(0.2)]) {
      const tip = pose.gun.reduce((a, b) => (b[2] > a[2] ? b : a))
      expect(Math.hypot(...pose.muzzle!.map((v, i) => v - tip[i]))).toBeLessThan(1)
    }
  })

  test('모델 좌표를 격자 좌표와 높이(칸)로 바꿈: 앞(z)은 바라보는 쪽, 오른쪽(x)은 시계 방향 90°, 위(y)는 높이', () => {
    const near = (got: readonly number[], want: number[]) => got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 9))
    near(inWorld(2, 3, 0, [0, 0, 1 / CELL]), [3, 3, 0])
    near(inWorld(2, 3, 0, [1 / CELL, 0, 0]), [2, 4, 0])
    near(inWorld(2, 3, Math.PI / 2, [0, 10, 1 / CELL]), [2, 4, 10 * CELL])
  })
})

describe('상처 (SHEEP-126)', () => {
  const body = characterBody(0)

  test('toModel은 inWorld를 되돌림', () => {
    const p: [number, number, number] = [3, 20, 2.5]
    const [x, y, h] = inWorld(7, 4, 1.1, p)
    toModel(7, 4, 1.1, x, y, h).forEach((v, i) => expect(v).toBeCloseTo(p[i], 9))
  })

  test('맞은 자리를 가장 가까운 상자 겉면에 붙이고, 그 상자가 움직이면 상처도 따라감', () => {
    // 몸통 앞(z) 바깥 1블록, 높이 20의 점 → 몸통 상자 앞면에 붙음
    const wound = pinWound(body.rest.boxes, [0.5, 20, 2.5])
    const onRest = woundBox(body.rest.boxes, wound)
    const trunk = body.rest.boxes[wound.box]
    expect(Math.abs(onRest.c[2] - (trunk.c[2] + trunk.half[2]))).toBeLessThan(1e-9)
    expect(onRest.c[1]).toBeCloseTo(20, 9)
    // 쓰러진 뒤에는 상자를 따라 낮게 누움
    const fallen = body.fall(5000)
    const onFallen = woundBox(fallen.boxes, wound)
    expect(onFallen.c[1]).toBeLessThan(10)
    expect(Math.hypot(...onFallen.c.map((v, i) => v - fallen.boxes[wound.box].c[i]))).toBeCloseTo(Math.hypot(...onRest.c.map((v, i) => v - trunk.c[i])), 9)
  })

  test('상자 안쪽에 든 점도 가장 가까운 겉면으로 밀어냄', () => {
    const wound = pinWound(body.rest.boxes, [0, 20, 0.2])
    const trunk = body.rest.boxes[wound.box]
    const box = woundBox(body.rest.boxes, wound)
    const faces = box.c.map((v, i) => Math.abs(Math.abs(v - trunk.c[i]) - trunk.half[i]) < 1e-9)
    expect(faces.some(Boolean)).toBe(true)
  })
})

describe('drawFigure', () => {
  const W = 400
  const H = 200
  // 시야 90°면 plane 길이가 1이라 proj가 W/2
  const cam = makeCamera(0, 0, 0, 90)
  const WHITE: RGB = [255, 255, 255]
  const body = characterBody(0)

  function draw(x: number, facing: number, pose = body.rest, zbuf = new Float64Array(W).fill(Infinity), light = WHITE) {
    const pixels = new Uint32Array(W * H)
    drawFigure(pixels, W, H, zbuf, cam, { x, y: 0, facing, ...pose }, light)
    return pixels
  }
  const columns = (pixels: Uint32Array) => [...Array(W).keys()].filter((x) => [...Array(H).keys()].some((y) => pixels[y * W + x] !== 0))
  // 거리 d에서 높이 z(칸)가 그려지는 줄. 눈높이 0.5가 지평선(H/2)
  const rowAt = (z: number, d: number) => H / 2 + ((W / 2) * (0.5 - z)) / d

  test('화면 밖 바로 옆에 선 사람은 그리지 않고 오류도 없음 (SHEEP-134)', () => {
    // 시야 90°라 앞으로 0.2칸이면 옆으로 0.2칸 넘게 비켜선 사람은 화면 밖. 권총집의 총은 화면 안 높이에 있음
    for (const y of [0.5, 1, -0.5, -1]) {
      const pixels = new Uint32Array(W * H)
      expect(() => drawFigure(pixels, W, H, new Float64Array(W).fill(Infinity), cam, { x: 0.2, y, facing: Math.PI, ...body.rest }, WHITE)).not.toThrow()
      expect(pixels.every((c) => c === 0)).toBe(true)
    }
  })

  test('나를 보면 얼굴에 눈이 보이고, 등지면 안 보임', () => {
    const d = 2 - 1.75 * CELL
    const dark = (pixels: Uint32Array) => {
      for (let y = Math.ceil(rowAt(28.5 * CELL, d)); y < rowAt(27.5 * CELL, d); y++)
        for (let x = 0; x < W; x++) {
          const c = pixels[y * W + x]
          if (c !== 0 && Math.max(c & 255, (c >> 8) & 255, (c >> 16) & 255) < 40) return true
        }
      return false
    }
    expect(dark(draw(2, Math.PI))).toBe(true)
    expect(dark(draw(2, 0))).toBe(false)
  })

  test('나를 보면 그 사람의 오른쪽 허벅지(권총집)가 화면 왼쪽에 보임', () => {
    const pixels = draw(1.5, Math.PI)
    const y = Math.round(rowAt(10 * CELL, 1.5))
    const cols = [...Array(W).keys()].filter((x) => pixels[y * W + x] !== 0)
    expect(W / 2 - cols[0]).toBeGreaterThan(cols[cols.length - 1] + 1 - W / 2 + 2)
  })

  test('45°마다 끊기지 않고 조금만 돌아도 다르게 보임', () => {
    expect(draw(4, Math.PI + 0.2)).not.toEqual(draw(4, Math.PI))
  })

  test('시계 방향으로 90° 돌면 겨눈 팔이 화면 왼쪽으로 나옴', () => {
    const cols = columns(draw(4, (3 * Math.PI) / 2, body.aim(0)))
    const left = cols.filter((x) => x < W / 2).length
    const right = cols.filter((x) => x >= W / 2).length
    expect(left).toBeGreaterThan(right * 1.2)
  })

  test('정면에 서면 화면 가운데, 발은 벽 아래 끝과 같은 높이', () => {
    const pixels = draw(4, Math.PI)
    const cols = columns(pixels)
    expect(Math.abs((cols[0] + cols[cols.length - 1] + 1) / 2 - W / 2)).toBeLessThanOrEqual(1)
    let bottom = 0
    for (let y = 0; y < H; y++) if (pixels[y * W + W / 2 - 3] !== 0) bottom = y + 1
    expect(Math.abs(bottom - rowAt(0, 4))).toBeLessThanOrEqual(1.5)
  })

  test('권총집의 총은 오른쪽에서 보면 보이고, 왼쪽에서 보면 다리에 가려져 뒤로 나온 손잡이만 보임', () => {
    const bare = { ...body.rest, gun: [] }
    const gunPixels = (facing: number) => {
      const a = draw(2, facing)
      const b = draw(2, facing, bare)
      return a.filter((c, i) => c !== b[i]).length
    }
    // 그 사람의 오른쪽이 나를 봄 (격자 기준 시계 방향 90°가 오른쪽)
    expect(gunPixels(Math.PI / 2)).toBeGreaterThan(gunPixels(-Math.PI / 2) * 3)
  })

  test('결투 거리(7칸)에서 옆으로 겨눈 총이 그려짐', () => {
    const aim = body.aim(0)
    expect(draw(7, Math.PI / 2, aim)).not.toEqual(draw(7, Math.PI / 2, { ...aim, gun: [] }))
  })

  test('벽이 더 가까운 가로줄에는 그리지 않음', () => {
    const zbuf = new Float64Array(W).fill(Infinity).fill(2, 0, W / 2)
    const cols = columns(draw(4, Math.PI, body.rest, zbuf))
    expect(cols.length).toBeGreaterThan(0)
    expect(cols[0]).toBe(W / 2)
  })

  test('카메라 뒤에 있으면 그리지 않음', () => {
    expect(columns(draw(-4, 0))).toEqual([])
  })

  test('빛 색조를 곱해 칠함', () => {
    const pixels = draw(4, Math.PI / 2, body.aim(0), undefined, [255, 255, 0])
    const drawn = pixels.filter((c) => c !== 0)
    expect(drawn.length).toBeGreaterThan(0)
    for (const c of drawn) expect((c >> 16) & 255).toBe(0)
  })
})

describe('suicideStage', () => {
  test('총을 머리에 댄 뒤 불꽃, 그다음 쓰러진 모습', () => {
    expect(suicideStage(0)).toBe(0)
    expect(suicideStage(SUICIDE_AIM - 1)).toBe(0)
    expect(suicideStage(SUICIDE_AIM)).toBe(1)
    expect(suicideStage(SUICIDE_AIM + SUICIDE_FLASH - 1)).toBe(1)
    expect(suicideStage(SUICIDE_AIM + SUICIDE_FLASH)).toBeNull()
  })
})
