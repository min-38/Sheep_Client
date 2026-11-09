import { describe, expect, test } from 'vitest'
import { PAPER_GRAIN, PAPER_INK, paperMask, paperRim, paperStains } from './paper.ts'

// CSS url("data:image/svg+xml,…")에서 SVG 글을 꺼냄
const svgOf = (css: string) => {
  const m = css.match(/^url\("data:image\/svg\+xml,(.*)"\)$/)
  expect(m).not.toBeNull()
  return decodeURIComponent(m![1])
}

// 종이 모양을 흔드는 부분: 잡음, 흔드는 세기, 깎을 모양
const shapeOf = (svg: string) => ({
  noise: svg.match(/<feTurbulence[^>]*result='n'\/>/)![0],
  shake: svg.match(/<feDisplacementMap[^>]*\/>/)![0],
  outline: svg.match(/points='([^']*)'/)![1],
})

describe('paperMask와 paperRim', () => {
  test('같은 seed면 같은 잡음으로 같은 모양을 깎아 탄 테두리가 깎인 가장자리를 따라감', () => {
    const mask = shapeOf(svgOf(paperMask(7)))
    const rim = svgOf(paperRim(7))
    const outlines = [...rim.matchAll(/points='([^']*)'/g)].map((m) => m[1])
    expect(outlines.length).toBeGreaterThan(0)
    for (const outline of outlines) expect(outline).toBe(mask.outline)
    expect(rim).toContain(mask.noise)
    expect(rim).toContain(mask.shake)
  })

  test('seed가 다르면 가장자리가 다름', () => {
    expect(paperMask(1)).not.toBe(paperMask(2))
    expect(paperRim(1)).not.toBe(paperRim(2))
  })
})

describe('paperStains', () => {
  test('seed가 다르면 얼룩이 다름', () => {
    expect(paperStains(1)).not.toBe(paperStains(2))
  })
})

describe('CSS 값', () => {
  test('모두 SVG 한 장을 담은 url()', () => {
    for (const css of [PAPER_GRAIN, PAPER_INK, paperMask(3), paperRim(3), paperStains(3)]) {
      expect(svgOf(css)).toMatch(/^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg'.*<\/svg>$/)
    }
  })
})
