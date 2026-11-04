import { describe, expect, test } from 'vitest'
import { parseServerMessage } from './net.ts'

describe('parseServerMessage', () => {
  test('방 만들기와 입장 응답', () => {
    expect(parseServerMessage('{"type":"roomCreated","code":"AB12CD"}')).toEqual({ type: 'roomCreated', code: 'AB12CD' })
    expect(parseServerMessage('{"type":"joined","code":"AB12CD"}')).toEqual({ type: 'joined', code: 'AB12CD' })
  })

  test('입장 거절은 정해진 사유만 받음', () => {
    expect(parseServerMessage('{"type":"error","reason":"notFound"}')).toEqual({ type: 'error', reason: 'notFound' })
    expect(parseServerMessage('{"type":"error","reason":"full"}')).toEqual({ type: 'error', reason: 'full' })
    expect(parseServerMessage('{"type":"error","reason":"busy"}')).toBeNull()
  })

  test('맵은 [y][x]로 받음', () => {
    const text = '{"type":"map","width":3,"height":2,"cells":[[1,1,1],[1,0,1]]}'
    expect(parseServerMessage(text)).toEqual({ type: 'map', width: 3, height: 2, cells: [[1, 1, 1], [1, 0, 1]] })
  })

  test('크기가 맞지 않거나 숫자가 아닌 맵은 버림', () => {
    expect(parseServerMessage('{"type":"map","width":3,"height":2,"cells":[[1,1,1]]}')).toBeNull()
    expect(parseServerMessage('{"type":"map","width":3,"height":2,"cells":[[1,1,1],[1,0]]}')).toBeNull()
    expect(parseServerMessage('{"type":"map","width":3,"height":2,"cells":[[1,1,1],[1,"0",1]]}')).toBeNull()
    expect(parseServerMessage('{"type":"map","width":3,"height":2}')).toBeNull()
  })

  test('깨진 JSON, 모르는 type, 빠진 필드는 버림', () => {
    expect(parseServerMessage('{"type":')).toBeNull()
    expect(parseServerMessage('null')).toBeNull()
    expect(parseServerMessage('{"type":"hello"}')).toBeNull()
    expect(parseServerMessage('{"type":"joined"}')).toBeNull()
  })
})
