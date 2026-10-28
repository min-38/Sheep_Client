import './style.css'
import { MAP } from './map.ts'
import { makeCamera, renderFrame } from './render.ts'

// 내부 해상도. 이 크기로 그리고 CSS로 확대함 (기술 설계서 렌더링)
const W = 480
const H = 270

const canvas = document.querySelector<HTMLCanvasElement>('#screen')!
canvas.width = W
canvas.height = H
const ctx = canvas.getContext('2d')!
const image = ctx.createImageData(W, H)

// 이동이 없어 한 번만 그림
renderFrame(new Uint32Array(image.data.buffer), W, H, MAP, makeCamera(2.5, 2.5, 0.6, 66))
ctx.putImageData(image, 0, 0)
