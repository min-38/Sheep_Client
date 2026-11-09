// 탄 수 HUD의 리볼버 실린더 (시스템 기획서 HUD 탄 수). 뒤에서 본 블루드 강철 실린더를 SVG(viewBox 0..100)로 그림.
// 칸 사이 홈(플루트)이 바깥 윤곽을 오목하게 파고, 모서리는 빛(왼쪽 위)을 받는 쪽과 그늘진 쪽을 그라데이션 테로 그려 입체를 냄

export const CHAMBERS = 6
// 실린더 반지름, 칸 중심이 도는 반지름, 칸 반지름
export const RADIUS = 46
export const BORE = 28
export const CHAMBER_RADIUS = 11
// 홈은 중심에서 FLUTE_DISTANCE 떨어진 반지름 FLUTE_RADIUS 원으로 바깥 원을 파낸 자리
export const FLUTE_DISTANCE = 54.5
export const FLUTE_RADIUS = 10.5
// ms. 쏘고 실린더가 한 칸 도는 시간. 1인칭 총의 Fire 클립(revolver-rig.json)에서 실린더가 도는 시간과 같음
export const CYLINDER_TURN = 125

const f = (n: number) => n.toFixed(2)
// 맨 위에서 시계 방향으로 deg도, 중심에서 r 떨어진 점
const at = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180
  return [50 + r * Math.sin(a), 50 - r * Math.cos(a)]
}

// 칸 i의 중심. 0이 맨 위(총열과 맞닿는 칸)이고 쏘는 차례대로 시계 반대 방향.
// 1인칭 총(revolver-rig.json)의 chamber 번호와 같은 자리라, 쏘면 실린더가 시계 방향으로 돌아 다음 칸이 맨 위로 옴
export const chamberAt = (i: number) => at(BORE, -60 * i)

// 홈 6개가 파인 바깥 윤곽. 홈 원과 바깥 원이 만나는 각을 구해 바깥 호와 오목한 홈 호를 번갈아 이음.
// 홈은 칸과 칸 사이(30°, 90°, …)
export function outline(): string {
  const half =
    (Math.acos((RADIUS ** 2 + FLUTE_DISTANCE ** 2 - FLUTE_RADIUS ** 2) / (2 * RADIUS * FLUTE_DISTANCE)) * 180) / Math.PI
  let d = ''
  for (let k = 0; k < CHAMBERS; k++) {
    const [ax, ay] = at(RADIUS, 30 + 60 * k - half)
    const [bx, by] = at(RADIUS, 30 + 60 * k + half)
    d += `${k === 0 ? 'M' : `A${RADIUS} ${RADIUS} 0 0 1 `}${f(ax)} ${f(ay)}`
    d += `A${FLUTE_RADIUS} ${FLUTE_RADIUS} 0 0 0 ${f(bx)} ${f(by)}`
  }
  const [x, y] = at(RADIUS, 30 - half)
  return `${d}A${RADIUS} ${RADIUS} 0 0 1 ${f(x)} ${f(y)}Z`
}

// 가운데 래칫(톱니 6개). 공이치기가 미는 쪽은 곧고 반대쪽은 비스듬함
export function ratchet(): string {
  let d = ''
  for (let i = 0; i < CHAMBERS; i++) {
    const a = i * 60 + 15
    const points = [at(10.5, a + 6), at(9, a + 36), at(5.6, a + 60)]
    if (i === 0) d += `M${f(at(5.6, a)[0])} ${f(at(5.6, a)[1])}`
    d += points.map(([x, y]) => `L${f(x)} ${f(y)}`).join('')
  }
  return `${d}Z`
}

const circle = ([cx, cy]: [number, number], r: number) =>
  `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`

// 칸 구멍과 축 구멍을 뚫은 쇠 면 (fill-rule evenodd)
export function face(): string {
  return outline() + Array.from({ length: CHAMBERS }, (_, i) => circle(chamberAt(i), CHAMBER_RADIUS)).join('') + circle([50, 50], 2.4)
}

// #ammo 안에 넣을 그림. 칸마다 탄피 바닥(.round)을 두고, main.ts가 장전된 칸에만 loaded를 붙여 보이게 함.
// 쏘면 .spin을 돌림. 빛은 돌지 않는 것처럼 보이게 쉬는 자리에서는 늘 같은 방향으로 그림
export function cylinderSvg(): string {
  const chambers = Array.from({ length: CHAMBERS }, (_, i) => chamberAt(i))
  return `<defs>
  <radialGradient id="cyl-face" cx="38%" cy="34%" r="75%"><stop offset="0" stop-color="#34405a"/><stop offset=".55" stop-color="#151b26"/><stop offset="1" stop-color="#07090d"/></radialGradient>
  <linearGradient id="cyl-sheen" x2="1" y2="1"><stop offset="0" stop-color="#a9c0f2" stop-opacity="0"/><stop offset=".28" stop-color="#a9c0f2" stop-opacity=".32"/><stop offset=".36" stop-color="#a9c0f2" stop-opacity=".05"/><stop offset=".62" stop-color="#a9c0f2" stop-opacity="0"/><stop offset=".7" stop-color="#a9c0f2" stop-opacity=".13"/><stop offset=".78" stop-color="#a9c0f2" stop-opacity="0"/></linearGradient>
  <linearGradient id="cyl-convex" x2="1" y2="1"><stop offset="0" stop-color="#c9d8ff" stop-opacity=".95"/><stop offset=".5" stop-color="#c9d8ff" stop-opacity=".15"/><stop offset=".55" stop-color="#020305" stop-opacity=".3"/><stop offset="1" stop-color="#020305" stop-opacity=".95"/></linearGradient>
  <linearGradient id="cyl-concave" x2="1" y2="1"><stop offset="0" stop-color="#020305" stop-opacity=".95"/><stop offset=".45" stop-color="#020305" stop-opacity=".4"/><stop offset=".6" stop-color="#c9d8ff" stop-opacity=".25"/><stop offset="1" stop-color="#c9d8ff" stop-opacity=".85"/></linearGradient>
  <radialGradient id="cyl-bore" fx="34%" fy="32%"><stop offset="0" stop-color="#000"/><stop offset=".72" stop-color="#040405"/><stop offset=".9" stop-color="#22262c"/><stop offset="1" stop-color="#4a5058"/></radialGradient>
  <radialGradient id="cyl-ratchet" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#2a3446"/><stop offset="1" stop-color="#0b0f15"/></radialGradient>
  <radialGradient id="cyl-brass" cx="38%" cy="33%" r="72%"><stop offset="0" stop-color="#fff0b8"/><stop offset=".3" stop-color="#e9c25c"/><stop offset=".7" stop-color="#b88a2a"/><stop offset="1" stop-color="#6a4b10"/></radialGradient>
  <linearGradient id="cyl-rim" x2="1" y2="1"><stop offset="0" stop-color="#fff6d0"/><stop offset=".5" stop-color="#c79a34"/><stop offset="1" stop-color="#4a3206"/></linearGradient>
  <radialGradient id="cyl-primer" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#d6cfc4"/><stop offset="1" stop-color="#7a7268"/></radialGradient>
  <clipPath id="cyl-clip"><path d="${outline()}"/></clipPath>
  <filter id="cyl-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.6 .25" numOctaves="2" seed="3"/><feColorMatrix type="saturate" values="0"/></filter>
</defs>
<g class="spin">
  ${chambers.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${CHAMBER_RADIUS + 0.4}" fill="url(#cyl-bore)"/>`).join('')}
  <path d="${face()}" fill-rule="evenodd" fill="url(#cyl-face)"/>
  <g clip-path="url(#cyl-clip)">
    <path d="${face()}" fill-rule="evenodd" fill="url(#cyl-sheen)"/>
    <rect width="100" height="100" filter="url(#cyl-grain)" opacity=".1" style="mix-blend-mode:overlay"/>
  </g>
  <path d="${outline()}" fill="none" stroke="url(#cyl-convex)" stroke-width="1.6"/>
  ${chambers.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${CHAMBER_RADIUS - 0.6}" fill="none" stroke="url(#cyl-concave)" stroke-width="1.3"/>`).join('')}
  <path d="${ratchet()}" fill="url(#cyl-ratchet)" stroke="url(#cyl-convex)" stroke-width=".6"/>
  <circle cx="50" cy="50" r="2.4" fill="#010101" stroke="url(#cyl-concave)" stroke-width=".6"/>
  ${chambers.map(([x, y]) => `<g class="round" transform="translate(${f(x)} ${f(y)})">
    <circle r="${CHAMBER_RADIUS + 0.9}" fill="url(#cyl-brass)"/>
    <circle r="${CHAMBER_RADIUS + 0.3}" fill="none" stroke="url(#cyl-rim)" stroke-width="1.2"/>
    <circle r="7.4" fill="none" stroke="#5a3f0c" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="1.1 .7 1.1 .7 1.1 3.5 1.1 .7 1.1 .7 1.1 .7 1.1 9"/>
    <circle r="3.8" fill="#3a2a0c"/>
    <circle r="3.3" fill="url(#cyl-primer)" stroke="url(#cyl-concave)" stroke-width=".4"/>
  </g>`).join('')}
</g>`
}
