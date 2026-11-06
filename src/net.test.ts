import { describe, expect, test } from 'vitest'
import { fireMessage, parseServerMessage } from './net.ts'

describe('parseServerMessage', () => {
  test('방 만들기와 입장 응답은 내 플레이어 id를 받음', () => {
    expect(parseServerMessage('{"type":"roomCreated","code":"AB12CD","playerId":"p1"}')).toEqual({ type: 'roomCreated', code: 'AB12CD', playerId: 'p1' })
    expect(parseServerMessage('{"type":"joined","code":"AB12CD","playerId":"p1"}')).toEqual({ type: 'joined', code: 'AB12CD', playerId: 'p1' })
    expect(parseServerMessage('{"type":"joined","code":"AB12CD"}')).toBeNull()
  })

  test('입장 거절은 정해진 사유만 받음', () => {
    expect(parseServerMessage('{"type":"error","reason":"notFound"}')).toEqual({ type: 'error', reason: 'notFound' })
    expect(parseServerMessage('{"type":"error","reason":"full"}')).toEqual({ type: 'error', reason: 'full' })
    expect(parseServerMessage('{"type":"error","reason":"playing"}')).toEqual({ type: 'error', reason: 'playing' })
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

  test('상태는 틱 번호와 모든 플레이어의 위치, 각도, 동작, 준비 여부를 받음', () => {
    const text = '{"type":"state","tick":7,"players":[{"id":"p1","x":10.5,"y":4,"angle":1.57,"pose":"stand","ready":true},{"id":"p2","x":10.5,"y":17,"angle":4.71,"pose":"walk","ready":false}]}'
    expect(parseServerMessage(text)).toEqual({
      type: 'state',
      tick: 7,
      players: [
        { id: 'p1', x: 10.5, y: 4, angle: 1.57, pose: 'stand', ready: true },
        { id: 'p2', x: 10.5, y: 17, angle: 4.71, pose: 'walk', ready: false },
      ],
    })
  })

  test('쓰러진 사람의 동작은 down', () => {
    const text = '{"type":"state","tick":9,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"down","ready":false}]}'
    expect(parseServerMessage(text)).toEqual({ type: 'state', tick: 9, players: [{ id: 'p1', x: 1, y: 1, angle: 0, pose: 'down', ready: false }] })
  })

  test('모양이 틀린 상태는 버림', () => {
    expect(parseServerMessage('{"type":"state","players":[]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":1,"x":1,"y":1,"angle":0,"pose":"stand","ready":false}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":"1","y":1,"angle":0,"pose":"stand","ready":false}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"pose":"stand","ready":false}]}')).toBeNull()
    // 준비 여부는 true·false만 받음 (기술 설계서 메시지 state)
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"stand"}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"stand","ready":"true"}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"stand","ready":1}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[null]}')).toBeNull()
    // 동작은 표에 있는 이름만 받음 (기술 설계서 메시지 state)
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"angle":0,"ready":false}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"run","ready":false}]}')).toBeNull()
  })

  test('시계 맞추기 답은 보낸 t0과 서버 시각 ts를 받음', () => {
    expect(parseServerMessage('{"type":"serverTime","t0":1234.5,"ts":98765.25}')).toEqual({ type: 'serverTime', t0: 1234.5, ts: 98765.25 })
    expect(parseServerMessage('{"type":"serverTime","t0":1234.5}')).toBeNull()
    expect(parseServerMessage('{"type":"serverTime","t0":"1234.5","ts":98765.25}')).toBeNull()
    expect(parseServerMessage('{"type":"serverTime","t0":1234.5,"ts":null}')).toBeNull()
  })

  test('판 단계는 단계 이름과 그 단계가 시작하는 서버 시각을 받음', () => {
    expect(parseServerMessage('{"type":"phase","phase":"countdown","at":1500.5}')).toEqual({ type: 'phase', phase: 'countdown', at: 1500.5 })
    expect(parseServerMessage('{"type":"phase","phase":"walk","at":4500.5}')).toEqual({ type: 'phase', phase: 'walk', at: 4500.5 })
    expect(parseServerMessage('{"type":"phase","phase":"duel","at":7500.5}')).toEqual({ type: 'phase', phase: 'duel', at: 7500.5 })
    // 준비 중(lobby)은 알리지 않는 단계임
    expect(parseServerMessage('{"type":"phase","phase":"lobby","at":0}')).toBeNull()
    expect(parseServerMessage('{"type":"phase","phase":"walk"}')).toBeNull()
    expect(parseServerMessage('{"type":"phase","phase":"walk","at":"4500"}')).toBeNull()
  })

  test('발사 이벤트는 쏜 사람과 쏜 각도를 받음', () => {
    expect(parseServerMessage('{"type":"shot","playerId":"p2","angle":3.14}')).toEqual({ type: 'shot', playerId: 'p2', angle: 3.14 })
    expect(parseServerMessage('{"type":"shot","angle":3.14}')).toBeNull()
    expect(parseServerMessage('{"type":"shot","playerId":"p2"}')).toBeNull()
    expect(parseServerMessage('{"type":"shot","playerId":"p2","angle":"3.14"}')).toBeNull()
  })

  test('탈락은 쓰러진 사람을 받음', () => {
    expect(parseServerMessage('{"type":"eliminated","playerId":"p2"}')).toEqual({ type: 'eliminated', playerId: 'p2' })
    expect(parseServerMessage('{"type":"eliminated"}')).toBeNull()
    expect(parseServerMessage('{"type":"eliminated","playerId":2}')).toBeNull()
  })

  test('깨진 JSON, 모르는 type, 빠진 필드는 버림', () => {
    expect(parseServerMessage('{"type":')).toBeNull()
    expect(parseServerMessage('null')).toBeNull()
    expect(parseServerMessage('{"type":"hello"}')).toBeNull()
    expect(parseServerMessage('{"type":"joined"}')).toBeNull()
  })
})

describe('fireMessage', () => {
  test('쏜 시각을 서버 시계로 바꿔 보냄', () => {
    // 서버 시계가 4000ms 앞섬. 내 1000은 서버 5000
    expect(fireMessage(1.5, 1000, 4000)).toEqual({ type: 'fire', angle: 1.5, at: 5000 })
    // 서버 시계가 500ms 뒤처짐. 내 1000은 서버 500
    expect(fireMessage(0, 1000, -500)).toEqual({ type: 'fire', angle: 0, at: 500 })
  })
})
