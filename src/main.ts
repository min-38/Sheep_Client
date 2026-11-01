import './style.css'
import { MAP } from './map.ts'
import { makeCamera, renderFrame } from './render.ts'
import { turn } from './turn.ts'

// 내부 해상도. 이 크기로 그리고 CSS로 확대함 (기술 설계서 렌더링)
const W = 480
const H = 270
const FOV = 66
// 라디안/px. ponytail: 임시 감도. 시스템 기획서 조작의 감도가 정해지면 그 값으로 바꿈
const SENSITIVITY = 0.003

const canvas = document.querySelector<HTMLCanvasElement>('#screen')!
canvas.width = W
canvas.height = H
const ctx = canvas.getContext('2d')!
const image = ctx.createImageData(W, H)
const pixels = new Uint32Array(image.data.buffer)

// 결투장 가운데에 섬
const x = MAP[0].length / 2
const y = MAP.length / 2
let angle = 0

// 포인터 잠금 중에만 돌림. 잠금 전에는 커서가 화면 밖으로 나가 이동량이 끊김
canvas.addEventListener('click', () => canvas.requestPointerLock())
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) angle = turn(angle, e.movementX, SENSITIVITY)
})

function frame() {
  renderFrame(pixels, W, H, MAP, makeCamera(x, y, angle, FOV))
  ctx.putImageData(image, 0, 0)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
