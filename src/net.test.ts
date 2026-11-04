import { describe, expect, test } from 'vitest'
import { parseServerMessage } from './net.ts'

describe('parseServerMessage', () => {
  test('방 만들기와 입장 응답은 내 플레이어 id를 받음', () => {
    expect(parseServerMessage('{"type":"roomCreated","code":"AB12CD","playerId":"p1"}')).toEqual({ type: 'roomCreated', code: 'AB12CD', playerId: 'p1' })
    expect(parseServerMessage('{"type":"joined","code":"AB12CD","playerId":"p1"}')).toEqual({ type: 'joined', code: 'AB12CD', playerId: 'p1' })
    expect(parseServerMessage('{"type":"joined","code":"AB12CD"}')).toBeNull()
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

  test('상태는 틱 번호와 모든 플레이어의 위치, 각도를 받음', () => {
    const text = '{"type":"state","tick":7,"players":[{"id":"p1","x":10.5,"y":4,"angle":1.57},{"id":"p2","x":10.5,"y":17,"angle":4.71}]}'
    expect(parseServerMessage(text)).toEqual({
      type: 'state',
      tick: 7,
      players: [
        { id: 'p1', x: 10.5, y: 4, angle: 1.57 },
        { id: 'p2', x: 10.5, y: 17, angle: 4.71 },
      ],
    })
  })

  test('모양이 틀린 상태는 버림', () => {
    expect(parseServerMessage('{"type":"state","players":[]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":1,"x":1,"y":1,"angle":0}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":"1","y":1,"angle":0}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[null]}')).toBeNull()
  })

  test('깨진 JSON, 모르는 type, 빠진 필드는 버림', () => {
    expect(parseServerMessage('{"type":')).toBeNull()
    expect(parseServerMessage('null')).toBeNull()
    expect(parseServerMessage('{"type":"hello"}')).toBeNull()
    expect(parseServerMessage('{"type":"joined"}')).toBeNull()
  })
})
