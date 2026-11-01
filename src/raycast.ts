// 격자는 [y][x]. 0은 빈칸, 1 이상은 벽
export type Grid = number[][]

export type Hit = {
  mapX: number
  mapY: number
  // 0: x 경계(세로 면)에 닿음, 1: y 경계(가로 면)에 닿음
  side: 0 | 1
  // 카메라 평면까지의 수직 거리. 광선 길이를 쓰면 화면 가장자리 벽이 휘어 보임(어안)
  dist: number
}

// DDA: 광선을 격자 경계 하나씩 전진시켜 처음 닿는 벽 칸을 찾음.
// ray는 정규화하지 않은 dir + plane·camX여야 dist가 수직 거리가 됨
export function castRay(grid: Grid, posX: number, posY: number, rayX: number, rayY: number): Hit | null {
  let mapX = Math.floor(posX)
  let mapY = Math.floor(posY)
  const deltaX = rayX === 0 ? Infinity : Math.abs(1 / rayX)
  const deltaY = rayY === 0 ? Infinity : Math.abs(1 / rayY)
  const stepX = rayX < 0 ? -1 : 1
  const stepY = rayY < 0 ? -1 : 1
  let sideX = rayX === 0 ? Infinity : (rayX < 0 ? posX - mapX : mapX + 1 - posX) * deltaX
  let sideY = rayY === 0 ? Infinity : (rayY < 0 ? posY - mapY : mapY + 1 - posY) * deltaY
  let side: 0 | 1 = 0

  for (;;) {
    if (sideX < sideY) {
      sideX += deltaX
      mapX += stepX
      side = 0
    } else {
      sideY += deltaY
      mapY += stepY
      side = 1
    }
    const row = grid[mapY]
    // 테두리가 열린 맵에서 무한 루프 방지
    if (row === undefined || mapX < 0 || mapX >= row.length) return null
    if (row[mapX] > 0) return { mapX, mapY, side, dist: side === 0 ? sideX - deltaX : sideY - deltaY }
  }
}
