// 바랜 종이 질감 (시스템 기획서 HUD 사격 결과 카드, 방 화면 M8 판 끝). 그림 파일 없이 SVG 필터의 잡음(feTurbulence)으로
// 만들어 화면이 커져도 흐려지지 않음. 값은 모두 CSS url()이고 style.css가 --paper-* 변수로 받아 종이 겹에 깖

const url = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

// 종이 한 장 크기의 그림. 종이에 늘여 씌우므로 종이의 가로세로 비가 달라도 됨
const sheet = (body: string) =>
  url(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 270' preserveAspectRatio='none'>${body}</svg>`)

// 흔든 가장자리가 잘리지 않게 필터 칸을 조금 넓힘. 색은 sRGB로 계산해 적은 색 그대로 나옴
const REGION = `x='-6%' y='-6%' width='112%' height='112%' color-interpolation-filters='sRGB'`

// 왼쪽 아래 귀퉁이가 조금 찢겨 나간 종이
const OUTLINE = '2,2 198,2 198,268 30,268 26,263 21,265 17,259 12,261 9,255 4,256 2,250'

// 가장자리를 잡음으로 조금 흔듦. 마스크와 탄 테두리가 같은 seed로 같은 모양을 만들어야 테두리가 깎인 가장자리를 따라감
const shake = (seed: number) =>
  `<feTurbulence type='fractalNoise' baseFrequency='.05' numOctaves='4' seed='${seed}' result='n'/>` +
  `<feDisplacementMap in='SourceGraphic' in2='n' scale='3' xChannelSelector='R' yChannelSelector='G' result='d'/>`

// 탄 자국: 안쪽으로 번진 갈색 그을음과 가장자리의 검게 탄 테. [안쪽으로 줄일 폭, 흐림, 색, 진하기]
const BURNS: readonly [number, number, string, number][] = [
  [11, 8, '#6e3510', 0.75],
  [2.5, 1.4, '#1c0b03', 0.95],
]

// 종이 모양. CSS mask로 씌워 귀퉁이를 떼어 냄
export const paperMask = (seed: number) =>
  sheet(`<filter id='m' ${REGION}>${shake(seed)}</filter><polygon points='${OUTLINE}' fill='#fff' filter='url(#m)'/>`)

// 탄 가장자리. 깎인 모양에서 안쪽으로 줄여 흐린 모양을 빼면 가장자리 띠만 남음
export const paperRim = (seed: number) =>
  sheet(
    BURNS.map(
      ([inset, blur, color, opacity], i) =>
        `<filter id='r${i}' ${REGION}>${shake(seed)}` +
        `<feMorphology in='d' operator='erode' radius='${inset}' result='e'/>` +
        `<feGaussianBlur in='e' stdDeviation='${blur}' result='b'/>` +
        `<feComposite in='d' in2='b' operator='out' result='rim'/>` +
        `<feFlood flood-color='${color}' flood-opacity='${opacity}'/><feComposite in2='rim' operator='in'/></filter>` +
        `<polygon points='${OUTLINE}' filter='url(#r${i})'/>`,
    ).join(''),
  )

// 바랜 얼룩. 잡음이 문턱을 넘는 곳만 칠하고, 문턱 바로 위를 더 진하게 해 물 자국 테를 만듦
export const paperStains = (seed: number) =>
  sheet(
    `<filter id='s' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>` +
      `<feTurbulence type='fractalNoise' baseFrequency='.022 .017' numOctaves='4' seed='${seed}'/>` +
      `<feColorMatrix values='0 0 0 0 .5  0 0 0 0 .31  0 0 0 0 .11  1 0 0 0 0'/>` +
      `<feComponentTransfer><feFuncA type='table' tableValues='0 0 0 0 0 .05 .3 .17 .14 .14'/></feComponentTransfer></filter>` +
      `<rect width='200' height='270' filter='url(#s)'/>`,
  )

// 종이 결: 가로로 긴 어두운 섬유와 밝은 얼룩점. 이어 깔아도 이음매가 없게 stitchTiles
export const PAPER_GRAIN = url(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>` +
    `<filter id='f' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='.9 .22' numOctaves='3' seed='4' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 .3  0 0 0 0 .19  0 0 0 0 .07  .9 0 0 0 -.38'/></filter>` +
    `<filter id='h' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='.45' numOctaves='2' seed='9' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 1  0 0 0 0 .97  0 0 0 0 .87  -1.1 0 0 0 .5'/></filter>` +
    `<rect width='200' height='200' filter='url(#f)'/><rect width='200' height='200' filter='url(#h)'/></svg>`,
)

// 도장 잉크가 종이에 덜 묻어 빠진 자리. CSS mask로 도장에 씌움
export const PAPER_INK = url(
  `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'>` +
    `<filter id='w' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='2' seed='3' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 0 0 0 4.3'/></filter>` +
    `<rect width='100' height='100' filter='url(#w)'/></svg>`,
)

// 종이 한 장에 seed를 정해 질감을 입힘. 종이마다 seed를 달리해 같은 얼룩과 가장자리가 되풀이되지 않게 함.
// 창은 나무 테두리와 못이 있어 얼룩만 입히고 가장자리는 깎거나 태우지 않음
export function dressPaper(el: HTMLElement, seed: number, edges = true) {
  el.style.setProperty('--paper-stains', paperStains(seed))
  if (!edges) return
  el.style.setProperty('--paper-mask', paperMask(seed))
  el.style.setProperty('--paper-rim', paperRim(seed))
}
